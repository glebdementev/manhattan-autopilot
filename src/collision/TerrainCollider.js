/**
 * TerrainCollider - Handles terrain collision detection
 * 
 * Samples terrain height at multiple points under the drone
 * to properly handle uneven terrain.
 */

export class TerrainCollider {
  constructor() {
    this.heightFn = null;
  }
  
  /**
   * Set the terrain height function
   * @param {Function} heightFn - Function(x, z) => y that returns terrain height
   */
  setHeightFunction(heightFn) {
    this.heightFn = heightFn;
  }
  
  /**
   * Check terrain collision at a position
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number} z - Position Z
   * @param {THREE.Vector3} droneSize - Drone dimensions
   * @returns {Object} - { collided, penetration, terrainY }
   */
  checkCollision(x, y, z, droneSize) {
    if (!this.heightFn) {
      return { collided: false, penetration: 0, terrainY: 0 };
    }
    
    const halfWidth = droneSize.x / 2;
    const halfHeight = droneSize.y / 2;
    const halfDepth = droneSize.z / 2;
    const droneBottomY = y - halfHeight;
    
    // Sample terrain at multiple points under the drone
    // This handles uneven terrain properly
    const samplePoints = [
      { x: x, z: z },                           // Center
      { x: x - halfWidth, z: z - halfDepth },   // Corner 1
      { x: x + halfWidth, z: z - halfDepth },   // Corner 2
      { x: x - halfWidth, z: z + halfDepth },   // Corner 3
      { x: x + halfWidth, z: z + halfDepth },   // Corner 4
      { x: x, z: z - halfDepth },               // Edge midpoint 1
      { x: x, z: z + halfDepth },               // Edge midpoint 2
      { x: x - halfWidth, z: z },               // Edge midpoint 3
      { x: x + halfWidth, z: z },               // Edge midpoint 4
    ];
    
    let maxTerrainY = -Infinity;
    
    for (const point of samplePoints) {
      const terrainY = this.heightFn(point.x, point.z);
      if (terrainY > maxTerrainY) {
        maxTerrainY = terrainY;
      }
    }
    
    const penetration = maxTerrainY - droneBottomY;
    
    return {
      collided: penetration > 0,
      penetration: Math.max(0, penetration),
      terrainY: maxTerrainY,
    };
  }
}

