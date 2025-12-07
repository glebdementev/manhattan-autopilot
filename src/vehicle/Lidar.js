/**
 * LiDAR sensor - 16 horizontal rays + nadir
 * Uses Three.js Raycaster with BVH acceleration
 */
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { LIDAR } from '../config.js';

// Install BVH acceleration on Three.js prototypes
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class Lidar {
  constructor(drone) {
    this.drone = drone;
    
    // Three.js raycaster - optimized settings
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = LIDAR.MAX_RANGE;
    this.raycaster.firstHitOnly = true; // Stop after first hit (huge perf gain)
    
    // Targets to raycast against
    this.targets = [];
    
    // Ray configuration
    this.numRays = LIDAR.NUM_RAYS;
    this.nadirIndex = this.numRays;
    this.totalRays = this.numRays + 1;
    
    // Pre-calculate local ray directions
    this.localDirections = this.generateRays();
    
    // Reusable vectors
    this._origin = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    
    // Reusable intersects array (avoid GC)
    this._intersects = [];
    
    // Store distances
    this.distances = new Float32Array(this.totalRays).fill(LIDAR.MAX_RANGE);
    
    // Visualization
    this.visualGroup = new THREE.Group();
    this.visualGroup.name = 'lidar';
    this.visualGroup.visible = LIDAR.VISUALIZE;
    this.visualizationEnabled = LIDAR.VISUALIZE;
    
    this.setupVisualization();
  }
  
  /**
   * Generate rays in forward cone (±30°)
   */
  generateRays() {
    const directions = [];
    const n = this.numRays;
    const halfFov = LIDAR.FOV / 2;
    
    for (let i = 0; i < n; i++) {
      const angle = -halfFov + (i / (n - 1)) * LIDAR.FOV;
      directions.push(new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)));
    }
    
    // Nadir ray
    directions.push(new THREE.Vector3(0, -1, 0));
    
    return directions;
  }
  
  /**
   * Set raycast targets and compute BVH for each geometry
   */
  setRaycastTargets(targets) {
    // Dispose old BVH trees
    for (const target of this.targets) {
      if (target.geometry?.boundsTree) {
        target.geometry.disposeBoundsTree();
      }
    }
    
    this.targets = targets;
    
    // Compute BVH for each target's geometry
    for (const target of targets) {
      if (target.geometry && !target.geometry.boundsTree) {
        target.geometry.computeBoundsTree();
      }
    }
  }
  
  // Legacy compatibility
  setObstacles() {}
  setTerrainHeightFn() {}
  
  /**
   * Perform LiDAR scan using Three.js Raycaster
   * OPTIMIZED: reuses intersects array, uses firstHitOnly
   */
  scan() {
    const { x, y, z, yaw } = this.drone;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    
    this._origin.set(x, y, z);
    
    for (let i = 0; i < this.totalRays; i++) {
      const local = this.localDirections[i];
      
      // Transform to world space
      if (i === this.nadirIndex) {
        this._direction.copy(local);
      } else {
        this._direction.set(
          local.x * cosYaw - local.z * sinYaw,
          local.y,
          local.x * sinYaw + local.z * cosYaw
        );
      }
      
      // Clear and reuse intersects array
      this._intersects.length = 0;
      this.raycaster.set(this._origin, this._direction);
      this.raycaster.intersectObjects(this.targets, true, this._intersects);
      
      this.distances[i] = this._intersects.length > 0 
        ? this._intersects[0].distance 
        : LIDAR.MAX_RANGE;
    }
    
    if (this.visualizationEnabled) {
      this.updateVisualization(x, y, z, cosYaw, sinYaw);
    }
    
    return this.distances;
  }
  
  /**
   * Setup visualization
   */
  setupVisualization() {
    const positions = new Float32Array(this.totalRays * 6);
    const colors = new Float32Array(this.totalRays * 6);
    
    const rayColor = new THREE.Color(LIDAR.RAY_COLOR);
    const nadirColor = new THREE.Color(0x00ffff);
    
    for (let i = 0; i < this.totalRays; i++) {
      const color = i === this.nadirIndex ? nadirColor : rayColor;
      const idx = i * 6;
      colors[idx] = colors[idx + 3] = color.r;
      colors[idx + 1] = colors[idx + 4] = color.g;
      colors[idx + 2] = colors[idx + 5] = color.b;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    this.rayLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    }));
    this.visualGroup.add(this.rayLines);
    
    // Hit spheres
    const sphereGeom = new THREE.SphereGeometry(0.2, 6, 4);
    const sphereMat = new THREE.MeshBasicMaterial({ color: LIDAR.HIT_COLOR });
    this.hitSpheres = new THREE.InstancedMesh(sphereGeom, sphereMat, this.totalRays);
    this.hitSpheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.visualGroup.add(this.hitSpheres);
    
    this._matrix = new THREE.Matrix4();
  }
  
  /**
   * Update visualization
   */
  updateVisualization(x, y, z, cosYaw, sinYaw) {
    const positions = this.rayLines.geometry.attributes.position.array;
    
    for (let i = 0; i < this.totalRays; i++) {
      const local = this.localDirections[i];
      const dist = this.distances[i];
      const idx = i * 6;
      
      // Start
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      
      // Direction
      let wx, wy, wz;
      if (i === this.nadirIndex) {
        wx = local.x; wy = local.y; wz = local.z;
      } else {
        wx = local.x * cosYaw - local.z * sinYaw;
        wy = local.y;
        wz = local.x * sinYaw + local.z * cosYaw;
      }
      
      // End
      positions[idx + 3] = x + wx * dist;
      positions[idx + 4] = y + wy * dist;
      positions[idx + 5] = z + wz * dist;
      
      // Hit sphere
      if (dist < LIDAR.MAX_RANGE) {
        this._matrix.setPosition(x + wx * dist, y + wy * dist, z + wz * dist);
      } else {
        this._matrix.setPosition(0, -1000, 0);
      }
      this.hitSpheres.setMatrixAt(i, this._matrix);
    }
    
    this.rayLines.geometry.attributes.position.needsUpdate = true;
    this.hitSpheres.instanceMatrix.needsUpdate = true;
  }
  
  // Getters
  getNormalizedDistances() {
    const result = new Float32Array(this.totalRays);
    for (let i = 0; i < this.totalRays; i++) {
      result[i] = this.distances[i] / LIDAR.MAX_RANGE;
    }
    return result;
  }
  
  getDistances() { return this.distances; }
  getNadirDistance() { return this.distances[this.nadirIndex]; }
  
  getMinDistance() {
    let min = LIDAR.MAX_RANGE;
    for (let i = 0; i < this.numRays; i++) {
      if (this.distances[i] < min) min = this.distances[i];
    }
    return min;
  }
  
  getForwardMinDistance() {
    // All rays are forward-ish now
    return this.getMinDistance();
  }
  
  isPathClear(minClearance = 3) {
    return this.getMinDistance() > minClearance;
  }
  
  getVisualGroup() { return this.visualGroup; }
  
  setVisualizationEnabled(enabled) {
    this.visualizationEnabled = enabled;
    this.visualGroup.visible = enabled;
  }
  
  getNumRays() { return this.numRays; }
  getTotalRays() { return this.totalRays; }
  
  // Legacy
  getNumScanRays() { return this.numRays; }
  getNumClosestObstacles() { return this.numRays; }
  getClosestObstaclesFlat() { return this.getNormalizedDistances(); }
  getClosestObstacles() { return []; }
  getZenithDistance() { return LIDAR.MAX_RANGE; }
  getHitPoints() { return []; }
  setTargetPosition() {}
  setTargetVisible() {}
}
