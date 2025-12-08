/**
 * OmniscientController - Follows pre-computed omniscient paths
 * 
 * This controller has perfect knowledge - it follows waypoints exactly.
 * Outputs LOCAL velocity: [forward, vertical, yawRate]
 */
import { DRONE, CONTROLLER } from '../config.js';

export class OmniscientController {
  constructor(drone, pathGenerator) {
    this.drone = drone;
    this.pathGenerator = pathGenerator;
    
    // Current path
    this.path = null;
    this.currentWaypointIndex = 0;
    
    // Target
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.hasTarget = false;
    
    // Control params
    this.waypointReachDist = CONTROLLER.WAYPOINT_REACH_DIST || 1.5;
    this.targetSpeed = CONTROLLER.TARGET_SPEED || 5.0;
    
    // Yaw control gain
    this.yawGain = 2.0;
  }
  
  /**
   * Set target and compute path
   */
  setTarget(x, y, z) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.hasTarget = true;
    
    // Compute omniscient path
    const state = this.drone.getState();
    this.path = this.pathGenerator.generatePath(
      state.x, state.y, state.z,
      x, y, z
    );
    this.currentWaypointIndex = 0;
  }
  
  /**
   * Clear target
   */
  clearTarget() {
    this.hasTarget = false;
    this.path = null;
    this.currentWaypointIndex = 0;
  }
  
  /**
   * Check if has active target
   */
  hasActiveTarget() {
    return this.hasTarget && this.path !== null;
  }
  
  /**
   * Get current path
   */
  getPath() {
    return this.path;
  }
  
  /**
   * Get current waypoint index
   */
  getCurrentWaypointIndex() {
    return this.currentWaypointIndex;
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
   * Update - returns LOCAL velocity command: [forward, vertical, yawRate]
   */
  update() {
    if (!this.hasTarget || !this.path || this.path.length === 0) {
      return [0, 0, 0];
    }
    
    const state = this.drone.getState();
    
    // Get current waypoint
    let waypoint = this.path[this.currentWaypointIndex];
    
    // Check if reached current waypoint
    const dx = waypoint.x - state.x;
    const dy = waypoint.y - state.y;
    const dz = waypoint.z - state.z;
    const distToWaypoint = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distToWaypoint < this.waypointReachDist && this.currentWaypointIndex < this.path.length - 1) {
      this.currentWaypointIndex++;
      waypoint = this.path[this.currentWaypointIndex];
    }
    
    // Direction to waypoint (horizontal only for yaw calculation)
    const wdx = waypoint.x - state.x;
    const wdy = waypoint.y - state.y;
    const wdz = waypoint.z - state.z;
    const horizDist = Math.sqrt(wdx * wdx + wdz * wdz);
    const totalDist = Math.sqrt(wdx * wdx + wdy * wdy + wdz * wdz);
    
    if (totalDist < 0.5) {
      return [0, 0, 0];
    }
    
    // Calculate desired yaw (angle to waypoint)
    const desiredYaw = Math.atan2(wdx, wdz);
    
    // Calculate yaw error (shortest angle)
    let yawError = desiredYaw - state.yaw;
    while (yawError > Math.PI) yawError -= 2 * Math.PI;
    while (yawError < -Math.PI) yawError += 2 * Math.PI;
    
    // Yaw rate command (proportional control)
    const yawRate = Math.max(-1, Math.min(1, yawError * this.yawGain));
    
    // Speed control - slow down when turning sharply or approaching target
    let speedFactor = 1.0;
    const distToTarget = this.getDistanceToTarget();
    if (distToTarget < 5.0) {
      speedFactor = Math.max(0.3, distToTarget / 5.0);
    }
    
    // Reduce forward speed when turning sharply
    const turnFactor = Math.max(0.3, 1.0 - Math.abs(yawError) / Math.PI);
    speedFactor *= turnFactor;
    
    // Forward velocity (in drone's local frame)
    const maxSpeed = DRONE.MAX_SPEED;
    const speed = this.targetSpeed * speedFactor;
    const forward = speed / maxSpeed;
    
    // Vertical velocity (world Y direction)
    const vertical = (wdy / totalDist) * (speed / maxSpeed);
    
    return [
      Math.max(-1, Math.min(1, forward)),
      Math.max(-1, Math.min(1, vertical)),
      yawRate,
    ];
  }
  
  /**
   * Get current target
   */
  getTarget() {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }
}

