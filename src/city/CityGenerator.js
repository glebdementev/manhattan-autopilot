/**
 * Procedural city mesh generator
 * Creates a Manhattan-style grid city with roads, sidewalks, and buildings
 */
import * as THREE from 'three';
import { CITY, COLORS } from '../config.js';
import {
  createRoadMaterial,
  createSidewalkMaterial,
  createBuildingMaterial,
  createGroundMaterial,
} from './materials.js';

export class CityGenerator {
  constructor() {
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'city';
    
    // Separate groups for different elements (for raycasting)
    this.roadsGroup = new THREE.Group();
    this.roadsGroup.name = 'roads';
    
    this.sidewalksGroup = new THREE.Group();
    this.sidewalksGroup.name = 'sidewalks';
    
    this.buildingsGroup = new THREE.Group();
    this.buildingsGroup.name = 'buildings';
    
    this.cityGroup.add(this.roadsGroup);
    this.cityGroup.add(this.sidewalksGroup);
    this.cityGroup.add(this.buildingsGroup);
    
    // Track road positions for network generation
    this.roadSegments = [];
    this.intersections = [];
  }

  /**
   * Generate the complete city
   */
  generate() {
    this.createGround();
    this.createRoadPlane();
    this.createSidewalks();
    this.createBuildings();
    this.calculateIntersections();
    
    return this.cityGroup;
  }

  /**
   * Get the total city size
   */
  getCitySize() {
    const totalSize = CITY.GRID_SIZE * (CITY.BLOCK_SIZE + CITY.ROAD_WIDTH) + CITY.ROAD_WIDTH;
    return totalSize;
  }

  /**
   * Get city center offset (city is centered at origin)
   */
  getCityOffset() {
    return -this.getCitySize() / 2;
  }

  /**
   * Create ground plane (grass/terrain outside city)
   */
  createGround() {
    const size = this.getCitySize() + 100;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = createGroundMaterial();
    
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1; // Well below road to prevent z-fighting
    ground.receiveShadow = true;
    ground.name = 'ground';
    
    this.cityGroup.add(ground);
  }

  /**
   * Create a single road plane covering the entire city grid
   */
  createRoadPlane() {
    const citySize = this.getCitySize();
    const geometry = new THREE.PlaneGeometry(citySize, citySize);
    const material = createRoadMaterial();
    
    const road = new THREE.Mesh(geometry, material);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, 0); // Centered at origin, at y=0
    road.receiveShadow = true;
    road.name = 'road';
    
