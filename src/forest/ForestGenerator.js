/**
 * Procedural forest generator with Perlin noise terrain
 * OPTIMIZED: Uses InstancedMesh for trees and bushes
 * MODULAR: Each mesh component is in a separate file
 */
import * as THREE from 'three';
import { FOREST } from '../config.js';
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
   * Get terrain height at a given world position
   */
  getTerrainHeight(x, z) {
    const scale = FOREST.TERRAIN_SCALE;
    const height = FOREST.TERRAIN_HEIGHT;
    return this.perlin.fbm(x * scale, z * scale, 3, 2, 0.5) * height;
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
    
    // Seeded random
    let seed = this.seed * 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    // Collect tree data first
    const coniferData = [];
    const deciduousData = [];
    
    for (let i = 0; i < numTrees; i++) {
      const x = (random() - 0.5) * size;
      const z = (random() - 0.5) * size;
      
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      
      const y = this.getTerrainHeight(x, z);
      const isConifer = random() < FOREST.CONIFER_RATIO;
      
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
   * Generate a random target position
   */
  generateTargetPosition(currentX, currentZ, minDist = 25, maxDist = 60) {
    let seed = Date.now();
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    const halfSize = FOREST.SIZE / 2 - 10;
    
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = random() * Math.PI * 2;
      const dist = minDist + random() * (maxDist - minDist);
      
      let x = currentX + Math.cos(angle) * dist;
      let z = currentZ + Math.sin(angle) * dist;
      
      x = Math.max(-halfSize, Math.min(halfSize, x));
      z = Math.max(-halfSize, Math.min(halfSize, z));
      
      const groundY = this.getTerrainHeight(x, z);
      const y = groundY + FOREST.FLYING_HEIGHT_MIN + random() * 
        (FOREST.FLYING_HEIGHT_MAX - FOREST.FLYING_HEIGHT_MIN);
      
      return { x, y, z };
    }
    
    const groundY = this.getTerrainHeight(0, 0);
    return { x: 0, y: groundY + FOREST.FLYING_HEIGHT_MAX, z: 0 };
  }

  getForestGroup() {
    return this.forestGroup;
  }
}
