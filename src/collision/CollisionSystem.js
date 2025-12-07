/**
 * CollisionSystem - Robust collision detection using Three.js Box3
 * 
 * This system uses proper AABB (Axis-Aligned Bounding Box) collision detection
 * with Three.js's built-in Box3 class for accuracy and performance.
 * 
 * Features:
 * - Uses THREE.Box3 for accurate AABB collision detection
 * - Swept collision detection to prevent tunneling through thin obstacles
 * - Proper terrain collision with height sampling
 * - Collision response information for physics
 * - Optional visualization for debugging
 */
import * as THREE from 'three';
import { TerrainCollider } from './TerrainCollider.js';
import { ObstacleCollider } from './ObstacleCollider.js';
import { BoundsChecker } from './BoundsChecker.js';
import { CollisionDebugger } from './CollisionDebugger.js';

export class CollisionSystem {
  constructor() {
    // Drone bounding box (will be updated each frame)
    this.droneBox = new THREE.Box3();
    this.droneSize = new THREE.Vector3();
    
    // Sub-systems
    this.terrainCollider = new TerrainCollider();
    this.obstacleCollider = new ObstacleCollider();
    this.boundsChecker = new BoundsChecker();
    this.debugger = new CollisionDebugger();
    
    // Collision result cache
    this.lastCollisionResult = {
      collided: false,
      type: null,
      normal: new THREE.Vector3(),
      penetration: 0,
      obstacleIndex: -1,
    };
    
    // Temporary vectors for calculations (avoid allocations)
    this._tempVec = new THREE.Vector3();
  }
  
  /**
   * Initialize the collision system with drone dimensions
   * @param {number} width - Drone width (X axis)
   * @param {number} height - Drone height (Y axis)
   * @param {number} depth - Drone depth (Z axis)
   */
  setDroneSize(width, height, depth) {
    this.droneSize.set(width, height, depth);
  }
  
  /**
   * Set the terrain height function
   * @param {Function} heightFn - Function(x, z) => y that returns terrain height
   */
  setTerrainHeightFunction(heightFn) {
    this.terrainCollider.setHeightFunction(heightFn);
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
    this.boundsChecker.setWorldBounds(minX, maxX, minY, maxY, minZ, maxZ);
  }
  
  // Legacy getter for worldBounds
  get worldBounds() {
    return this.boundsChecker.getWorldBounds();
  }
  
  // Legacy getter for obstacleBoxes
  get obstacleBoxes() {
    return this.obstacleCollider.getObstacles();
  }
  
  // Legacy getter for debugEnabled
  get debugEnabled() {
    return this.debugger.isEnabled();
  }
  
  // Legacy getter for debugGroup
  get debugGroup() {
    return this.debugger.getDebugGroup();
  }
  
  /**
   * Clear all obstacle boxes (call before regenerating scene)
   */
  clearObstacles() {
    this.obstacleCollider.clear();
    this.clearDebugHelpers();
  }
  
  /**
   * Add an obstacle from raw data
   * Converts cylindrical obstacle data to AABB
   * @param {Object} obstacle - { type, x, z, radius, minY, maxY }
   */
  addObstacle(obstacle) {
    this.obstacleCollider.addObstacle(obstacle);
  }
  
  /**
   * Add multiple obstacles at once
   * @param {Array} obstacles - Array of obstacle objects
   */
  addObstacles(obstacles) {
    this.obstacleCollider.addObstacles(obstacles);
  }
  
  /**
   * Update drone bounding box for current position
   * @param {number} x - Drone center X
   * @param {number} y - Drone center Y
   * @param {number} z - Drone center Z
   */
  updateDroneBox(x, y, z) {
    const halfWidth = this.droneSize.x / 2;
    const halfHeight = this.droneSize.y / 2;
    const halfDepth = this.droneSize.z / 2;
    
    this.droneBox.min.set(
      x - halfWidth,
      y - halfHeight,
      z - halfDepth
    );
    this.droneBox.max.set(
      x + halfWidth,
      y + halfHeight,
      z + halfDepth
    );
  }
  
  /**
   * Check terrain collision at a position
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number} z - Position Z
   * @returns {Object} - { collided, penetration, terrainY }
   */
  checkTerrainCollision(x, y, z) {
    return this.terrainCollider.checkCollision(x, y, z, this.droneSize);
  }
  
  /**
   * Check collision with obstacles at a position
   * Uses two-phase detection: broad phase (AABB) then narrow phase (cylinder)
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number} z - Position Z
   * @returns {Object} - { collided, type, obstacleIndex, penetration }
   */
  checkObstacleCollision(x, y, z) {
    // Update drone box for this position
    this.updateDroneBox(x, y, z);
    return this.obstacleCollider.checkCollision(this.droneBox);
  }
  
