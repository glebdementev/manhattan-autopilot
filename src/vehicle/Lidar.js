/**
 * LiDAR sensor - Multi-layer 3D scanning
 * 4 vertical layers × 12 horizontal rays = 48 rays + nadir + zenith = 50 total
 * Uses Three.js Raycaster with BVH acceleration
 */
import * as THREE from 'three';
import { 
  computeBoundsTree, 
  disposeBoundsTree, 
  acceleratedRaycast,
} from 'three-mesh-bvh';
import { LIDAR, DRONE } from '../config.js';

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
    this.raycaster.firstHitOnly = true;
    
    // Targets to raycast against
    this.targets = [];
    
    // Ray configuration - multi-layer
    this.horizontalRays = LIDAR.HORIZONTAL_RAYS;
    this.verticalLayers = LIDAR.VERTICAL_LAYERS;
    this.scanRays = this.horizontalRays * this.verticalLayers;
    
    // Special ray indices
    this.nadirIndex = this.scanRays;
    this.zenithIndex = this.scanRays + 1;
    this.totalRays = this.scanRays + 2;
    
    // Pre-calculate local ray directions
    this.localDirections = this.generateRays();
    
    // Store layer info for each ray (for getMinDistanceAtLayer)
    this.rayLayers = this.generateRayLayers();
    
    // Reusable vectors
    this._origin = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    
    // Reusable intersects array
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
   * Generate multi-layer rays
   * 4 layers at different pitch angles, each with horizontal spread
   */
  generateRays() {
    const directions = [];
    const halfHorizFov = LIDAR.FOV / 2;
    const halfVertFov = LIDAR.VERTICAL_FOV / 2;
    
    // Generate vertical layer angles (evenly distributed)
    const vertAngles = [];
    for (let v = 0; v < this.verticalLayers; v++) {
      // From -halfVertFov to +halfVertFov
      const t = this.verticalLayers > 1 ? v / (this.verticalLayers - 1) : 0.5;
      vertAngles.push(-halfVertFov + t * LIDAR.VERTICAL_FOV);
    }
    
    // Generate rays for each layer
    for (let v = 0; v < this.verticalLayers; v++) {
      const pitch = vertAngles[v];
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      
      for (let h = 0; h < this.horizontalRays; h++) {
        // Horizontal angle (yaw)
        const t = this.horizontalRays > 1 ? h / (this.horizontalRays - 1) : 0.5;
        const yawAngle = -halfHorizFov + t * LIDAR.FOV;
        
        // Calculate direction
        // Forward is +Z in local space (drone faces +Z when yaw=0)
        const x = Math.sin(yawAngle) * cosPitch;
        const y = sinPitch;
        const z = Math.cos(yawAngle) * cosPitch;
        
        directions.push(new THREE.Vector3(x, y, z).normalize());
      }
    }
    
    // Nadir ray (straight down)
    directions.push(new THREE.Vector3(0, -1, 0));
    
    // Zenith ray (straight up)
    directions.push(new THREE.Vector3(0, 1, 0));
    
    return directions;
  }
  
  /**
   * Generate layer index for each ray
   */
  generateRayLayers() {
    const layers = [];
    for (let v = 0; v < this.verticalLayers; v++) {
      for (let h = 0; h < this.horizontalRays; h++) {
        layers.push(v);
      }
    }
    // Nadir and zenith don't belong to layers
    layers.push(-1);
    layers.push(-1);
    return layers;
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
   */
  scan() {
    const { x, y, z, yaw } = this.drone;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    
    // Emit from front of drone (half size forward in local +Z direction)
    // Forward in local space is +Z, rotated by yaw around Y axis
    const frontOffset = DRONE.SIZE * 0.5;
    const originX = x + sinYaw * frontOffset;
    const originZ = z + cosYaw * frontOffset;
    this._origin.set(originX, y, originZ);
    
    for (let i = 0; i < this.totalRays; i++) {
      const local = this.localDirections[i];
      
      // Transform to world space (nadir/zenith don't need yaw rotation)
      if (i === this.nadirIndex || i === this.zenithIndex) {
        this._direction.copy(local);
      } else {
        // Rotate around Y axis by yaw
        // Standard Y-axis rotation: X' = X*cos - Z*sin, Z' = X*sin + Z*cos
        // But drone yaw is measured clockwise from +Z, so we use negative yaw
        this._direction.set(
          local.x * cosYaw + local.z * sinYaw,
          local.y,
          -local.x * sinYaw + local.z * cosYaw
        );
      }
      
      // Clear and reuse intersects array
      this._intersects.length = 0;
      this.raycaster.set(this._origin, this._direction);
      this.raycaster.intersectObjects(this.targets, false, this._intersects);
      
      this.distances[i] = this._intersects.length > 0 
        ? this._intersects[0].distance 
        : LIDAR.MAX_RANGE;
    }
    
    if (this.visualizationEnabled) {
      this.updateVisualization(originX, y, originZ, cosYaw, sinYaw);
    }
    
    return this.distances;
  }
  
  /**
   * Check if path to a specific point is clear
   * Casts a single ray to the target position
   */
  isPathToPointClear(targetX, targetY, targetZ, margin = 0.5) {
    const { x, y, z, yaw } = this.drone;
    
    // Emit from front of drone
    const frontOffset = DRONE.SIZE * 0.5;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const originX = x + sinYaw * frontOffset;
    const originZ = z + cosYaw * frontOffset;
    
    const dx = targetX - originX;
    const dy = targetY - y;
    const dz = targetZ - originZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.1) return true;
    
    // Cast ray toward target
    this._origin.set(originX, y, originZ);
    this._direction.set(dx / dist, dy / dist, dz / dist);
    
    this._intersects.length = 0;
    this.raycaster.set(this._origin, this._direction);
    this.raycaster.far = dist + margin;
    this.raycaster.intersectObjects(this.targets, false, this._intersects);
    this.raycaster.far = LIDAR.MAX_RANGE; // Reset
    
    // Path is clear if no hit, or hit is beyond target
    if (this._intersects.length === 0) return true;
    return this._intersects[0].distance > dist - margin;
  }
  
  /**
   * Setup visualization
   */
  setupVisualization() {
    const positions = new Float32Array(this.totalRays * 6);
    const colors = new Float32Array(this.totalRays * 6);
    
    const layerColors = [
      new THREE.Color(0xff6666), // Layer 0 (bottom) - red
      new THREE.Color(0xffaa44), // Layer 1 - orange
      new THREE.Color(0x44ff44), // Layer 2 - green
      new THREE.Color(0x4488ff), // Layer 3 (top) - blue
    ];
    const nadirColor = new THREE.Color(0x00ffff);  // Cyan for nadir
    const zenithColor = new THREE.Color(0xff00ff); // Magenta for zenith
    
    for (let i = 0; i < this.totalRays; i++) {
      let color;
      if (i === this.nadirIndex) {
        color = nadirColor;
      } else if (i === this.zenithIndex) {
        color = zenithColor;
      } else {
        const layer = this.rayLayers[i];
        color = layerColors[layer] || new THREE.Color(LIDAR.RAY_COLOR);
      }
      
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
    const sphereGeom = new THREE.SphereGeometry(0.15, 6, 4);
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
      if (i === this.nadirIndex || i === this.zenithIndex) {
        wx = local.x; wy = local.y; wz = local.z;
      } else {
        wx = local.x * cosYaw + local.z * sinYaw;
        wy = local.y;
        wz = -local.x * sinYaw + local.z * cosYaw;
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
  getZenithDistance() { return this.distances[this.zenithIndex]; }
  
  /**
   * Get minimum distance across all scan rays (excludes nadir/zenith)
   */
  getMinDistance() {
    let min = LIDAR.MAX_RANGE;
    for (let i = 0; i < this.scanRays; i++) {
      if (this.distances[i] < min) min = this.distances[i];
    }
    return min;
  }
  
  /**
   * Get minimum distance for a specific layer
   * @param {number} layer - Layer index (0 = bottom, 3 = top)
   */
  getMinDistanceAtLayer(layer) {
    let min = LIDAR.MAX_RANGE;
    const startIdx = layer * this.horizontalRays;
    const endIdx = startIdx + this.horizontalRays;
    
    for (let i = startIdx; i < endIdx; i++) {
      if (this.distances[i] < min) min = this.distances[i];
    }
    return min;
  }
  
  /**
   * Get minimum distance for upper layers (above horizontal)
   */
  getMinDistanceUpper() {
    // Layers 2 and 3 are above horizontal
    const upperStart = Math.floor(this.verticalLayers / 2);
    let min = LIDAR.MAX_RANGE;
    
    for (let layer = upperStart; layer < this.verticalLayers; layer++) {
      const layerMin = this.getMinDistanceAtLayer(layer);
      if (layerMin < min) min = layerMin;
    }
    return min;
  }
  
  /**
   * Get minimum distance for lower layers (below horizontal)
   */
  getMinDistanceLower() {
    // Layers 0 and 1 are below horizontal
    const lowerEnd = Math.floor(this.verticalLayers / 2);
    let min = LIDAR.MAX_RANGE;
    
    for (let layer = 0; layer < lowerEnd; layer++) {
      const layerMin = this.getMinDistanceAtLayer(layer);
      if (layerMin < min) min = layerMin;
    }
    return min;
  }
  
  getForwardMinDistance() {
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
  
  getNumRays() { return this.scanRays; }
  getTotalRays() { return this.totalRays; }
  getHorizontalRays() { return this.horizontalRays; }
  getVerticalLayers() { return this.verticalLayers; }
  
  // Legacy compatibility
  getNumScanRays() { return this.scanRays; }
  getNumClosestObstacles() { return this.scanRays; }
  getClosestObstaclesFlat() { return this.getNormalizedDistances(); }
  getClosestObstacles() { return []; }
  getHitPoints() { return []; }
  setTargetPosition() {}
  setTargetVisible() {}
}
