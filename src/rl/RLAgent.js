/**
 * Reinforcement Learning Agent using Policy Gradient (Actor-Critic style)
 * 
 * This implements a simple neural network policy that learns to navigate
 * through the forest environment. Similar to how TrackMania AI is trained.
 * 
 * Architecture:
 * - Policy Network (Actor): Outputs action probabilities/values
 * - Value Network (Critic): Estimates state value for advantage calculation
 * 
 * Training Algorithm: Proximal Policy Optimization (PPO) simplified
 * 
 * IMPORTANT: Uses heuristic blending to ensure drone moves towards target
 * even before the neural network has learned. The heuristic weight decreases
 * as training progresses.
 */

import { RL_CONFIG, LIDAR } from '../config.js';
import { PolicyNetwork, ValueNetwork } from './networks/index.js';
import { TrainingManager } from './training/index.js';
import { ExplorationManager } from './exploration/index.js';
import { ModelIO } from './io/index.js';

export class RLAgent {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    
    // Networks
    this.policyNetwork = new PolicyNetwork(observationSize, actionSize);
    this.valueNetwork = new ValueNetwork(observationSize);
    
    // Training manager
    this.trainingManager = new TrainingManager(this.policyNetwork, this.valueNetwork);
    
    // Exploration manager
    this.explorationManager = new ExplorationManager();
    
    // Episode counter
    this.episodeCount = 0;
    
    // Heuristic blending weight (starts high, decays with training)
    // This ensures the drone moves towards target even before NN learns
    this.heuristicWeight = RL_CONFIG.INITIAL_HEURISTIC_WEIGHT || 0.7;
    this.minHeuristicWeight = RL_CONFIG.MIN_HEURISTIC_WEIGHT || 0.1;
    this.heuristicDecay = RL_CONFIG.HEURISTIC_DECAY || 0.9998;
    
    // Observation layout (must match ObservationBuilder)
    this.numLidarRays = LIDAR.NUM_HORIZONTAL_RAYS * LIDAR.NUM_VERTICAL_RAYS + 2;
    
