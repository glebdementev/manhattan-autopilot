/**
 * BoundsChecker - Handles world boundary collision detection
 * 
 * Checks if positions are within world bounds and provides
 * clamped positions when out of bounds.
 */
import * as THREE from 'three';

export class BoundsChecker {
  constructor() {
    this.worldBounds = new THREE.Box3();
  }
  
  /**
   * Set world bounds for boundary collision
   * @param {number} minX 
   * @param {number} maxX 
   * @param {number} minY 
   * @param {number} maxY 
   * @param {number} minZ 
   * @param {number} maxZ 
   */
  setWorldBounds(minX, maxX, minY, maxY, minZ, maxZ) {
    this.worldBounds.min.set(minX, minY, minZ);
    this.worldBounds.max.set(maxX, maxY, maxZ);
  }
  
  /**
   * Get current world bounds
   * @returns {THREE.Box3}
   */
  getWorldBounds() {
    return this.worldBounds.clone();
  }
  
  /**
   * Check if a position is within world bounds
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {THREE.Vector3} droneSize - Drone dimensions
   * @returns {Object} - { inBounds, clampedPosition }
   */
  checkBounds(x, y, z, droneSize) {
    const halfWidth = droneSize.x / 2;
    const halfHeight = droneSize.y / 2;
    const halfDepth = droneSize.z / 2;
    
    // Check if drone box would be within world bounds
    const droneMin = {
      x: x - halfWidth,
      y: y - halfHeight,
      z: z - halfDepth,
    };
    const droneMax = {
      x: x + halfWidth,
      y: y + halfHeight,
      z: z + halfDepth,
    };
    
    const inBounds = (
      droneMin.x >= this.worldBounds.min.x &&
      droneMax.x <= this.worldBounds.max.x &&
      droneMin.y >= this.worldBounds.min.y &&
      droneMax.y <= this.worldBounds.max.y &&
      droneMin.z >= this.worldBounds.min.z &&
      droneMax.z <= this.worldBounds.max.z
    );
    
    // Calculate clamped position if out of bounds
    const clampedX = Math.max(
      this.worldBounds.min.x + halfWidth,
      Math.min(this.worldBounds.max.x - halfWidth, x)
    );
    const clampedY = Math.max(
      this.worldBounds.min.y + halfHeight,
      Math.min(this.worldBounds.max.y - halfHeight, y)
    );
    const clampedZ = Math.max(
      this.worldBounds.min.z + halfDepth,
      Math.min(this.worldBounds.max.z - halfDepth, z)
    );
    
    return {
      inBounds,
      clampedPosition: { x: clampedX, y: clampedY, z: clampedZ },
    };
  }
}

