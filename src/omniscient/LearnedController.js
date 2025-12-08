/**
 * LearnedController - Navigation controller using trained PathPredictor
 * 
 * Uses the neural network trained on omniscient paths to predict
 * navigation actions from LIDAR observations.
 */
import { DRONE, LIDAR } from '../config.js';

export class LearnedController {
  constructor(drone, lidar, predictor) {
    this.drone = drone;
    this.lidar = lidar;
    this.predictor = predictor;
    
    // Target
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.hasTarget = false;
    
    // Smoothing
    this.smoothingFactor = 0.3;
    this.lastAction = [0, 0, 0];
    
    // Stats
    this.predictionCount = 0;
  }
  
  /**
   * Set target position
   */
  setTarget(x, y, z) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.hasTarget = true;
  }
  
  /**
   * Clear target
   */
  clearTarget() {
    this.hasTarget = false;
  }
  
  /**
   * Check if has active target
   */
  hasActiveTarget() {
    return this.hasTarget;
  }
  
  /**
   * Get distance to target
   */
  getDistanceToTarget() {
    if (!this.hasTarget) return Infinity;
    
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Main update - predicts action from current observation
   * @returns {Array} [vx, vy, vz] normalized velocity commands [-1, 1]
   */
  update() {
    if (!this.hasTarget || !this.predictor.isReady()) {
      return [0, 0, 0];
    }
    
    const state = this.drone.getState();
    const dist = this.getDistanceToTarget();
    
    // If very close to target, stop
    if (dist < 1.0) {
      return [0, 0, 0];
    }
    
    // Build observation (same format as training)
    const observation = this.buildObservation(state);
    
    // Get prediction from model
    const prediction = this.predictor.predict(observation);
    this.predictionCount++;
    
    // Convert from local to world frame
    const cosYaw = Math.cos(state.yaw);
    const sinYaw = Math.sin(state.yaw);
    
    // Prediction is in local frame [localX, Y, localZ]
    const localX = prediction[0];
    const localY = prediction[1];
    const localZ = prediction[2];
    
    // Transform to world frame
    const worldX = localX * cosYaw + localZ * sinYaw;
    const worldZ = -localX * sinYaw + localZ * cosYaw;
    
    // Apply smoothing
    const smoothedX = this.lastAction[0] * (1 - this.smoothingFactor) + worldX * this.smoothingFactor;
    const smoothedY = this.lastAction[1] * (1 - this.smoothingFactor) + localY * this.smoothingFactor;
    const smoothedZ = this.lastAction[2] * (1 - this.smoothingFactor) + worldZ * this.smoothingFactor;
    
    this.lastAction = [smoothedX, smoothedY, smoothedZ];
    
    // Slow down when approaching target
    let speedFactor = 1.0;
    if (dist < 5.0) {
      speedFactor = Math.max(0.3, dist / 5.0);
    }
    
    return [
      Math.max(-1, Math.min(1, smoothedX * speedFactor)),
      Math.max(-1, Math.min(1, smoothedY * speedFactor)),
      Math.max(-1, Math.min(1, smoothedZ * speedFactor)),
    ];
  }
  
  /**
   * Build observation vector (same format as training)
   */
  buildObservation(state) {
    const { x, y, z, vx, vy, vz, yaw } = state;
    
    // Target direction in world space
    const dx = this.targetX - x;
    const dy = this.targetY - y;
    const dz = this.targetZ - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Normalize target direction
    const targetDirX = dist > 0.001 ? dx / dist : 0;
    const targetDirY = dist > 0.001 ? dy / dist : 0;
    const targetDirZ = dist > 0.001 ? dz / dist : 0;
    
    // Convert target direction to drone-local frame
    const cosYaw = Math.cos(-yaw);
    const sinYaw = Math.sin(-yaw);
    const localTargetX = targetDirX * cosYaw - targetDirZ * sinYaw;
    const localTargetZ = targetDirX * sinYaw + targetDirZ * cosYaw;
    
    // Normalize distance
    const normalizedDist = Math.min(1, dist / 50);
    
    // Check line of sight
    const canSeeTarget = this.lidar.isPathToPointClear(this.targetX, this.targetY, this.targetZ, 0.5);
    
    // Get LIDAR distances
    const lidarDistances = this.lidar.getNormalizedDistances();
    
    // Normalize velocity
    const maxSpeed = DRONE.MAX_SPEED;
    const normVx = (vx || 0) / maxSpeed;
    const normVy = (vy || 0) / maxSpeed;
    const normVz = (vz || 0) / maxSpeed;
    
    // Build observation array
    const numLidarRays = this.lidar.getTotalRays();
    const obs = new Float32Array(8 + numLidarRays);
    
    obs[0] = localTargetX;
    obs[1] = targetDirY;
    obs[2] = localTargetZ;
    obs[3] = normalizedDist;
    obs[4] = canSeeTarget ? 1 : 0;
    obs[5] = normVx;
    obs[6] = normVy;
    obs[7] = normVz;
    
    for (let i = 0; i < numLidarRays; i++) {
      obs[8 + i] = lidarDistances[i];
    }
    
    return obs;
  }
  
  /**
   * Get prediction count
   */
  getPredictionCount() {
    return this.predictionCount;
  }
  
  /**
   * Get current target
   */
  getTarget() {
    return {
      x: this.targetX,
      y: this.targetY,
      z: this.targetZ,
    };
  }
}