  /**
   * Main collision check - checks terrain and all obstacles
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number} z - Position Z
   * @returns {Object} - Full collision result
   */
  checkCollision(x, y, z) {
    // Reset result
    this.lastCollisionResult.collided = false;
    this.lastCollisionResult.type = null;
    this.lastCollisionResult.penetration = 0;
    this.lastCollisionResult.obstacleIndex = -1;
    this.lastCollisionResult.normal.set(0, 0, 0);
    
    // Check terrain first (most common collision)
    const terrainResult = this.checkTerrainCollision(x, y, z);
    if (terrainResult.collided) {
      this.lastCollisionResult.collided = true;
      this.lastCollisionResult.type = 'terrain';
      this.lastCollisionResult.penetration = terrainResult.penetration;
      this.lastCollisionResult.normal.set(0, 1, 0); // Terrain normal is up
      return { ...this.lastCollisionResult };
    }
    
    // Check obstacles
    const obstacleResult = this.checkObstacleCollision(x, y, z);
    if (obstacleResult.collided) {
      this.lastCollisionResult.collided = true;
      this.lastCollisionResult.type = obstacleResult.type;
      this.lastCollisionResult.penetration = obstacleResult.penetration;
      this.lastCollisionResult.obstacleIndex = obstacleResult.obstacleIndex;
      // Calculate normal direction (away from obstacle center)
      const obstacle = this.obstacleCollider.getObstacle(obstacleResult.obstacleIndex).cylinder;
      this._tempVec.set(x - obstacle.x, 0, z - obstacle.z).normalize();
      this.lastCollisionResult.normal.copy(this._tempVec);
      return { ...this.lastCollisionResult };
    }
    
    return { ...this.lastCollisionResult };
  }
  
  /**
   * Swept collision detection - checks multiple points along a movement path
   * Prevents tunneling through thin obstacles
   * @param {number} startX - Start position X
   * @param {number} startY - Start position Y
   * @param {number} startZ - Start position Z
   * @param {number} endX - End position X
   * @param {number} endY - End position Y
   * @param {number} endZ - End position Z
   * @returns {Object} - { collided, type, t (0-1 position along path), position }
   */
  checkSweptCollision(startX, startY, startZ, endX, endY, endZ) {
    const dx = endX - startX;
    const dy = endY - startY;
    const dz = endZ - startZ;
    const moveDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Determine step size based on smallest drone dimension
    // This ensures we never skip over obstacles thinner than the drone
    const minDimension = Math.min(this.droneSize.x, this.droneSize.y, this.droneSize.z);
    const stepSize = minDimension * 0.4; // 40% of smallest dimension for safety
    
    // Calculate number of steps needed
    const numSteps = Math.max(1, Math.ceil(moveDistance / stepSize));
    
    // Check collision at each point along the path
    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      const checkX = startX + dx * t;
      const checkY = startY + dy * t;
      const checkZ = startZ + dz * t;
      
      const collision = this.checkCollision(checkX, checkY, checkZ);
      if (collision.collided) {
        // Return the first collision point
        return {
          collided: true,
          type: collision.type,
          t: t,
          position: { x: checkX, y: checkY, z: checkZ },
          normal: collision.normal.clone(),
          penetration: collision.penetration,
        };
      }
    }
    
    return {
      collided: false,
      type: null,
      t: 1,
      position: { x: endX, y: endY, z: endZ },
      normal: new THREE.Vector3(),
      penetration: 0,
    };
  }
  
  /**
   * Check if a position is within world bounds
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {Object} - { inBounds, clampedPosition }
   */
  checkWorldBounds(x, y, z) {
    return this.boundsChecker.checkBounds(x, y, z, this.droneSize);
  }
  
  /**
   * Find a safe position near a collision point
   * Useful for resolving collisions without teleporting
   * @param {number} x - Current position X
   * @param {number} y - Current position Y
   * @param {number} z - Current position Z
   * @param {THREE.Vector3} normal - Collision normal
   * @param {number} penetration - Penetration depth
   * @returns {Object} - { x, y, z }
   */
  resolveCollision(x, y, z, normal, penetration) {
    // Push the position out along the collision normal
    const pushDistance = penetration + 0.01; // Small epsilon to ensure we're clear
    return {
      x: x + normal.x * pushDistance,
      y: y + normal.y * pushDistance,
      z: z + normal.z * pushDistance,
    };
  }
  
  // ===== DEBUG VISUALIZATION =====
  
  /**
   * Enable/disable debug visualization
   * @param {boolean} enabled 
   */
  setDebugEnabled(enabled) {
    this.debugger.setEnabled(enabled);
  }
  
  /**
   * Create debug visualization helpers
   * @param {THREE.Scene} scene 
   */
  createDebugHelpers(scene) {
    this.debugger.createHelpers(scene, this.obstacleCollider.getObstacles(), this.droneBox);
  }
  
  /**
   * Update debug visualization (call each frame if debug enabled)
   */
  updateDebugVisualization() {
    this.debugger.updateVisualization(this.droneBox);
  }
  
  /**
   * Clear all debug helpers
   */
  clearDebugHelpers() {
    this.debugger.clearHelpers();
  }
  
  /**
   * Get the debug group for adding to scene
   * @returns {THREE.Group}
   */
  getDebugGroup() {
    return this.debugger.getDebugGroup();
  }
  
  /**
   * Get statistics about the collision system
   * @returns {Object}
   */
  getStats() {
    return {
      numObstacles: this.obstacleCollider.getCount(),
      droneSize: this.droneSize.clone(),
      worldBounds: this.boundsChecker.getWorldBounds(),
    };
  }
}
