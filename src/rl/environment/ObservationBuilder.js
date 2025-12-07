/**
 * Observation Builder - EXPANDED FOR OBSTACLE AVOIDANCE
 * 
 * Observation (9 values):
 * - [0-2] Target direction (X, Y, Z) - normalized
 * - [3-6] 4 closest obstacle distances (normalized 0-1)
 * - [7] Nadir (ground) distance (normalized)
 * - [8] Zenith (ceiling) distance (normalized)
 */

import { LIDAR } from '../../config.js';

export class ObservationBuilder {
  constructor() {
    // 3 (target dir) + 4 (obstacles) + 1 (nadir) + 1 (zenith) = 9
    this.observationSize = 9;
    this.debugCounter = 0;
  }
  
  /**
   * Build full observation with lidar data
   */
  build(droneState, lidar, targetPos) {
    // Target direction (normalized)
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
    
    // Get obstacle distances (normalized)
    const obstacles = lidar.getClosestObstacles();
    const obsDists = obstacles.map(o => o.distance / LIDAR.MAX_RANGE);
    
    // Nadir and zenith (normalized)
    const nadir = lidar.getNadirDistance() / LIDAR.MAX_RANGE;
    const zenith = lidar.getZenithDistance() / LIDAR.MAX_RANGE;
    
    const obs = [
      dirX, dirY, dirZ,           // Target direction
      ...obsDists,                // 4 obstacle distances
      nadir,                      // Ground distance
      zenith,                     // Ceiling distance
    ];
    
    // Debug
    this.debugCounter++;
    if (this.debugCounter <= 5 || this.debugCounter % 500 === 0) {
      console.log(`[OBS] target=[${dirX.toFixed(2)}, ${dirY.toFixed(2)}, ${dirZ.toFixed(2)}] obs=[${obsDists.map(d => d.toFixed(2)).join(', ')}] nadir=${nadir.toFixed(2)} zenith=${zenith.toFixed(2)}`);
    }
    
    return obs;
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
    
    // Return full observation with default safe values for lidar
    return [
      dirX, dirY, dirZ,
      1, 1, 1, 1,  // No obstacles (max range)
      1,           // Safe ground distance
      1,           // Safe ceiling distance
    ];
  }
  
  getSpaceInfo() {
    return { size: this.observationSize };
  }
  
  getSize() {
    return this.observationSize;
  }
}
