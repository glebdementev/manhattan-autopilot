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
    this.createRoads();
    this.createSidewalks();
    this.createBuildings();
    
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
   * Create ground plane
   */
  createGround() {
    const size = this.getCitySize() + 100;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = createGroundMaterial();
    
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01; // Slightly below roads
    ground.receiveShadow = true;
    ground.name = 'ground';
    
    this.cityGroup.add(ground);
  }

  /**
   * Create road network
   */
  createRoads() {
    const offset = this.getCityOffset();
    const material = createRoadMaterial();
    
    // Create horizontal roads (along X axis)
    for (let i = 0; i <= CITY.GRID_SIZE; i++) {
      const z = offset + i * (CITY.BLOCK_SIZE + CITY.ROAD_WIDTH) + CITY.ROAD_WIDTH / 2;
      this.createRoadSegment(
        offset, z,
        this.getCitySize(), CITY.ROAD_WIDTH,
        material,
        'horizontal', i
      );
    }
    
    // Create vertical roads (along Z axis)
    for (let i = 0; i <= CITY.GRID_SIZE; i++) {
      const x = offset + i * (CITY.BLOCK_SIZE + CITY.ROAD_WIDTH) + CITY.ROAD_WIDTH / 2;
      this.createRoadSegment(
        x, offset,
        CITY.ROAD_WIDTH, this.getCitySize(),
        material,
        'vertical', i
      );
    }
    
    // Store intersections
    this.calculateIntersections();
  }

  /**
   * Create a single road segment
   */
  createRoadSegment(x, z, width, depth, material, direction, index) {
    const geometry = new THREE.PlaneGeometry(width, depth);
    const road = new THREE.Mesh(geometry, material);
    
    road.rotation.x = -Math.PI / 2;
    road.position.set(x + width / 2, 0, z + depth / 2);
    road.receiveShadow = true;
    road.name = `road_${direction}_${index}`;
    
    this.roadsGroup.add(road);
    
    // Store segment info
    this.roadSegments.push({
      direction,
      index,
      x: x + width / 2,
      z: z + depth / 2,
      width,
      depth,
    });
  }

  /**
   * Calculate intersection positions
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
   * Create sidewalks along roads
   */
  createSidewalks() {
    const offset = this.getCityOffset();
    const material = createSidewalkMaterial();
    const blockUnit = CITY.BLOCK_SIZE + CITY.ROAD_WIDTH;
    
    // Create sidewalks for each block
    for (let i = 0; i < CITY.GRID_SIZE; i++) {
      for (let j = 0; j < CITY.GRID_SIZE; j++) {
        const blockX = offset + CITY.ROAD_WIDTH + i * blockUnit;
        const blockZ = offset + CITY.ROAD_WIDTH + j * blockUnit;
        
        this.createBlockSidewalks(blockX, blockZ, material);
      }
    }
  }

  /**
   * Create sidewalks around a single block
   */
  createBlockSidewalks(blockX, blockZ, material) {
    const sw = CITY.SIDEWALK_WIDTH;
    const bs = CITY.BLOCK_SIZE;
    const sh = CITY.SIDEWALK_HEIGHT;
    
    // North sidewalk
    this.createSidewalkMesh(blockX, blockZ, bs, sw, sh, material, 'north');
    
    // South sidewalk
    this.createSidewalkMesh(blockX, blockZ + bs - sw, bs, sw, sh, material, 'south');
    
    // West sidewalk
    this.createSidewalkMesh(blockX, blockZ + sw, sw, bs - 2 * sw, sh, material, 'west');
    
    // East sidewalk
    this.createSidewalkMesh(blockX + bs - sw, blockZ + sw, sw, bs - 2 * sw, sh, material, 'east');
  }

  /**
   * Create a single sidewalk mesh
   */
  createSidewalkMesh(x, z, width, depth, height, material, side) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const sidewalk = new THREE.Mesh(geometry, material);
    
    sidewalk.position.set(x + width / 2, height / 2, z + depth / 2);
    sidewalk.receiveShadow = true;
    sidewalk.castShadow = true;
    sidewalk.name = `sidewalk_${side}`;
    
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
        
        this.createBlockBuilding(blockX, blockZ, i, j);
      }
    }
  }

  /**
   * Create a grid of buildings filling the entire block (inside sidewalks)
   * Each block is divided into a 2-4 x 2-4 grid with no gaps between buildings
   */
  createBlockBuilding(blockX, blockZ, gridI, gridJ) {
    // Building area fills block inside sidewalks - no setback
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
    
    // Create buildings in the grid
    for (let bi = 0; bi < gridCountX; bi++) {
      for (let bj = 0; bj < gridCountZ; bj++) {
        const height = CITY.BUILDING_MIN_HEIGHT + random() * (CITY.BUILDING_MAX_HEIGHT - CITY.BUILDING_MIN_HEIGHT);
        const variation = random();
        
        const geometry = new THREE.BoxGeometry(buildingSizeX, height, buildingSizeZ);
        const material = createBuildingMaterial(variation);
        
        const building = new THREE.Mesh(geometry, material);
        building.position.set(
          blockX + sw + bi * buildingSizeX + buildingSizeX / 2,
          height / 2,
          blockZ + sw + bj * buildingSizeZ + buildingSizeZ / 2
        );
        building.castShadow = true;
        building.receiveShadow = true;
        building.name = 'building';
        
        this.buildingsGroup.add(building);
        
        // Add window strips
        this.addBuildingWindows(building, buildingSizeX, buildingSizeZ, height, random);
      }
    }
  }

  /**
   * Add window detail to building
   */
  addBuildingWindows(building, sizeX, sizeZ, height, random) {
    // Create window strips on the sides
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x88aacc,
      emissive: 0xffffcc,
      emissiveIntensity: random() * 0.2 + 0.05,
    });
    
    const floorHeight = 3.5;
    const numFloors = Math.floor(height / floorHeight);
    const windowWidthX = sizeX * 0.7; // For front/back faces
    const windowWidthZ = sizeZ * 0.7; // For left/right faces
    const windowHeight = 1.5;
    
    for (let floor = 1; floor < numFloors; floor++) {
      const y = floor * floorHeight - height / 2 + 1;
      
      // Front and back windows (along X axis)
      [-sizeZ / 2 - 0.01, sizeZ / 2 + 0.01].forEach(zOffset => {
        const geom = new THREE.PlaneGeometry(windowWidthX, windowHeight);
        const window = new THREE.Mesh(geom, windowMaterial);
        window.position.set(0, y, zOffset);
        if (zOffset < 0) window.rotation.y = Math.PI;
        building.add(window);
      });
      
      // Left and right windows (along Z axis)
      [-sizeX / 2 - 0.01, sizeX / 2 + 0.01].forEach(xOffset => {
        const geom = new THREE.PlaneGeometry(windowWidthZ, windowHeight);
        const window = new THREE.Mesh(geom, windowMaterial);
        window.position.set(xOffset, y, 0);
        window.rotation.y = xOffset > 0 ? Math.PI / 2 : -Math.PI / 2;
        building.add(window);
      });
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
