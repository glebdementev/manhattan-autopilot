/**
 * Observation Builder - uses 16-ray forward cone lidar + nadir + zenith
 * 
 * Observation (25 values):
 * - [0-2] Target direction (X, Y, Z) - normalized unit vector
 * - [3-5] Current velocity (vx, vy, vz) - normalized to [-1, 1]
 * - [6-21] 16 lidar ray distances (normalized 0-1)
 * - [22] Nadir (ground) distance (normalized)
 * - [23] Zenith (ceiling) distance (normalized)
 * - [24] Target distance (normalized)
 */

import { DRONE, LIDAR, RL_CONFIG } from '../../config.js';

export class ObservationBuilder {
  constructor() {
    // 3 (target dir) + 3 (velocity) + 16 (lidar) + 1 (nadir) + 1 (zenith) + 1 (target dist) = 25
    this.observationSize = 25;
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
    
    // All 64 lidar rays (normalized)
    const lidarDists = lidar.getNormalizedDistances();
    const rayDists = Array.from(lidarDists.slice(0, LIDAR.NUM_RAYS));
    
    // Nadir distance (ground)
    const nadir = lidar.getNadirDistance() / LIDAR.MAX_RANGE;
    
    // Zenith distance (ceiling/canopy)
    const zenith = lidar.getZenithDistance() / LIDAR.MAX_RANGE;
    
    // Target distance (normalized)
    const targetDist = Math.min(dist / RL_CONFIG.MAX_TARGET_DISTANCE, 1);
    
    return [
      dirX, dirY, dirZ,           // Target direction [0-2]
      velX, velY, velZ,           // Velocity [3-5]
      ...rayDists,                // 16 lidar distances [6-21]
      nadir,                      // Ground distance [22]
      zenith,                     // Ceiling distance [23]
      targetDist,                 // Target distance [24]
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
    
    // Fill with max range (no obstacles)
    const rayDists = new Array(LIDAR.NUM_RAYS).fill(1);
    const targetDist = Math.min(dist / RL_CONFIG.MAX_TARGET_DISTANCE, 1);
    
    return [
      dirX, dirY, dirZ,
      0, 0, 0,           // Zero velocity
      ...rayDists,       // 16 rays at max range
      1,                 // Safe ground distance (nadir)
      1,                 // Safe ceiling distance (zenith)
      targetDist,        // Target distance
    ];
  }
  
  getSpaceInfo() {
    return { size: this.observationSize };
  }
  
  getSize() {
    return this.observationSize;
  }
}
