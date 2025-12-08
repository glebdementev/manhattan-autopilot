/**
 * Procedural forest generator with Perlin noise terrain
 * OPTIMIZED: Uses InstancedMesh for trees and bushes
 * MODULAR: Each mesh component is in a separate file
 */
import * as THREE from 'three';
import { FOREST, DRONE, TARGET } from '../config.js';
import { PerlinNoise } from './PerlinNoise.js';
import { TerrainMesh } from './TerrainMesh.js';
import { ConiferMesh } from './ConiferMesh.js';
import { DeciduousMesh } from './DeciduousMesh.js';
import { BushMesh } from './BushMesh.js';

export class ForestGenerator {
  constructor(seed = 42) {
    this.seed = seed;
    this.perlin = new PerlinNoise(seed);
    
    this.forestGroup = new THREE.Group();
    this.forestGroup.name = 'forest';
    
    // Mesh components
    this.terrainMesh = null;
    this.coniferMesh = null;
    this.deciduousMesh = null;
    this.bushMesh = null;
    
    // Store obstacle data for collision/raycasting
    this.obstacles = [];
    
    // Raycast targets (simplified)
    this.raycastTargets = [];
    
    // Terrain height cache for performance
    this.heightCache = new Map();
    this.heightCacheResolution = 0.5; // Cache resolution in meters
    this.heightCacheMaxSize = 10000;
  }

  /**
   * Generate the complete forest
   */
  generate() {
    console.log('Generating forest terrain...');
    this.createTerrain();
    
    console.log('Planting trees...');
    this.createTrees();
    
    console.log('Adding bushes...');
    this.createBushes();
    
    console.log('Forest generation complete!');
    return this.forestGroup;
  }

  /**
   * Get terrain height at a given world position (cached)
   */
  getTerrainHeight(x, z) {
    // Quantize position for cache lookup
    const res = this.heightCacheResolution;
    const qx = Math.round(x / res) * res;
    const qz = Math.round(z / res) * res;
    const key = `${qx},${qz}`;
    
    // Check cache
    let h = this.heightCache.get(key);
    if (h !== undefined) {
      return h;
    }
    
    // Compute height
    const scale = FOREST.TERRAIN_SCALE;
    const height = FOREST.TERRAIN_HEIGHT;
    h = this.perlin.fbm(qx * scale, qz * scale, 3, 2, 0.5) * height;
    
    // Store in cache (with size limit)
    if (this.heightCache.size >= this.heightCacheMaxSize) {
      // Clear oldest entries (simple strategy: clear half)
      const entries = Array.from(this.heightCache.keys());
      for (let i = 0; i < entries.length / 2; i++) {
        this.heightCache.delete(entries[i]);
      }
    }
    this.heightCache.set(key, h);
    
    return h;
  }
  
  /**
   * Clear terrain height cache (call on regeneration)
   */
  clearHeightCache() {
    this.heightCache.clear();
  }

  /**
   * Create terrain mesh using Perlin noise
   */
  createTerrain() {
    this.terrainMesh = new TerrainMesh(this.perlin);
    const mesh = this.terrainMesh.create();
    this.forestGroup.add(mesh);
    this.raycastTargets.push(mesh);
  }