    this.roadsGroup.add(road);
  }

  /**
   * Calculate intersection positions for pathfinding
   */
  calculateIntersections() {
    const offset = this.getCityOffset();
    
    for (let i = 0; i <= CITY.GRID_SIZE; i++) {
      for (let j = 0; j <= CITY.GRID_SIZE; j++) {
        const x = offset + i * (CITY.BLOCK_SIZE + CITY.ROAD_WIDTH) + CITY.ROAD_WIDTH / 2;
        const z = offset + j * (CITY.BLOCK_SIZE + CITY.ROAD_WIDTH) + CITY.ROAD_WIDTH / 2;
        
        this.intersections.push({
          id: `${i}_${j}`,
          gridX: i,
          gridZ: j,
          x,
          z,
          neighbors: this.getNeighborIds(i, j),
        });
      }
    }
  }

  /**
   * Get neighbor intersection IDs
   */
  getNeighborIds(i, j) {
    const neighbors = [];
    
    if (i > 0) neighbors.push(`${i - 1}_${j}`);
    if (i < CITY.GRID_SIZE) neighbors.push(`${i + 1}_${j}`);
    if (j > 0) neighbors.push(`${i}_${j - 1}`);
    if (j < CITY.GRID_SIZE) neighbors.push(`${i}_${j + 1}`);
    
    return neighbors;
  }

  /**
   * Create sidewalk squares for each city block
   * These are elevated platforms sitting on top of the road plane
   */
  createSidewalks() {
    const offset = this.getCityOffset();
    const material = createSidewalkMaterial();
    const blockUnit = CITY.BLOCK_SIZE + CITY.ROAD_WIDTH;
    
    // Create one sidewalk square per block
    for (let i = 0; i < CITY.GRID_SIZE; i++) {
      for (let j = 0; j < CITY.GRID_SIZE; j++) {
        const blockCenterX = offset + CITY.ROAD_WIDTH + i * blockUnit + CITY.BLOCK_SIZE / 2;
        const blockCenterZ = offset + CITY.ROAD_WIDTH + j * blockUnit + CITY.BLOCK_SIZE / 2;
        
        this.createSidewalkSquare(blockCenterX, blockCenterZ, material, i, j);
      }
    }
  }

  /**
   * Create a single sidewalk square (elevated platform for a city block)
   */
  createSidewalkSquare(centerX, centerZ, material, gridI, gridJ) {
    const size = CITY.BLOCK_SIZE;
    const height = CITY.SIDEWALK_HEIGHT;
    
    const geometry = new THREE.BoxGeometry(size, height, size);
    const sidewalk = new THREE.Mesh(geometry, material);
    
    // Position the sidewalk square centered on the block, elevated above road
    sidewalk.position.set(centerX, height / 2, centerZ);
    sidewalk.receiveShadow = true;
    sidewalk.castShadow = true;
    sidewalk.name = `sidewalk_${gridI}_${gridJ}`;
    
    this.sidewalksGroup.add(sidewalk);
  }

  /**
   * Create buildings in city blocks
   */
  createBuildings() {
    const offset = this.getCityOffset();
    const blockUnit = CITY.BLOCK_SIZE + CITY.ROAD_WIDTH;
    
    for (let i = 0; i < CITY.GRID_SIZE; i++) {
      for (let j = 0; j < CITY.GRID_SIZE; j++) {
        const blockX = offset + CITY.ROAD_WIDTH + i * blockUnit;
        const blockZ = offset + CITY.ROAD_WIDTH + j * blockUnit;
        
        this.createBlockBuildings(blockX, blockZ, i, j);
      }
    }
  }

  /**
   * Create a grid of buildings filling the entire block (inside sidewalk edges)
   * Each block is divided into a 2-4 x 2-4 grid with no gaps between buildings
   */
  createBlockBuildings(blockX, blockZ, gridI, gridJ) {
    // Building area fills block inside sidewalk edges
    const sw = CITY.SIDEWALK_WIDTH;
    const totalSize = CITY.BLOCK_SIZE - 2 * sw;
    
    // Use deterministic random based on grid position
    const seed = gridI * 1000 + gridJ;
    const random = this.seededRandom(seed);
    
    // Determine grid size (2-4 x 2-4)
    const gridCountX = Math.floor(random() * 3) + 2; // 2, 3, or 4
    const gridCountZ = Math.floor(random() * 3) + 2; // 2, 3, or 4
    
    // Calculate individual building sizes (no gaps)
    const buildingSizeX = totalSize / gridCountX;
    const buildingSizeZ = totalSize / gridCountZ;
    
    // Buildings start on top of the sidewalk
    const baseY = CITY.SIDEWALK_HEIGHT;
    
    // Create buildings in the grid
    for (let bi = 0; bi < gridCountX; bi++) {
      for (let bj = 0; bj < gridCountZ; bj++) {
        // Log-normal distribution for number of stories (median = 3 stories)
        const stories = this.sampleLogNormalStories(random);
        const height = stories * CITY.STORY_HEIGHT;
        const variation = random();
        
        const geometry = new THREE.BoxGeometry(buildingSizeX, height, buildingSizeZ);
        const material = createBuildingMaterial(variation);
        
        const building = new THREE.Mesh(geometry, material);
        building.position.set(
          blockX + sw + bi * buildingSizeX + buildingSizeX / 2,
          baseY + height / 2,
          blockZ + sw + bj * buildingSizeZ + buildingSizeZ / 2
        );
        building.castShadow = true;
        building.receiveShadow = true;
        building.name = 'building';
        
        this.buildingsGroup.add(building);
      }
    }
  }

  /**
   * Seeded random number generator
   */
  seededRandom(seed) {
    let s = seed;
    return function() {
      s = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
  }

  /**
   * Sample number of stories from log-normal distribution
   * Uses Box-Muller transform to generate normal, then exponentiates
   */
  sampleLogNormalStories(random) {
    // Log-normal parameters: median = e^μ, so μ = ln(median)
    const mu = Math.log(CITY.BUILDING_MEDIAN_STORIES);
    const sigma = 0.7; // Controls spread - higher = more variance
    
    // Box-Muller transform for standard normal
    const u1 = Math.max(random(), 0.0001); // Avoid log(0)
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Transform to log-normal and round to integer stories
    const logNormalValue = Math.exp(mu + sigma * z);
    const stories = Math.round(logNormalValue);
    
    // Clamp to valid range
    return Math.max(CITY.BUILDING_MIN_STORIES, Math.min(CITY.BUILDING_MAX_STORIES, stories));
  }

  /**
   * Get all intersections for pathfinding
   */
  getIntersections() {
    return this.intersections;
  }

  /**
   * Get objects for raycasting (buildings, sidewalks)
   */
  getRaycastTargets() {
    return [...this.buildingsGroup.children, ...this.sidewalksGroup.children];
  }
}
