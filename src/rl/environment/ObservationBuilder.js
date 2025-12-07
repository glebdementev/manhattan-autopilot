/**
 * Observation Builder - includes velocity for proper control
 * 
 * Observation (12 values):
 * - [0-2] Target direction (X, Y, Z) - normalized unit vector
 * - [3-5] Current velocity (vx, vy, vz) - normalized to [-1, 1]
 * - [6-9] 4 closest obstacle distances (normalized 0-1)
 * - [10] Nadir (ground) distance (normalized)
 * - [11] Zenith (ceiling) distance (normalized)
 */

import { DRONE, LIDAR } from '../../config.js';

export class ObservationBuilder {
  constructor() {
    // 3 (target dir) + 3 (velocity) + 4 (obstacles) + 1 (nadir) + 1 (zenith) = 12
    this.observationSize = 12;
  }
  
  /**
   * Build observation from drone state and lidar
   */
  build(droneState, lidar, targetPos) {
    // Target direction (normalized unit vector)
    const dx = targetPos.x - droneState.x;
    const dy = targetPos.y - droneState.y;
    const dz = targetPos.z - droneState.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    let dirX = 0, dirY = 0, dirZ = 0;
    if (dist > 0.001) {
      dirX = dx / dist;
      dirY = dy / dist;
      dirZ = dz / dist;
    }
    
    // Current velocity (normalized to [-1, 1] by MAX_SPEED)
    const velX = droneState.vx / DRONE.MAX_SPEED;
    const velY = droneState.vy / DRONE.MAX_SPEED;
    const velZ = droneState.vz / DRONE.MAX_SPEED;
    
    // Obstacle distances (normalized to [0, 1])
    const obstacles = lidar.getClosestObstacles();
    const obsDists = obstacles.map(o => o.distance / LIDAR.MAX_RANGE);
    
    // Nadir and zenith (normalized)
    const nadir = lidar.getNadirDistance() / LIDAR.MAX_RANGE;
    const zenith = lidar.getZenithDistance() / LIDAR.MAX_RANGE;
    
    return [
      dirX, dirY, dirZ,           // Target direction [0-2]
      velX, velY, velZ,           // Velocity [3-5]
      ...obsDists,                // 4 obstacle distances [6-9]
      nadir,                      // Ground distance [10]
      zenith,                     // Ceiling distance [11]
    ];
  }
  
  /**
   * Simple build from positions only (for compatibility)
   */
  buildFromPositions(droneX, droneY, droneZ, targetX, targetY, targetZ) {
    const dx = targetX - droneX;
    const dy = targetY - droneY;
    const dz = targetZ - droneZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    let dirX = 0, dirY = 0, dirZ = 0;
    if (dist > 0.001) {
      dirX = dx / dist;
      dirY = dy / dist;
      dirZ = dz / dist;
    }
    
    return [
      dirX, dirY, dirZ,
      0, 0, 0,           // Zero velocity
      1, 1, 1, 1,        // No obstacles (max range)
      1,                 // Safe ground distance
      1,                 // Safe ceiling distance
    ];
  }
  
  getSpaceInfo() {
    return { size: this.observationSize };
  }
  
  getSize() {
    return this.observationSize;
  }
}
