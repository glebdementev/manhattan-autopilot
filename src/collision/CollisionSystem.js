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

export class CollisionSystem {
  constructor() {
    // Drone bounding box (will be updated each frame)
    this.droneBox = new THREE.Box3();
    this.droneSize = new THREE.Vector3();
    
    // Obstacle bounding boxes (computed once per scene generation)
    this.obstacleBoxes = [];
    
    // Terrain reference
    this.terrainHeightFn = null;
    
    // World bounds
    this.worldBounds = new THREE.Box3();
    
    // Debug visualization
    this.debugHelpers = [];
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'collision-debug';
    this.debugEnabled = false;
    
    // Collision result cache
    this.lastCollisionResult = {
      collided: false,
      type: null,
      normal: new THREE.Vector3(),
      penetration: 0,
      obstacleIndex: -1,
    };
    
    // Temporary vectors for calculations (avoid allocations)
    this._tempBox = new THREE.Box3();
    this._tempVec = new THREE.Vector3();
    this._tempMin = new THREE.Vector3();
    this._tempMax = new THREE.Vector3();
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
    this.terrainHeightFn = heightFn;
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
   * Clear all obstacle boxes (call before regenerating scene)
   */
  clearObstacles() {
    this.obstacleBoxes = [];
    this.clearDebugHelpers();
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
    if (!this.terrainHeightFn) {
      return { collided: false, penetration: 0, terrainY: 0 };
    }
    
    const halfWidth = this.droneSize.x / 2;
    const halfHeight = this.droneSize.y / 2;
    const halfDepth = this.droneSize.z / 2;
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
      const terrainY = this.terrainHeightFn(point.x, point.z);
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
    
    for (let i = 0; i < this.obstacleBoxes.length; i++) {
      const obstacle = this.obstacleBoxes[i];
      
      // Broad phase: AABB intersection test (fast)
      if (this.droneBox.intersectsBox(obstacle.box)) {
        // Narrow phase: More precise cylinder-box test
        if (this.checkBoxCylinderCollision(this.droneBox, obstacle.cylinder)) {
          return {
            collided: true,
            type: obstacle.type,
            obstacleIndex: i,
            penetration: this.calculatePenetration(this.droneBox, obstacle.cylinder),
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
      const obstacle = this.obstacleBoxes[obstacleResult.obstacleIndex].cylinder;
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
    const halfWidth = this.droneSize.x / 2;
    const halfHeight = this.droneSize.y / 2;
    const halfDepth = this.droneSize.z / 2;
    
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
    this.debugEnabled = enabled;
    this.debugGroup.visible = enabled;
  }
  
  /**
   * Create debug visualization helpers
   * @param {THREE.Scene} scene 
   */
  createDebugHelpers(scene) {
    this.clearDebugHelpers();
    
    if (!this.debugEnabled) return;
    
    // Create box helpers for each obstacle
    const material = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
    
    for (const obstacle of this.obstacleBoxes) {
      const helper = new THREE.Box3Helper(obstacle.box, 0xff0000);
      this.debugHelpers.push(helper);
      this.debugGroup.add(helper);
    }
    
    // Create drone box helper
    const droneHelper = new THREE.Box3Helper(this.droneBox, 0x00ff00);
    droneHelper.name = 'drone-collision-box';
    this.debugHelpers.push(droneHelper);
    this.debugGroup.add(droneHelper);
    
    scene.add(this.debugGroup);
  }
  
  /**
   * Update debug visualization (call each frame if debug enabled)
   */
  updateDebugVisualization() {
    if (!this.debugEnabled) return;
    
    // Update drone box helper
    const droneHelper = this.debugGroup.getObjectByName('drone-collision-box');
    if (droneHelper) {
      droneHelper.box.copy(this.droneBox);
    }
  }
  
  /**
   * Clear all debug helpers
   */
  clearDebugHelpers() {
    for (const helper of this.debugHelpers) {
      if (helper.parent) {
        helper.parent.remove(helper);
      }
      if (helper.geometry) helper.geometry.dispose();
      if (helper.material) helper.material.dispose();
    }
    this.debugHelpers = [];
    
    // Clear children from debug group
    while (this.debugGroup.children.length > 0) {
      this.debugGroup.remove(this.debugGroup.children[0]);
    }
  }
  
  /**
   * Get the debug group for adding to scene
   * @returns {THREE.Group}
   */
  getDebugGroup() {
    return this.debugGroup;
  }
  
  /**
   * Get statistics about the collision system
   * @returns {Object}
   */
  getStats() {
    return {
      numObstacles: this.obstacleBoxes.length,
      droneSize: this.droneSize.clone(),
      worldBounds: this.worldBounds.clone(),
    };
  }
}

