/**
 * Observation Builder for RL Environment
 * Constructs observation vectors from drone state, lidar, and target info
 * 
 * Observation Space:
 * - Lidar distances (normalized 0-1): NUM_HORIZONTAL_RAYS * NUM_VERTICAL_RAYS values
 * - Velocity (normalized): vx, vy, vz
 * - Target direction (unit vector): dx, dy, dz
 * - Distance to target (normalized): 1 value
 * - Can see target: 1 value (binary)
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
   * Build observation vector
   * @param {Object} droneState - Drone state { x, y, z, vx, vy, vz, ... }
   * @param {Array} lidarDistances - Array of lidar distance readings
   * @param {Object} targetDir - Target direction in local coords { x, y, z }
   * @param {number} distToTarget - Distance to target
   * @param {boolean} canSeeTarget - Whether target is visible
   * @returns {Array} - Observation vector
   */
  build(droneState, lidarDistances, targetDir, distToTarget, canSeeTarget) {
    // Normalize lidar distances
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    // Normalize velocity
    const normalizedVel = [
      droneState.vx / DRONE.MAX_SPEED,
      droneState.vy / DRONE.MAX_SPEED,
      droneState.vz / DRONE.MAX_SPEED,
    ];
    
    // Normalized distance to target
    const normalizedDist = Math.min(distToTarget / RL_CONFIG.MAX_TARGET_DISTANCE, 1.0);
    
    // Can see target (binary)
    const canSee = canSeeTarget ? 1.0 : 0.0;
    
    // Combine all observations
    return [
      ...normalizedLidar,
      ...normalizedVel,
      targetDir.x,
      targetDir.y,
      targetDir.z,
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

