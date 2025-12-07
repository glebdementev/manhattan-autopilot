/**
 * Reinforcement Learning Agent - Residual Policy
 * 
 * Observation (25 values, see ObservationBuilder):
 * - [0-2]  Target direction (X, Y, Z) - normalized
 * - [3-5]  Current velocity (vx, vy, vz) - normalized
 * - [6-21] 16 lidar ray distances (normalized 0-1)
 * - [22]   Nadir distance (normalized)
 * - [23]   Zenith distance (normalized)
 * - [24]   Target distance (normalized)
 * 
 * Action (3 values):
 * - Velocity setpoints [vx, vy, vz] in [-1, 1]
 * - Mapped to [-MAX_SPEED, MAX_SPEED] by the drone's velocity controller
 * 
 * The network outputs a CORRECTION to the base action (target direction).
 * Final action = base_action + correction, passed through a safety filter.
 */

import { PolicyNetwork, ValueNetwork } from './networks/index.js';
import { TrainingManager } from './training/index.js';
import { ExplorationManager } from './exploration/index.js';
import { ModelIO } from './io/index.js';

export class RLAgent {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    
    this.policyNetwork = new PolicyNetwork(observationSize, actionSize);
    this.valueNetwork = new ValueNetwork(observationSize);
    
    this.trainingManager = new TrainingManager(this.policyNetwork, this.valueNetwork);
    this.explorationManager = new ExplorationManager();
    
    this.episodeCount = 0;
    