  /**
   * Create trees using InstancedMesh for performance
   */
  createTrees() {
    const size = FOREST.SIZE;
    const density = FOREST.TREE_DENSITY;
    const numTrees = Math.floor(size * size * density);
    
    // Minimum distance between trees (meters)
    const MIN_TREE_DISTANCE = 6;
    const minDistSq = MIN_TREE_DISTANCE * MIN_TREE_DISTANCE;
    
    // Seeded random
    let seed = this.seed * 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    // Collect tree data first
    const coniferData = [];
    const deciduousData = [];
    
    // Track all placed tree positions for distance checking
    const placedTrees = [];
    
    for (let i = 0; i < numTrees; i++) {
      const x = (random() - 0.5) * size;
      const z = (random() - 0.5) * size;
      
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      
      // Check minimum distance to all placed trees
      let tooClose = false;
      for (const tree of placedTrees) {
        const dx = x - tree.x;
        const dz = z - tree.z;
        if (dx * dx + dz * dz < minDistSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      const y = this.getTerrainHeight(x, z);
      const isConifer = random() < FOREST.CONIFER_RATIO;
      
      // Add to placed trees list
      placedTrees.push({ x, z });
      
      if (isConifer) {
        // Reduced height variation (0.85 to 1.0 multiplier instead of random range)
        const heightVariation = 0.85 + random() * 0.15;
        const height = FOREST.CONIFER_MIN_HEIGHT + 
          (FOREST.CONIFER_MAX_HEIGHT - FOREST.CONIFER_MIN_HEIGHT) * heightVariation;
        const radius = FOREST.CONIFER_CROWN_RADIUS * (0.9 + random() * 0.2);
        coniferData.push({ x, y, z, height, radius, rotation: random() * Math.PI * 2 });
      } else {
        // Reduced height variation for deciduous too
        const heightVariation = 0.85 + random() * 0.15;
        const height = FOREST.DECIDUOUS_MIN_HEIGHT + 
          (FOREST.DECIDUOUS_MAX_HEIGHT - FOREST.DECIDUOUS_MIN_HEIGHT) * heightVariation;
        const radius = FOREST.DECIDUOUS_CROWN_RADIUS * (0.9 + random() * 0.2);
        deciduousData.push({ x, y, z, height, radius, rotation: random() * Math.PI * 2 });
      }
    }
    
    // Create conifer instances
    if (coniferData.length > 0) {
      this.coniferMesh = new ConiferMesh();
      const result = this.coniferMesh.create(coniferData);
      result.meshes.forEach(mesh => {
        this.forestGroup.add(mesh);
        this.raycastTargets.push(mesh);
      });
      this.obstacles.push(...result.obstacles);
    }
    
    // Create deciduous instances
    if (deciduousData.length > 0) {
      this.deciduousMesh = new DeciduousMesh();
      const result = this.deciduousMesh.create(deciduousData);
      result.meshes.forEach(mesh => {
        this.forestGroup.add(mesh);
        this.raycastTargets.push(mesh);
      });
      this.obstacles.push(...result.obstacles);
    }
  }

  /**
   * Create bushes using InstancedMesh
   */
  createBushes() {
    const size = FOREST.SIZE;
    const density = FOREST.BUSH_DENSITY;
    const numBushes = Math.floor(size * size * density);
    
    let seed = this.seed * 13;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    // Collect bush data
    const bushData = [];
    
    for (let i = 0; i < numBushes; i++) {
      const x = (random() - 0.5) * size;
      const z = (random() - 0.5) * size;
      
      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
      
      const y = this.getTerrainHeight(x, z);
      const bushSize = FOREST.BUSH_MIN_SIZE + random() * (FOREST.BUSH_MAX_SIZE - FOREST.BUSH_MIN_SIZE);
      
      bushData.push({ x, y, z, size: bushSize });
    }
    
    if (bushData.length === 0) return;
    
    this.bushMesh = new BushMesh();
    const result = this.bushMesh.create(bushData);
    result.meshes.forEach(mesh => {
      this.forestGroup.add(mesh);
      this.raycastTargets.push(mesh);
    });
    this.obstacles.push(...result.obstacles);
  }

  /**
   * Get all obstacles for collision detection
   */
  getObstacles() {
    return this.obstacles;
  }

  /**
   * Get objects for raycasting (optimized - fewer objects)
   */
  getRaycastTargets() {
    return this.raycastTargets;
  }

  /**
   * Find a valid spawn position
   */
  findSpawnPosition() {
    const x = 0;
    const z = 0;
    const groundY = this.getTerrainHeight(x, z);
    const y = groundY + FOREST.FLYING_HEIGHT_MIN + 2;
    return { x, y, z };
  }

  /**
   * Generate a target position - STRAIGHT AHEAD, NO ROTATION
   * Target is at SAME X as drone, just different Z (forward)
   * Ensures target is at least 2m away from nearest tree or bush
   */
  generateTargetPosition(
    currentX,
    currentZ,
    minDist = TARGET.MIN_DISTANCE,
    maxDist = TARGET.MAX_DISTANCE,
    seed = Date.now()
  ) {
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    let bestTarget = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 50;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      
      // Target at SAME X, just forward in Z
      const x = currentX; // SAME X - no angle!
      const dist = minDist + random() * (maxDist - minDist);
      const z = currentZ - dist; // Forward is -Z
      
      const groundY = this.getTerrainHeight(x, z);
      const y = groundY + 1.5; // Same height as drone spawn
      
      // Check distance to nearest tree
      if (this.isPositionValidForTarget(x, z)) {
        return { x, y, z };
      }
      
      // Store last generated as fallback
      bestTarget = { x, y, z };
    }
    
    console.warn("Could not find valid target position far enough from trees, using fallback");
    return bestTarget;
  }

  /**
   * Check if position is valid for target (at least 2m from any tree or bush)
   */
  isPositionValidForTarget(x, z) {
    const MIN_DISTANCE = 2.0;
    
    for (const obstacle of this.obstacles) {
      // Check trunks and bushes (skip canopies)
      if (obstacle.type === 'trunk' || obstacle.type === 'bush') {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        // Distance from center must be > 2m + radius
        if (dist < MIN_DISTANCE + obstacle.radius) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Check if a target position has the required clearance
   * Only checks trunk collisions, ignores canopy (crown) obstacles
   */
  isTargetPositionClear(x, y, z, margin = 0.25) {
    // Box bounds for target clearance
    const boxMinX = x - margin;
    const boxMaxX = x + margin;
    const boxMinY = y - margin;
    const boxMaxY = y + margin;
    const boxMinZ = z - margin;
    const boxMaxZ = z + margin;
    
    // Check terrain clearance
    const terrainY = this.getTerrainHeight(x, z);
    if (boxMinY < terrainY) {
      return false;
    }
    
    // Check only trunk obstacles (not canopies)
    for (const obstacle of this.obstacles) {
      // Skip canopy obstacles - only check trunks
      if (obstacle.type === 'canopy' || obstacle.type === 'crown') {
        continue;
      }
      
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
   * Check if a position is clear of obstacles using box-based collision
   * Uses drone box dimensions for accurate clearance checking
   */
  isPositionClear(x, y, z, margin = 0.5) {
    // Drone box dimensions with margin
    const halfWidth = DRONE.SIZE / 2 + margin;
    const halfHeight = DRONE.SIZE * 0.35 / 2 + margin;
    const halfDepth = DRONE.SIZE / 2 + margin;
    
    // Box bounds
    const boxMinX = x - halfWidth;
    const boxMaxX = x + halfWidth;
    const boxMinY = y - halfHeight;
    const boxMaxY = y + halfHeight;
    const boxMinZ = z - halfDepth;
    const boxMaxZ = z + halfDepth;
    
    // Check terrain clearance at all corners and center
    const checkPoints = [
      { x: x, z: z },
      { x: boxMinX, z: boxMinZ },
      { x: boxMaxX, z: boxMinZ },
      { x: boxMinX, z: boxMaxZ },
      { x: boxMaxX, z: boxMaxZ },
    ];
    
    for (const point of checkPoints) {
      const terrainY = this.getTerrainHeight(point.x, point.z);
      if (boxMinY < terrainY) {
        return false;
      }
    }
    
    // Check obstacle clearance using box-cylinder intersection
    for (const obstacle of this.obstacles) {
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
    // First check vertical overlap
    if (boxMaxY < obstacle.minY || boxMinY > obstacle.maxY) {
      return false;
    }
    
    // Find the closest point on the box to the cylinder center
    const closestX = Math.max(boxMinX, Math.min(obstacle.x, boxMaxX));
    const closestZ = Math.max(boxMinZ, Math.min(obstacle.z, boxMaxZ));
    
    // Calculate distance from closest point to cylinder center
    const dx = closestX - obstacle.x;
    const dz = closestZ - obstacle.z;
    const distSquared = dx * dx + dz * dz;
    
    // Check if distance is less than cylinder radius
    return distSquared < obstacle.radius * obstacle.radius;
  }
  
  /**
   * Check if a path between two points is clear of obstacles
   * Uses box-based collision checking along the path
   */
  isPathClear(startX, startY, startZ, endX, endY, endZ, margin = 0.5) {
    const dx = endX - startX;
    const dy = endY - startY;
    const dz = endZ - startZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Check points along the path
    const stepSize = DRONE.SIZE * 0.5; // Check every half-drone-size
    const numSteps = Math.max(1, Math.ceil(dist / stepSize));
    
    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const x = startX + dx * t;
      const y = startY + dy * t;
      const z = startZ + dz * t;
      
      if (!this.isPositionClear(x, y, z, margin)) {
        return false;
      }
    }
    
    return true;
  }

  getForestGroup() {
    return this.forestGroup;
  }
}
