/**
 * ObstacleCollider - Handles obstacle collision detection
 * 
 * Uses two-phase detection:
 * - Broad phase: AABB intersection test (fast)
 * - Narrow phase: Box-cylinder collision test (precise)
 */
import * as THREE from 'three';

export class ObstacleCollider {
  constructor() {
    this.obstacleBoxes = [];
  }
  
  /**
   * Clear all obstacle boxes (call before regenerating scene)
   */
  clear() {
    this.obstacleBoxes = [];
  }
  
  /**
   * Add an obstacle from raw data
   * Converts cylindrical obstacle data to AABB
   * @param {Object} obstacle - { type, x, z, radius, minY, maxY }
   */
  addObstacle(obstacle) {
    // Convert cylinder to AABB
    // For a cylinder at (x, z) with radius r, the AABB is:
    // min: (x - r, minY, z - r)
    // max: (x + r, maxY, z + r)
    const box = new THREE.Box3(
      new THREE.Vector3(
        obstacle.x - obstacle.radius,
        obstacle.minY,
        obstacle.z - obstacle.radius
      ),
      new THREE.Vector3(
        obstacle.x + obstacle.radius,
        obstacle.maxY,
        obstacle.z + obstacle.radius
      )
    );
    
    this.obstacleBoxes.push({
      box,
      type: obstacle.type,
      // Store original cylinder data for more precise checks if needed
      cylinder: {
        x: obstacle.x,
        z: obstacle.z,
        radius: obstacle.radius,
        minY: obstacle.minY,
        maxY: obstacle.maxY,
      }
    });
  }
  
  /**
   * Add multiple obstacles at once
   * @param {Array} obstacles - Array of obstacle objects
   */
  addObstacles(obstacles) {
    for (const obstacle of obstacles) {
      this.addObstacle(obstacle);
    }
  }
  
  /**
   * Get obstacle by index
   * @param {number} index 
   * @returns {Object|null}
   */
  getObstacle(index) {
    return this.obstacleBoxes[index] || null;
  }
  
  /**
   * Get all obstacles
   * @returns {Array}
   */
  getObstacles() {
    return this.obstacleBoxes;
  }
  
  /**
   * Get obstacle count
   * @returns {number}
   */
  getCount() {
    return this.obstacleBoxes.length;
  }
  
  /**
   * Check collision with obstacles at a position
   * @param {THREE.Box3} droneBox - The drone's bounding box
   * @returns {Object} - { collided, type, obstacleIndex, penetration }
   */
  checkCollision(droneBox) {
    for (let i = 0; i < this.obstacleBoxes.length; i++) {
      const obstacle = this.obstacleBoxes[i];
      
      // Broad phase: AABB intersection test (fast)
      if (droneBox.intersectsBox(obstacle.box)) {
        // Narrow phase: More precise cylinder-box test
        if (this.checkBoxCylinderCollision(droneBox, obstacle.cylinder)) {
          return {
            collided: true,
            type: obstacle.type,
            obstacleIndex: i,
            penetration: this.calculatePenetration(droneBox, obstacle.cylinder),
          };
        }
      }
    }
    
    return {
      collided: false,
      type: null,
      obstacleIndex: -1,
      penetration: 0,
    };
  }
  
  /**
   * Precise box-cylinder collision test
   * @param {THREE.Box3} box - The drone's bounding box
   * @param {Object} cylinder - { x, z, radius, minY, maxY }
   * @returns {boolean}
   */
  checkBoxCylinderCollision(box, cylinder) {
    // First check vertical overlap
    if (box.max.y < cylinder.minY || box.min.y > cylinder.maxY) {
      return false;
    }
    
    // Find the closest point on the box to the cylinder axis (in XZ plane)
    const closestX = Math.max(box.min.x, Math.min(cylinder.x, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(cylinder.z, box.max.z));
    
    // Calculate squared distance from closest point to cylinder center
    const dx = closestX - cylinder.x;
    const dz = closestZ - cylinder.z;
    const distSquared = dx * dx + dz * dz;
    
    // Collision if distance is less than radius
    return distSquared < cylinder.radius * cylinder.radius;
  }
  
  /**
   * Calculate penetration depth for box-cylinder collision
   * @param {THREE.Box3} box 
   * @param {Object} cylinder 
   * @returns {number}
   */
  calculatePenetration(box, cylinder) {
    const closestX = Math.max(box.min.x, Math.min(cylinder.x, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(cylinder.z, box.max.z));
    
    const dx = closestX - cylinder.x;
    const dz = closestZ - cylinder.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    return Math.max(0, cylinder.radius - dist);
  }
}

