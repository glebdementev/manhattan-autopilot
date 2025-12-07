/**
 * ObstacleCollider - Handles obstacle collision detection
 * 
 * Uses spatial grid for O(1) lookups and box-cylinder collision test
 */

export class ObstacleCollider {
  constructor() {
    this.obstacles = [];
    
    // Spatial grid for fast lookups
    this.gridCellSize = 10; // 10 meter cells
    this.grid = new Map();
  }
  
  /**
   * Get grid cell key for a position
   */
  getCellKey(x, z) {
    const cellX = Math.floor(x / this.gridCellSize);
    const cellZ = Math.floor(z / this.gridCellSize);
    return `${cellX},${cellZ}`;
  }
  
  /**
   * Get all cell keys that an obstacle with given radius occupies
   */
  getObstacleCellKeys(x, z, radius) {
    const keys = [];
    const minCellX = Math.floor((x - radius) / this.gridCellSize);
    const maxCellX = Math.floor((x + radius) / this.gridCellSize);
    const minCellZ = Math.floor((z - radius) / this.gridCellSize);
    const maxCellZ = Math.floor((z + radius) / this.gridCellSize);
    
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        keys.push(`${cx},${cz}`);
      }
    }
    return keys;
  }
  
  /**
   * Clear all obstacles
   */
  clear() {
    this.obstacles = [];
    this.grid.clear();
  }
  
  /**
   * Add an obstacle from raw data
   * @param {Object} obstacle - { type, x, z, radius, minY, maxY }
   */
  addObstacle(obstacle) {
    const obs = {
      type: obstacle.type,
      x: obstacle.x,
      z: obstacle.z,
      radius: obstacle.radius,
      minY: obstacle.minY,
      maxY: obstacle.maxY,
    };
    this.obstacles.push(obs);
    
    // Add to spatial grid
    const cellKeys = this.getObstacleCellKeys(obs.x, obs.z, obs.radius);
    for (const key of cellKeys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key).push(obs);
    }
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
   * Get nearby obstacles using spatial grid
   */
  getNearbyObstacles(x, z, radius) {
    const checked = new Set();
    const nearby = [];
    
    // Check cells that could contain relevant obstacles
    const minCellX = Math.floor((x - radius) / this.gridCellSize);
    const maxCellX = Math.floor((x + radius) / this.gridCellSize);
    const minCellZ = Math.floor((z - radius) / this.gridCellSize);
    const maxCellZ = Math.floor((z + radius) / this.gridCellSize);
    
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const obs of cell) {
            // Avoid duplicates (obstacles can span multiple cells)
            const obsId = `${obs.x},${obs.z}`;
            if (!checked.has(obsId)) {
              checked.add(obsId);
              nearby.push(obs);
            }
          }
        }
      }
    }
    
    return nearby;
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
    
    // Only check nearby obstacles (spatial grid lookup)
    const searchRadius = Math.max(halfWidth, halfDepth) + 10; // 10m max obstacle radius
    const nearbyObstacles = this.getNearbyObstacles(x, z, searchRadius);
    
    for (const obstacle of nearbyObstacles) {
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