    console.log('RL Agent built');
    console.log(`Observation size: ${this.observationSize}, Action size: ${this.actionSize}`);
    console.log(`Initial heuristic weight: ${this.heuristicWeight}`);
  }
  
  /**
   * Extract target direction from observation (LOCAL coordinates)
   * Observation layout: [lidar..., vx, vy, vz, targetDirX, targetDirY, targetDirZ, dist, canSee]
   * 
   * In local coords:
   * - targetDir.z > 0 means target is in FRONT of drone
   * - targetDir.x > 0 means target is to the RIGHT
   * - targetDir.y > 0 means target is ABOVE
   */
  extractTargetDirection(observation) {
    const velStart = this.numLidarRays;
    const targetDirStart = velStart + 3; // After velocity (3 values)
    
    return {
      x: observation[targetDirStart],     // Local X: right (+) / left (-)
      y: observation[targetDirStart + 1], // Local Y: up (+) / down (-)
      z: observation[targetDirStart + 2], // Local Z: forward (+) / back (-)
    };
  }
  
  /**
   * Extract lidar distances for obstacle avoidance
   */
  extractLidarDistances(observation) {
    return observation.slice(0, this.numLidarRays);
  }
  
  /**
   * Compute heuristic action based on target direction and obstacles
   * 
   * EVERYTHING is in LOCAL coordinates now!
   * - Target direction is local (z = forward, x = right)
   * - Thrust controls are local (thrustZ = forward, thrustX = strafe right)
   * - Lidar is local (forward rays are in center)
   * 
   * This makes the heuristic trivially simple: thrust in direction of target!
   */
  computeHeuristicAction(observation) {
    const targetDir = this.extractTargetDirection(observation);
    const lidarDists = this.extractLidarDistances(observation);
    
    // In LOCAL coordinates, the action is simple:
    // If target is forward (targetDir.z > 0), thrust forward (thrustZ > 0)
    // If target is right (targetDir.x > 0), strafe right (thrustX > 0)
    // etc.
    let thrustX = targetDir.x * 0.7; // Strafe towards target
    let thrustY = targetDir.y * 0.5; // Vertical towards target
    let thrustZ = targetDir.z * 0.8; // Forward/back towards target
    
    // Obstacle avoidance using lidar (also in local coords)
    const gridRays = LIDAR.NUM_HORIZONTAL_RAYS * LIDAR.NUM_VERTICAL_RAYS;
    const hRays = LIDAR.NUM_HORIZONTAL_RAYS;
    const vRays = LIDAR.NUM_VERTICAL_RAYS;
    const centerH = Math.floor(hRays / 2);
    
    // Check forward-facing rays (center of horizontal FOV)
    let minForwardDist = 1.0;
    let obstacleLeftCount = 0;
    let obstacleRightCount = 0;
    
    for (let h = 0; h < hRays; h++) {
      for (let v = 0; v < vRays; v++) {
        const idx = h * vRays + v;
        if (idx < gridRays) {
          const dist = lidarDists[idx];
          
          // Forward cone (center third)
          const isForward = Math.abs(h - centerH) <= hRays / 4;
          if (isForward && dist < minForwardDist) {
            minForwardDist = dist;
          }
          
          // Track obstacles on left/right
          if (dist < 0.25) {
            if (h < centerH) obstacleLeftCount++;
            else if (h > centerH) obstacleRightCount++;
          }
        }
      }
    }
    
    // Obstacle avoidance
    const dangerThreshold = 0.2;  // 20% of max range
    const criticalThreshold = 0.1; // 10% of max range
    
    if (minForwardDist < criticalThreshold) {
      // Critical: back off and strafe away from obstacles
      thrustZ = Math.min(thrustZ, -0.3);
      if (obstacleLeftCount > obstacleRightCount) {
        thrustX = Math.max(thrustX, 0.5); // Go right
      } else if (obstacleRightCount > obstacleLeftCount) {
        thrustX = Math.min(thrustX, -0.5); // Go left
      }
      thrustY = Math.max(thrustY, 0.3); // Try to go up
    } else if (minForwardDist < dangerThreshold) {
      // Danger: slow down and adjust
      thrustZ *= 0.5;
      if (obstacleLeftCount > obstacleRightCount) {
        thrustX += 0.3;
      } else if (obstacleRightCount > obstacleLeftCount) {
        thrustX -= 0.3;
      }
    }
    
    // Clamp actions to valid range
    thrustX = Math.max(-1, Math.min(1, thrustX));
    thrustY = Math.max(-1, Math.min(1, thrustY));
    thrustZ = Math.max(-1, Math.min(1, thrustZ));
    
    return [thrustX, thrustY, thrustZ];
  }
  
  /**
   * Select action given observation
   * @param {Array} observation
   * @param {boolean} training - Whether to add exploration noise
   */
  selectAction(observation, training = false) {
    // Get neural network action
    const nnAction = this.policyNetwork.predict(observation);
    
    // Get heuristic action (target-seeking + obstacle avoidance)
    const heuristicAction = this.computeHeuristicAction(observation);
    
    // Blend NN and heuristic based on current weight
    // As training progresses, heuristic weight decreases
    const w = this.heuristicWeight;
    const action = [
      (1 - w) * nnAction[0] + w * heuristicAction[0],
      (1 - w) * nnAction[1] + w * heuristicAction[1],
      (1 - w) * nnAction[2] + w * heuristicAction[2],
    ];
    
    if (training) {
      return this.explorationManager.addNoise(action, true);
    }
    
    return action;
  }
  
  /**
   * Get value estimate for observation
   */
  getValue(observation) {
    return this.valueNetwork.predict(observation);
  }
  
  /**
   * Store experience in buffer
   */
  storeExperience(observation, action, reward, nextObservation, done) {
    this.trainingManager.storeExperience(observation, action, reward, nextObservation, done);
  }
  
  /**
   * Train on collected experiences
   */
  async train() {
    const result = await this.trainingManager.train();
    
    if (result) {
      this.explorationManager.decay();
      // Decay heuristic weight as NN improves
      this.heuristicWeight = Math.max(
        this.minHeuristicWeight,
        this.heuristicWeight * this.heuristicDecay
      );
    }
    
    return result;
  }
  
  /**
   * Clear experience buffer
   */
  clearBuffer() {
    this.trainingManager.clearBuffer();
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    const trainingStats = this.trainingManager.getStats();
    
    return {
      ...trainingStats,
      explorationRate: this.explorationManager.getRate(),
      heuristicWeight: this.heuristicWeight,
    };
  }
  
  /**
   * Check if agent is ready for inference
   */
  isReady() {
    return this.policyNetwork !== null && !this.trainingManager.isTraining;
  }
  
  /**
   * Check if currently training
   */
  get isTraining() {
    return this.trainingManager.isTraining;
  }
  
  /**
   * Get training step count
   */
  get trainingStep() {
    return this.trainingManager.trainingStep;
  }
  
  /**
   * Get exploration rate
   */
  get explorationRate() {
    return this.explorationManager.getRate();
  }
  
  /**
   * Set exploration rate
   */
  set explorationRate(rate) {
    this.explorationManager.setRate(rate);
  }
  
  /**
   * Get experience buffer size
   */
  get bufferSize() {
    return this.trainingManager.experienceBuffer.size;
  }
  
  /**
   * Get training history
   */
  get trainingHistory() {
    return this.trainingManager.getHistory();
  }
  
  /**
   * Export model to file
   */
  async exportToFile() {
    return ModelIO.exportToFile(
      this.policyNetwork,
      this.valueNetwork,
      this.trainingManager.getHistory(),
      this.trainingManager.trainingStep,
      this.explorationManager.getRate(),
      this.observationSize,
      this.actionSize,
      this.heuristicWeight
    );
  }
  
  /**
   * Import model from file
   */
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
      // Restore heuristic weight if saved
      if (result.heuristicWeight !== undefined) {
        this.heuristicWeight = result.heuristicWeight;
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Dispose of networks
   */
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
