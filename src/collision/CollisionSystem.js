/**
 * CollisionSystem - Simple and robust collision detection
 * 
 * Features:
 * - Terrain collision with height sampling
 * - Obstacle collision (trunks, canopies, bushes)
 * - Swept collision detection to prevent tunneling
 */
import * as THREE from 'three';
import { TerrainCollider } from './TerrainCollider.js';
import { ObstacleCollider } from './ObstacleCollider.js';
import { BoundsChecker } from './BoundsChecker.js';

export class CollisionSystem {
  constructor() {
    this.droneSize = new THREE.Vector3();
    
    // Sub-systems
    this.terrainCollider = new TerrainCollider();
    this.obstacleCollider = new ObstacleCollider();
    this.boundsChecker = new BoundsChecker();
  }
  
  /**
   * Initialize the collision system with drone dimensions
   */
  setDroneSize(width, height, depth) {
    this.droneSize.set(width, height, depth);
  }
  
  /**
   * Set the terrain height function
   */
  setTerrainHeightFunction(heightFn) {
    this.terrainCollider.setHeightFunction(heightFn);
  }
  
  /**
   * Set world bounds for boundary collision
   */
  setWorldBounds(minX, maxX, minY, maxY, minZ, maxZ) {
    this.boundsChecker.setWorldBounds(minX, maxX, minY, maxY, minZ, maxZ);
  }
  
  /**
   * Clear all obstacle boxes (call before regenerating scene)
   */
  clearObstacles() {
    this.obstacleCollider.clear();
  }
  
  /**
   * Add an obstacle from raw data
   */
  addObstacle(obstacle) {
    this.obstacleCollider.addObstacle(obstacle);
  }
  
  /**
   * Add multiple obstacles at once
   */
  addObstacles(obstacles) {
    this.obstacleCollider.addObstacles(obstacles);
  }
  
  /**
   * Check terrain collision at a position
   */
  checkTerrainCollision(x, y, z) {
    return this.terrainCollider.checkCollision(x, y, z, this.droneSize);
  }
  
  /**
   * Check collision with obstacles at a position
   */
  checkObstacleCollision(x, y, z) {
    return this.obstacleCollider.checkCollisionAtPosition(x, y, z, this.droneSize);
  }
  
  /**
   * Main collision check - checks terrain and all obstacles
   */
  checkCollision(x, y, z) {
    // Check terrain first (most common collision)
    const terrainResult = this.checkTerrainCollision(x, y, z);
    if (terrainResult.collided) {
      return {
        collided: true,
        type: 'terrain',
        penetration: terrainResult.penetration,
      };
    }
    
    // Check obstacles
    const obstacleResult = this.checkObstacleCollision(x, y, z);
    if (obstacleResult.collided) {
      return {
        collided: true,
        type: obstacleResult.type,
        penetration: obstacleResult.penetration,
      };
    }
    
    return { collided: false, type: null, penetration: 0 };
  }
  
  /**
   * Swept collision detection - checks multiple points along a movement path
   * Prevents tunneling through thin obstacles
   */
  checkSweptCollision(startX, startY, startZ, endX, endY, endZ) {
    const dx = endX - startX;
    const dy = endY - startY;
    const dz = endZ - startZ;
    const moveDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (moveDistance < 0.001) {
      return { collided: false, type: null, t: 1, position: { x: endX, y: endY, z: endZ } };
    }
    
    // Step size based on smallest drone dimension for safety
    const minDimension = Math.min(this.droneSize.x, this.droneSize.y, this.droneSize.z);
    const stepSize = minDimension * 0.3;
    const numSteps = Math.max(2, Math.ceil(moveDistance / stepSize));
    
    // Check collision at each point along the path
    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      const checkX = startX + dx * t;
      const checkY = startY + dy * t;
      const checkZ = startZ + dz * t;
      
      const collision = this.checkCollision(checkX, checkY, checkZ);
      if (collision.collided) {
        return {
          collided: true,
          type: collision.type,
          t: t,
          position: { x: checkX, y: checkY, z: checkZ },
          penetration: collision.penetration,
        };
      }
    }
    
    return {
      collided: false,
      type: null,
      t: 1,
      position: { x: endX, y: endY, z: endZ },
      penetration: 0,
    };
  }
  
  /**
   * Check if a position is within world bounds
   */
  checkWorldBounds(x, y, z) {
    return this.boundsChecker.checkBounds(x, y, z, this.droneSize);
  }
}
