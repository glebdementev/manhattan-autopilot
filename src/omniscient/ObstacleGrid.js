/**
 * ObstacleGrid - Collision adapter for omniscient planner
 *
 * Previously this used a custom spatial hash over analytic cylinders from
 * `forest.getObstacles()`. The drone physics and LiDAR, however, rely on
 * `MeshCollider` + `forest.getRaycastTargets()` (actual render meshes).
 *
 * That mismatch is what allowed A* to plan "clear" paths that still collided
 * at runtime. To keep a single source of truth, this now delegates to the same
 * mesh collider logic, with a slightly inflated radius for extra clearance.
 */
import { DRONE, FOREST } from '../config.js';
import { MeshCollider } from '../collision/MeshCollider.js';

export class ObstacleGrid {
  constructor(forestGenerator) {
    this.forest = forestGenerator;
    
    // Mesh-based collider using exact scene geometry
    this.collider = new MeshCollider();
    // Use a slightly larger radius so omniscient paths have a safety margin
    this.clearRadius = DRONE.SIZE / 2 + 0.3;
    this.collider.setDroneRadius(this.clearRadius);
    this.collider.setTargets(forestGenerator.getRaycastTargets());
  }
  
  /**
   * Check if a position is clear of obstacles and terrain
   */
  isPositionClear(x, y, z) {
    // Terrain constraint (similar to DronePhysics terrain check)
    const terrainY = this.forest.getTerrainHeight(x, z);
    const droneBottom = y - DRONE.SIZE * 0.175;
    if (droneBottom < terrainY) return false;
    
    // Simple canopy/ceiling guard to bound search vertically
    if (y + this.clearRadius > FOREST.CANOPY_HEIGHT) return false;
    
    // Mesh-based collision using the same collider algorithm as the drone
    const result = this.collider.checkCollision(x, y, z);
    return !result.collided;
  }
  
  /**
   * Check if straight line between two points is clear.
   * Uses swept mesh collision along the segment plus terrain checks.
   */
  isLineClear(from, to) {
    // Swept mesh collision along the path
    const result = this.collider.checkSweptCollision(
      from.x, from.y, from.z,
      to.x, to.y, to.z,
    );
    if (result.collided) return false;
    
    // Also ensure we don't clip terrain between endpoints
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const stepSize = Math.max(this.clearRadius * 0.5, 0.25);
    const steps = Math.max(1, Math.ceil(dist / stepSize));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      const z = from.z + dz * t;
      
      const terrainY = this.forest.getTerrainHeight(x, z);
      const droneBottom = y - DRONE.SIZE * 0.175;
      if (droneBottom < terrainY) {
        return false;
      }
    }
    
    return true;
  }
}

