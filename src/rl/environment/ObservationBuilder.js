/**
 * Observation Builder for RL Environment
 * Constructs observation vectors from drone state, lidar, and target info
 * 
 * ALL values are in LOCAL coordinates (relative to drone facing direction)
 * 
 * Observation Space:
 * - Lidar distances (normalized 0-1): in local coords (forward = +X)
 * - Velocity (normalized, LOCAL coords): vx (forward), vy (right), vz (up)
 * - Target direction (unit vector, LOCAL coords): dx (forward), dy (right), dz (up)
 * - Distance to target (normalized): 1 value
 * - Can see target: 1 value (binary)
 * 
 * This matches the LOCAL coordinate action space:
 * - thrustX > 0 = forward, thrustY > 0 = right, thrustZ > 0 = up
 */

import { LIDAR, DRONE, RL_CONFIG } from '../../config.js';

export class ObservationBuilder {
  constructor() {
    // Grid rays + nadir + zenith
    this.numLidarRays = LIDAR.NUM_HORIZONTAL_RAYS * LIDAR.NUM_VERTICAL_RAYS + 2;
    // lidar + velocity(3) + target_dir(3) + distance(1) + can_see(1)
    this.observationSize = this.numLidarRays + 3 + 3 + 1 + 1;
  }
  
  /**
   * Build observation vector (all in LOCAL coordinates)
   * @param {Object} droneState - Drone state with localVx, localVy, localVz
   * @param {Array} lidarDistances - Array of lidar distance readings (already in local coords)
   * @param {Object} targetDir - Target direction in LOCAL coords { x, y, z }
   * @param {number} distToTarget - Distance to target
   * @param {boolean} canSeeTarget - Whether target is visible
   * @returns {Array} - Observation vector
   */
  build(droneState, lidarDistances, targetDir, distToTarget, canSeeTarget) {
    // Normalize lidar distances (already in local coords from Lidar)
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
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
      ...normalizedLidar,
      ...normalizedVel,
      targetDir.x,  // Local X: target is forward (+) or behind (-)
      targetDir.y,  // Local Y: target is right (+) or left (-)
      targetDir.z,  // Local Z: target is above (+) or below (-)
      normalizedDist,
      canSee,
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
        lidar: this.numLidarRays,
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

