/**
 * Observation Builder for RL Environment
 * Constructs observation vectors from drone state, lidar, and target info
 * 
 * ALL values are in LOCAL coordinates (relative to drone facing direction)
 * 
 * Observation Space:
 * - Closest obstacles (4): each has [dirX, dirZ, distance] in local coords
 * - Nadir distance (1): normalized ground distance
 * - Zenith distance (1): normalized ceiling distance
 * - Velocity (3, LOCAL coords): vx (forward), vy (right), vz (up)
 * - Target direction (3, LOCAL coords): dx (forward), dy (right), dz (up)
 * - Distance to target (1): normalized
 * - Can see target (1): binary
 * 
 * This matches the LOCAL coordinate action space:
 * - thrustX > 0 = forward, thrustY > 0 = right, thrustZ > 0 = up
 */

import { LIDAR, DRONE, RL_CONFIG } from '../../config.js';

export class ObservationBuilder {
  constructor() {
    // Closest obstacles: 4 * 3 (dirX, dirZ, dist) = 12
    this.numClosestObstacles = LIDAR.NUM_CLOSEST_OBSTACLES;
    this.obstacleDataSize = this.numClosestObstacles * 3;
    
    // Special rays: nadir + zenith
    this.numSpecialRays = 2;
    
    // Total: obstacles(12) + special(2) + velocity(3) + target_dir(3) + distance(1) + can_see(1) = 22
    this.observationSize = this.obstacleDataSize + this.numSpecialRays + 3 + 3 + 1 + 1;
  }
  
  /**
   * Build observation vector (all in LOCAL coordinates)
   * @param {Object} droneState - Drone state with localVx, localVy, localVz
   * @param {Array} closestObstaclesFlat - Flat array [dirX1, dirZ1, dist1, ...] from lidar
   * @param {number} nadirDist - Nadir (ground) distance
   * @param {number} zenithDist - Zenith (ceiling) distance
   * @param {Object} targetDir - Target direction in LOCAL coords { x, y, z }
   * @param {number} distToTarget - Distance to target
   * @param {boolean} canSeeTarget - Whether target is visible
   * @returns {Array} - Observation vector
   */
  build(droneState, closestObstaclesFlat, nadirDist, zenithDist, targetDir, distToTarget, canSeeTarget) {
    // Normalize special ray distances
    const normalizedNadir = nadirDist / LIDAR.MAX_RANGE;
    const normalizedZenith = zenithDist / LIDAR.MAX_RANGE;
    
    // Normalize LOCAL velocity
    const normalizedVel = [
      droneState.localVx / DRONE.MAX_SPEED,  // Forward/back speed
      droneState.localVy / DRONE.MAX_SPEED,  // Right/left speed
      droneState.localVz / DRONE.MAX_SPEED,  // Up/down speed
    ];
    
    // Normalized distance to target
    const normalizedDist = Math.min(distToTarget / RL_CONFIG.MAX_TARGET_DISTANCE, 1.0);
    
    // Can see target (binary)
    const canSee = canSeeTarget ? 1.0 : 0.0;
    
    // Combine all observations (all in LOCAL coords)
    return [
      ...closestObstaclesFlat, // 4 obstacles * 3 values = 12
      normalizedNadir,         // Ground distance
      normalizedZenith,        // Ceiling distance
      ...normalizedVel,        // 3 velocity components
      targetDir.x,             // Local X: target is forward (+) or behind (-)
      targetDir.y,             // Local Y: target is right (+) or left (-)
      targetDir.z,             // Local Z: target is above (+) or below (-)
      normalizedDist,          // Distance to target
      canSee,                  // Can see target
    ];
  }
  
  /**
   * Get observation space info
   * @returns {Object}
   */
  getSpaceInfo() {
    return {
      size: this.observationSize,
      breakdown: {
        closestObstacles: this.obstacleDataSize,
        nadir: 1,
        zenith: 1,
        velocity: 3,
        targetDirection: 3,
        targetDistance: 1,
        canSeeTarget: 1,
      },
    };
  }
  
  /**
   * Get the size of observation vector
   * @returns {number}
   */
  getSize() {
    return this.observationSize;
  }
}
