/**
 * PathFollowingController - Uses trained model to follow pre-computed paths
 * 
 * Super simple: the model outputs a WORLD-SPACE direction vector toward
 * the next waypoint; this controller then uses the SAME control logic
 * as OmniscientController to turn that direction into [forward, vertical, yawRate].
 */
import { DRONE, CONTROLLER } from '../config.js';

export class PathFollowingController {
  constructor(drone, predictor, pathGenerator) {
    this.drone = drone;
    this.predictor = predictor;
    this.pathGenerator = pathGenerator;
    
    // Current path state
    this.path = null;
    this.currentWaypointIndex = 0;
    
    // Target
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.hasTarget = false;
    
    // Control params
    this.waypointReachDist = CONTROLLER.WAYPOINT_REACH_DIST || 1.5;
    
    // Smoothing
    this.smoothingFactor = 0.3;
    this.lastAction = [0, 0, 0];
    
    // Stats
    this.predictionCount = 0;
    this.yawGain = 2.0;
    this.targetSpeed = CONTROLLER.TARGET_SPEED || 5.0;
  }
  
  /**
   * Set target and compute path
   */
  setTarget(x, y, z) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.hasTarget = true;
    
    const state = this.drone.getState();
    this.path = this.pathGenerator.generatePath(
      state.x, state.y, state.z,
      x, y, z
    );
    this.currentWaypointIndex = 0;
    this.lastAction = [0, 0, 0];
  }
  
  clearTarget() {
    this.hasTarget = false;
    this.path = null;
    this.currentWaypointIndex = 0;
  }
  
  hasActiveTarget() {
    return this.hasTarget && this.path !== null;
  }
  
  getPath() {
    return this.path;
  }
  
  getCurrentWaypointIndex() {
    return this.currentWaypointIndex;
  }
  
  getDistanceToTarget() {
    if (!this.hasTarget) return Infinity;
    
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Main update - uses model to predict WORLD direction to follow
   */
  update() {
    if (!this.hasTarget || !this.path || this.path.length === 0) {
      return [0, 0, 0];
    }
    
    if (!this.predictor.isReady()) {
      return [0, 0, 0];
    }
    
    const state = this.drone.getState();
    
    // Advance waypoint if reached
    this.advanceWaypoint(state);
    
    // Check if done
    const dist = this.getDistanceToTarget();
    if (dist < 1.0) {
      return [0, 0, 0];
    }
    
    // Get current waypoint
    const waypoint = this.getCurrentWaypoint();
    if (!waypoint) {
      return [0, 0, 0];
    }

    // Build observation: world direction to waypoint
    const observation = this.buildObservation(state, waypoint);
    
    // Get prediction from model (world direction)
    const prediction = this.predictor.predict(observation);
    this.predictionCount++;
    
    // Interpret prediction as WORLD direction vector (horizontal only)
    let dirX = prediction[0];
    let dirZ = prediction[2];
    
    // Normalize horizontal component
    const horizLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (horizLen < 1e-4) {
      return [0, 0, 0];
    }
    dirX /= horizLen;
    dirZ /= horizLen;
    
    // Calculate desired yaw from world direction (same convention as OmniscientController)
    const desiredYaw = Math.atan2(dirX, dirZ);
    
    // Yaw error (shortest angle)
    let yawError = desiredYaw - state.yaw;
    while (yawError > Math.PI) yawError -= 2 * Math.PI;
    while (yawError < -Math.PI) yawError += 2 * Math.PI;
    
    // Yaw rate command
    const yawRate = Math.max(-1, Math.min(1, yawError * this.yawGain));
    
    // Base speed factor like OmniscientController
    const distToTarget = this.getDistanceToTarget();
    let speedFactor = 1.0;
    if (distToTarget < 5.0) {
      speedFactor = Math.max(0.3, distToTarget / 5.0);
    }
    
    // Slow down when turning sharply
    const turnFactor = Math.max(0.3, 1.0 - Math.abs(yawError) / Math.PI);
    speedFactor *= turnFactor;
    
    const maxSpeed = DRONE.MAX_SPEED;
    const speed = this.targetSpeed * speedFactor;
    let forward = speed / maxSpeed;
    
    // Vertical velocity: derive directly from waypoint height difference
    const wdx = waypoint.x - state.x;
    const wdy = waypoint.y - state.y;
    const wdz = waypoint.z - state.z;
    const totalDist = Math.sqrt(wdx * wdx + wdy * wdy + wdz * wdz);
    const vertical = totalDist > 0.001
      ? (wdy / totalDist) * (speed / maxSpeed)
      : 0;
    
    // Smoothing
    const smoothedForward = this.lastAction[0] * (1 - this.smoothingFactor) + forward * this.smoothingFactor;
    const smoothedVertical = this.lastAction[1] * (1 - this.smoothingFactor) + vertical * this.smoothingFactor;
    const smoothedYawRate = this.lastAction[2] * (1 - this.smoothingFactor) + yawRate * this.smoothingFactor;
    
    this.lastAction = [smoothedForward, smoothedVertical, smoothedYawRate];
    
    return [
      Math.max(-1, Math.min(1, smoothedForward * speedFactor)),
      Math.max(-1, Math.min(1, smoothedVertical * speedFactor)),
      Math.max(-1, Math.min(1, smoothedYawRate)),
    ];
  }
  
  advanceWaypoint(state) {
    if (this.currentWaypointIndex >= this.path.length) return;
    
    const wp = this.path[this.currentWaypointIndex];
    const dx = wp.x - state.x;
    const dy = wp.y - state.y;
    const dz = wp.z - state.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < this.waypointReachDist && this.currentWaypointIndex < this.path.length - 1) {
      this.currentWaypointIndex++;
    }
  }
  
  getCurrentWaypoint() {
    if (!this.path || this.currentWaypointIndex >= this.path.length) return null;
    return this.path[this.currentWaypointIndex];
  }
  
  /**
   * Build observation for model (matches PathFollowingDataCollector)
   */
  buildObservation(state, waypoint) {
    const { x, y, z } = state;
    
    const dx = waypoint.x - x;
    const dy = waypoint.y - y;
    const dz = waypoint.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const obs = new Float32Array(4);
    
    if (dist > 0.001) {
      obs[0] = dx / dist;
      obs[1] = dy / dist;
      obs[2] = dz / dist;
      obs[3] = Math.min(1, dist / 50);
    } else {
      obs[0] = 0;
      obs[1] = 0;
      obs[2] = 1;
      obs[3] = 0;
    }
    
    return obs;
  }
  
  getPredictionCount() {
    return this.predictionCount;
  }
  
  getTarget() {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }
}
