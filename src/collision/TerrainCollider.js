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
    
    const halfHeight = droneSize.y / 2;
    const droneBottomY = y - halfHeight;
    
    // Sample terrain at center point
    const terrainY = this.heightFn(x, z);
    const penetration = terrainY - droneBottomY;
    const collided = penetration > 0;
    
    return {
      collided,
      penetration: Math.max(0, penetration),
      terrainY,
    };
  }
}

