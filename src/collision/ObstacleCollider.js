/**
 * ObstacleCollider - Handles obstacle collision detection
 * 
 * Uses box-cylinder collision test for accurate detection
 */

export class ObstacleCollider {
  constructor() {
    this.obstacles = [];
  }
  
  /**
   * Clear all obstacles
   */
  clear() {
    this.obstacles = [];
  }
  
  /**
   * Add an obstacle from raw data
   * @param {Object} obstacle - { type, x, z, radius, minY, maxY }
   */
  addObstacle(obstacle) {
    this.obstacles.push({
      type: obstacle.type,
      x: obstacle.x,
      z: obstacle.z,
      radius: obstacle.radius,
      minY: obstacle.minY,
      maxY: obstacle.maxY,
    });
  }
  
  /**
   * Add multiple obstacles at once
   */
  addObstacles(obstacles) {
    for (const obstacle of obstacles) {
      this.addObstacle(obstacle);
    }
  }
  
  /**
   * Get obstacle count
   */
  getCount() {
    return this.obstacles.length;
  }
  
  /**
   * Check collision at a position with drone dimensions
   * @param {number} x - Drone center X
   * @param {number} y - Drone center Y
   * @param {number} z - Drone center Z
   * @param {THREE.Vector3} droneSize - Drone dimensions
   */
  checkCollisionAtPosition(x, y, z, droneSize) {
    const halfWidth = droneSize.x / 2;
    const halfHeight = droneSize.y / 2;
    const halfDepth = droneSize.z / 2;
    
    // Drone bounding box
    const boxMinX = x - halfWidth;
    const boxMaxX = x + halfWidth;
    const boxMinY = y - halfHeight;
    const boxMaxY = y + halfHeight;
    const boxMinZ = z - halfDepth;
    const boxMaxZ = z + halfDepth;
    
    for (const obstacle of this.obstacles) {
      if (this.checkBoxCylinderCollision(
        boxMinX, boxMaxX, boxMinY, boxMaxY, boxMinZ, boxMaxZ,
        obstacle
      )) {
        return {
          collided: true,
          type: obstacle.type,
          penetration: this.calculatePenetration(x, z, obstacle),
        };
      }
    }
    
    return { collided: false, type: null, penetration: 0 };
  }
  
  /**
   * Check box-cylinder collision
   */
  checkBoxCylinderCollision(boxMinX, boxMaxX, boxMinY, boxMaxY, boxMinZ, boxMaxZ, cylinder) {
    // First check vertical overlap
    if (boxMaxY < cylinder.minY || boxMinY > cylinder.maxY) {
      return false;
    }
    
    // Find the closest point on the box to the cylinder axis (in XZ plane)
    const closestX = Math.max(boxMinX, Math.min(cylinder.x, boxMaxX));
    const closestZ = Math.max(boxMinZ, Math.min(cylinder.z, boxMaxZ));
    
    // Calculate squared distance from closest point to cylinder center
    const dx = closestX - cylinder.x;
    const dz = closestZ - cylinder.z;
    const distSquared = dx * dx + dz * dz;
    
    // Collision if distance is less than radius
    return distSquared < cylinder.radius * cylinder.radius;
  }
  
  /**
   * Calculate penetration depth
   */
  calculatePenetration(x, z, cylinder) {
    const dx = x - cylinder.x;
    const dz = z - cylinder.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return Math.max(0, cylinder.radius - dist);
  }
}
