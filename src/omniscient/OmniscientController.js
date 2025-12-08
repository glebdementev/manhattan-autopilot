/**
 * OmniscientController - Follows pre-computed omniscient paths
 * 
 * This controller has perfect knowledge - it follows waypoints exactly.
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
    
    if (this.path) {
      console.log(`Omniscient path: ${this.path.length} waypoints`);
    } else {
      console.warn('Could not find omniscient path');
    }
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
   * Update - returns velocity command to follow path
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
    
    // Direction to waypoint
    const wdx = waypoint.x - state.x;
    const wdy = waypoint.y - state.y;
    const wdz = waypoint.z - state.z;
    const dist = Math.sqrt(wdx * wdx + wdy * wdy + wdz * wdz);
    
    if (dist < 0.5) {
      return [0, 0, 0];
    }
    
    // Normalize
    const dirX = wdx / dist;
    const dirY = wdy / dist;
    const dirZ = wdz / dist;
    
    // Speed control
    let speedFactor = 1.0;
    const distToTarget = this.getDistanceToTarget();
    if (distToTarget < 5.0) {
      speedFactor = Math.max(0.3, distToTarget / 5.0);
    }
    
    // Convert to velocity commands
    const maxSpeed = DRONE.MAX_SPEED;
    const speed = this.targetSpeed * speedFactor;
    
    const vx = (dirX * speed) / maxSpeed;
    const vy = (dirY * speed) / maxSpeed;
    const vz = (dirZ * speed) / maxSpeed;
    
    return [
      Math.max(-1, Math.min(1, vx)),
      Math.max(-1, Math.min(1, vy)),
      Math.max(-1, Math.min(1, vz)),
    ];
  }
  
  /**
   * Get current target
   */
  getTarget() {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }
}

