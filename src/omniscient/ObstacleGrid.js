/**
 * ObstacleGrid - clearance checking for A* pathfinding
 * 
 * Uses simplified terrain checks (center point only) to avoid
 * false rejections on sloped terrain at low flying heights.
 */
import { DRONE } from '../config.js';

// Safety margin for obstacle avoidance
const CLEAR_MARGIN = 0.5;
// Minimum height above terrain
const MIN_TERRAIN_CLEARANCE = 0.3;

export class ObstacleGrid {
  constructor(forestGenerator) {
    this.forest = forestGenerator;
  }
  
  /**
   * Check if a position is clear of obstacles and terrain.
   * Uses center-point terrain check to avoid false rejections on slopes.
   */
  isPositionClear(x, y, z, margin = CLEAR_MARGIN) {
    // Check terrain clearance at center only (avoids slope issues)
    const terrainY = this.forest.getTerrainHeight(x, z);
    if (y - MIN_TERRAIN_CLEARANCE < terrainY) {
      return false;
    }
    
    // Check obstacle clearance using box-cylinder intersection
    const halfSize = DRONE.SIZE / 2 + margin;
    const boxMinX = x - halfSize;
    const boxMaxX = x + halfSize;
    const boxMinY = y - halfSize;
    const boxMaxY = y + halfSize;
    const boxMinZ = z - halfSize;
    const boxMaxZ = z + halfSize;
    
    for (const obstacle of this.forest.getObstacles()) {
      if (this.checkBoxCylinderIntersection(
        boxMinX, boxMaxX, boxMinY, boxMaxY, boxMinZ, boxMaxZ,
        obstacle
      )) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check box-cylinder intersection
   */
  checkBoxCylinderIntersection(boxMinX, boxMaxX, boxMinY, boxMaxY, boxMinZ, boxMaxZ, obstacle) {
    // Check vertical overlap
    if (boxMaxY < obstacle.minY || boxMinY > obstacle.maxY) {
      return false;
    }
    
    // Find closest point on box to cylinder center
    const closestX = Math.max(boxMinX, Math.min(obstacle.x, boxMaxX));
    const closestZ = Math.max(boxMinZ, Math.min(obstacle.z, boxMaxZ));
    
    // Check distance to cylinder
    const dx = closestX - obstacle.x;
    const dz = closestZ - obstacle.z;
    return dx * dx + dz * dz < obstacle.radius * obstacle.radius;
  }
  
  /**
   * Check if straight line between two points is clear.
   */
  isLineClear(from, to, margin = CLEAR_MARGIN) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const stepSize = DRONE.SIZE * 0.5;
    const numSteps = Math.max(1, Math.ceil(dist / stepSize));
    
    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      const z = from.z + dz * t;
      
      if (!this.isPositionClear(x, y, z, margin)) {
        return false;
      }
    }
    
    return true;
  }
  
  getClearMargin() {
    return CLEAR_MARGIN;
  }
  
  getSoftMargin() {
    return CLEAR_MARGIN * 0.5;
  }
}