    console.log('RL Agent initialized (velocity setpoint control)');
    console.log(`Observation size: ${observationSize}, Action size: ${actionSize}`);
  }
  
  /**
   * Select action given observation
   * 
   * observation[0:3] = target direction (base action for velocity)
   * observation[3:6] = current velocity
   * observation[6:22] = lidar rays
   * observation[22]  = nadir, [23] = zenith
   * 
   * Network outputs correction, final = base + correction
   */
  selectAction(observation, training = false) {
    // Base action = target direction (first 3 elements)
    const baseAction = [observation[0], observation[1], observation[2]];
    
    // Get learned correction from network
    const correction = this.policyNetwork.predict(observation);
    
    // Final action before exploration/safety = base + correction
    let action = baseAction.map((base, i) => {
      const final = base + correction[i];
      return Math.max(-1, Math.min(1, final));
    });
    
    if (training) {
      action = this.explorationManager.addNoise(action, true);
    }

    // Apply simple safety filter based on lidar / nadir / zenith
    action = this.applySafetyFilter(observation, action);
    
    return action;
  }

  /**
   * Safety filter: clamps actions when very close to obstacles,
   * ground (nadir) or ceiling/canopy (zenith), using only the
   * observation vector (no extra dependencies).
   */
  applySafetyFilter(observation, action) {
    let [vx, vy, vz] = action;

    // Lidar rays and vertical distances are normalized [0, 1]
    // We only use the CENTRAL subset of forward rays to decide
    // whether to slow/stop forward motion. Side obstacles alone
    // should not completely freeze the drone if the path ahead
    // is clear.
    const firstRayIdx = 6;          // index of first lidar ray in obs
    const numRays = 16;             // matches LIDAR.NUM_RAYS
    const lastRayIdx = firstRayIdx + numRays - 1; // 21

    // Take a band around the center rays as "forward-ish" beams.
    // For 16 rays indexed 0..15, centre is around 7–8.
    const centerFirst = firstRayIdx + 5; // ray indices 5..10
    const centerLast = firstRayIdx + 10;

    let minFrontLidar = 1;
    for (let i = centerFirst; i <= centerLast && i <= lastRayIdx; i++) {
      const d = observation[i];
      if (d < minFrontLidar) minFrontLidar = d;
    }

    const nadir = observation[22];
    const zenith = observation[23];

    // Thresholds in normalized units
    const FORWARD_STOP_DIST = 0.12; // very close
    const FORWARD_SLOW_DIST = 0.25; // start slowing down
    const VERTICAL_MIN_DIST = 0.06; // very close to ground/ceiling

    // Horizontal safety: only clamp motion ALONG the target direction,
    // but keep sideways motion free so the policy can learn to slide
    // around trunks instead of freezing in place.
    const dirX = observation[0];
    const dirZ = observation[2];
    const dirHorizMag = Math.hypot(dirX, dirZ);

    if (dirHorizMag > 1e-3) {
      // Forward basis (towards target in XZ-plane)
      const fx = dirX / dirHorizMag;
      const fz = dirZ / dirHorizMag;

      // Decompose horizontal velocity into forward + sideways components
      const vForward = vx * fx + vz * fz;
      const sideX = vx - vForward * fx;
      const sideZ = vz - vForward * fz;

      let vForwardClamped = vForward;

      if (minFrontLidar < FORWARD_STOP_DIST) {
        // Very close obstacle ahead → block further forward motion
        // but keep sideways component intact.
        vForwardClamped = 0;
      } else if (minFrontLidar < FORWARD_SLOW_DIST) {
        // In a "slow-down" band: scale forward speed based on distance
        const t =
          (minFrontLidar - FORWARD_STOP_DIST) /
          (FORWARD_SLOW_DIST - FORWARD_STOP_DIST);
        const scale = Math.max(0, Math.min(1, t));
        vForwardClamped = vForward * scale;
      }

      vx = vForwardClamped * fx + sideX;
      vz = vForwardClamped * fz + sideZ;
    } else {
      // Fallback: if target direction is degenerate, use simple scaling
      const horizMag = Math.hypot(vx, vz);
      if (minFrontLidar < FORWARD_STOP_DIST) {
        vx = 0;
        vz = 0;
      } else if (minFrontLidar < FORWARD_SLOW_DIST && horizMag > 1e-3) {
        const t =
          (minFrontLidar - FORWARD_STOP_DIST) /
          (FORWARD_SLOW_DIST - FORWARD_STOP_DIST);
        const scale = Math.max(0, Math.min(1, t));
        vx *= scale;
        vz *= scale;
      }
    }

    // Protect against ground collision: don't allow further descent
    if (nadir < VERTICAL_MIN_DIST && vy < 0) {
      vy = 0;
    }

    // Protect against ceiling/canopy collision: don't allow further ascent
    if (zenith < VERTICAL_MIN_DIST && vy > 0) {
      vy = 0;
    }

    return [
      Math.max(-1, Math.min(1, vx)),
      Math.max(-1, Math.min(1, vy)),
      Math.max(-1, Math.min(1, vz)),
    ];
  }
  
  getValue(observation) {
    return this.valueNetwork.predict(observation);
  }
  
  storeExperience(observation, action, reward, nextObservation, done) {
    this.trainingManager.storeExperience(observation, action, reward, nextObservation, done);
  }
  
  async train() {
    const result = await this.trainingManager.train();
    
    if (result) {
      this.explorationManager.decay();
    }
    
    return result;
  }
  
  clearBuffer() {
    this.trainingManager.clearBuffer();
  }
  
  getStats() {
    return {
      ...this.trainingManager.getStats(),
      explorationRate: this.explorationManager.getRate(),
    };
  }
  
  isReady() {
    return this.policyNetwork !== null && !this.trainingManager.isTraining;
  }
  
  get isTraining() {
    return this.trainingManager.isTraining;
  }
  
  get trainingStep() {
    return this.trainingManager.trainingStep;
  }
  
  get explorationRate() {
    return this.explorationManager.getRate();
  }
  
  set explorationRate(rate) {
    this.explorationManager.setRate(rate);
  }
  
  get bufferSize() {
    return this.trainingManager.experienceBuffer.size;
  }
  
  get trainingHistory() {
    return this.trainingManager.getHistory();
  }
  
  async exportToFile() {
    return ModelIO.exportToFile(
      this.policyNetwork,
      this.valueNetwork,
      this.trainingManager.getHistory(),
      this.trainingManager.trainingStep,
      this.explorationManager.getRate(),
      this.observationSize,
      this.actionSize
    );
  }
  
  async importFromFile(file) {
    const result = await ModelIO.importFromFile(
      file,
      this.policyNetwork,
      this.valueNetwork
    );
    
    if (result) {
      this.trainingManager.setHistory(result.trainingHistory);
      this.trainingManager.setTrainingStep(result.trainingStep);
      this.explorationManager.setRate(result.explorationRate);
      return true;
    }
    
    return false;
  }
  
  dispose() {
    if (this.policyNetwork) {
      this.policyNetwork.dispose();
      this.policyNetwork = null;
    }
    if (this.valueNetwork) {
      this.valueNetwork.dispose();
      this.valueNetwork = null;
    }
  }
}
