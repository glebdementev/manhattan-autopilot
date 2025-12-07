/**
 * 3D LiDAR sensor simulation for drone navigation
 * Features:
 * - Horizontal sweep rays for obstacle detection
 * - Nadir (downward) and zenith (upward) rays for altitude awareness
 */
import * as THREE from 'three';
import { LIDAR } from '../config.js';

export class Lidar {
  constructor(drone) {
    this.drone = drone;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = LIDAR.MAX_RANGE;
    
    // Raycast targets (set externally)
    this.raycastTargets = [];
    
    // Calculate total rays: grid rays + nadir + zenith
    this.numGridRays = LIDAR.NUM_HORIZONTAL_RAYS * LIDAR.NUM_VERTICAL_RAYS;
    this.numSpecialRays = 2; // nadir + zenith
    this.numRays = this.numGridRays + this.numSpecialRays;
    
    // Ray indices for special rays
    this.nadirIndex = this.numGridRays;     // Straight down
    this.zenithIndex = this.numGridRays + 1; // Straight up
    
    // Store latest readings
    this.distances = new Array(this.numRays).fill(LIDAR.MAX_RANGE);
    this.hitPoints = [];
    
    // Pre-calculate ray directions (in local drone space)
    this.rayDirections = this.calculateRayDirections();
    
    // Store world-space directions for visualization (updated each scan)
    this.worldDirections = new Array(this.numRays);
    for (let i = 0; i < this.numRays; i++) {
      this.worldDirections[i] = new THREE.Vector3();
    }
    
    // Visualization group (attached to drone, so moves with it)
    this.visualGroup = new THREE.Group();
    this.visualGroup.name = 'lidar_visual';
    this.visualGroup.visible = LIDAR.VISUALIZE;
    
    // Setup visualization geometry
    this.setupVisualization();
    
    // Track visualization state independently from config
    this.visualizationEnabled = LIDAR.VISUALIZE;
    
    // Reusable vectors for raycasting
    this._direction = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._endPoint = new THREE.Vector3();
    
    // Target line visualization
    this.targetLine = null;
    this.targetLineMaterial = null;
    this.targetPosition = null;
    this.targetVisible = false;
    this.setupTargetLine();
  }
  
  /**
   * Set raycast targets
   */
  setRaycastTargets(targets) {
    this.raycastTargets = targets;
  }
  
  /**
   * Setup target direction line visualization
   */
  setupTargetLine() {
    // Create line geometry with 2 points (drone to target)
    const positions = new Float32Array(6); // 2 vertices * 3 components
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Material with color that changes based on visibility
    this.targetLineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00, // Green = visible
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    
    this.targetLine = new THREE.Line(geometry, this.targetLineMaterial);
    this.targetLine.name = 'target_line';
    this.targetLine.visible = false; // Only show when lidar is on
    this.visualGroup.add(this.targetLine);
  }

  /**
   * Calculate all ray directions (in local drone space)
   * Includes grid rays + nadir + zenith
   */
  calculateRayDirections() {
    const directions = [];
    
    const hFov = LIDAR.HORIZONTAL_FOV;
    const vFov = LIDAR.VERTICAL_FOV;
    const numH = LIDAR.NUM_HORIZONTAL_RAYS;
    const numV = LIDAR.NUM_VERTICAL_RAYS;
    
    // Grid rays (horizontal sweep with vertical layers)
    for (let v = 0; v < numV; v++) {
      // Spread vertical angles evenly within FOV
      const verticalAngle = -vFov / 2 + (v / Math.max(numV - 1, 1)) * vFov;
      
      for (let h = 0; h < numH; h++) {
        // Spread horizontal angles evenly within FOV
        const horizontalAngle = -hFov / 2 + (h / Math.max(numH - 1, 1)) * hFov;
        
        const cosV = Math.cos(verticalAngle);
        const sinV = Math.sin(verticalAngle);
        const cosH = Math.cos(horizontalAngle);
        const sinH = Math.sin(horizontalAngle);
        
        directions.push(new THREE.Vector3(
          sinH * cosV,
          sinV,
          cosH * cosV
        ).normalize());
      }
    }
    
    // Nadir ray (straight down)
    directions.push(new THREE.Vector3(0, -1, 0));
    
    // Zenith ray (straight up)
    directions.push(new THREE.Vector3(0, 1, 0));
    
    return directions;
  }

  /**
   * Setup efficient visualization using single geometries
   */
  setupVisualization() {
    // Create ray lines as a single LineSegments geometry (much more efficient)
    // Each ray needs 2 vertices (start and end)
    const rayPositions = new Float32Array(this.numRays * 2 * 3);
    const rayColors = new Float32Array(this.numRays * 2 * 3);
    
    // Initialize colors
    const rayColor = new THREE.Color(LIDAR.RAY_COLOR);
    const nadirColor = new THREE.Color(0x00ffff); // Cyan for nadir
    const zenithColor = new THREE.Color(0xffff00); // Yellow for zenith
    
    for (let i = 0; i < this.numRays; i++) {
      let color = rayColor;
      if (i === this.nadirIndex) color = nadirColor;
      else if (i === this.zenithIndex) color = zenithColor;
      
      // Start vertex color
      rayColors[i * 6 + 0] = color.r;
      rayColors[i * 6 + 1] = color.g;
      rayColors[i * 6 + 2] = color.b;
      // End vertex color (same)
      rayColors[i * 6 + 3] = color.r;
      rayColors[i * 6 + 4] = color.g;
      rayColors[i * 6 + 5] = color.b;
    }
    
    const rayGeometry = new THREE.BufferGeometry();
    rayGeometry.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
    rayGeometry.setAttribute('color', new THREE.BufferAttribute(rayColors, 3));
    
    const rayMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });
    
    this.rayLines = new THREE.LineSegments(rayGeometry, rayMaterial);
    this.visualGroup.add(this.rayLines);
    
    // Create hit point spheres using InstancedMesh for efficiency
    const sphereGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: LIDAR.HIT_COLOR,
    });
    
    this.hitSpheres = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, this.numRays);
    this.hitSpheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.visualGroup.add(this.hitSpheres);
    
    // Create special spheres for nadir/zenith with different colors
    const nadirSphereGeometry = new THREE.SphereGeometry(0.2, 10, 8);
    const nadirSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    this.nadirSphere = new THREE.Mesh(nadirSphereGeometry, nadirSphereMaterial);
    this.nadirSphere.visible = false;
    this.visualGroup.add(this.nadirSphere);
    
    const zenithSphereGeometry = new THREE.SphereGeometry(0.2, 10, 8);
    const zenithSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.zenithSphere = new THREE.Mesh(zenithSphereGeometry, zenithSphereMaterial);
    this.zenithSphere.visible = false;
    this.visualGroup.add(this.zenithSphere);
    
    // Reusable matrix for instanced mesh updates
    this._instanceMatrix = new THREE.Matrix4();
    this._hiddenPosition = new THREE.Vector3(0, -1000, 0);
  }

  /**
   * Perform 3D LiDAR scan using Three.js raycasting
   */
  scan() {
    this.hitPoints = [];
    
    const droneX = this.drone.x;
    const droneY = this.drone.y;
    const droneZ = this.drone.z;
    const droneYaw = this.drone.yaw;
    
    const cosYaw = Math.cos(droneYaw);
    const sinYaw = Math.sin(droneYaw);
    
    this._origin.set(droneX, droneY, droneZ);
    
    // Get visualization arrays if enabled
    const shouldVisualize = this.visualizationEnabled;
    const rayPositions = shouldVisualize ? this.rayLines.geometry.attributes.position.array : null;
    
    for (let i = 0; i < this.numRays; i++) {
      const localDir = this.rayDirections[i];
      
      // Transform direction from local to world space (rotate by yaw)
      if (i === this.nadirIndex || i === this.zenithIndex) {
        this._direction.copy(localDir);
      } else {
        this._direction.set(
          localDir.x * cosYaw + localDir.z * sinYaw,
          localDir.y,
          -localDir.x * sinYaw + localDir.z * cosYaw
        );
      }
      
      // Store world direction for external use
      this.worldDirections[i].copy(this._direction);
      
      // Perform Three.js raycast
      this.raycaster.set(this._origin, this._direction);
      const intersections = this.raycaster.intersectObjects(this.raycastTargets, false);
      
      let hitDistance = LIDAR.MAX_RANGE;
      let hitPoint = null;
      
      if (intersections.length > 0) {
        const hit = intersections[0];
        hitDistance = hit.distance;
        hitPoint = hit.point;
        
        this.hitPoints.push({
          x: hit.point.x,
          y: hit.point.y,
          z: hit.point.z,
          distance: hit.distance,
          rayIndex: i,
          isNadir: i === this.nadirIndex,
          isZenith: i === this.zenithIndex,
        });
      }
      
      this.distances[i] = hitDistance;
      
      // Update visualization
      if (shouldVisualize) {
        // Calculate end point
        if (hitPoint) {
          this._endPoint.copy(hitPoint);
        } else {
          this._endPoint.set(
            droneX + this._direction.x * LIDAR.MAX_RANGE,
            droneY + this._direction.y * LIDAR.MAX_RANGE,
            droneZ + this._direction.z * LIDAR.MAX_RANGE
          );
        }
        
        // Update ray line (start and end vertices)
        const rayIdx = i * 6;
        rayPositions[rayIdx + 0] = droneX;
        rayPositions[rayIdx + 1] = droneY;
        rayPositions[rayIdx + 2] = droneZ;
        rayPositions[rayIdx + 3] = this._endPoint.x;
        rayPositions[rayIdx + 4] = this._endPoint.y;
        rayPositions[rayIdx + 5] = this._endPoint.z;
        
        // Update hit sphere position
        if (i === this.nadirIndex) {
          if (hitPoint) {
            this.nadirSphere.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
            this.nadirSphere.visible = true;
          } else {
            this.nadirSphere.visible = false;
          }
        } else if (i === this.zenithIndex) {
          if (hitPoint) {
            this.zenithSphere.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
            this.zenithSphere.visible = true;
          } else {
            this.zenithSphere.visible = false;
          }
        } else {
          if (hitPoint) {
            this._instanceMatrix.setPosition(hitPoint.x, hitPoint.y, hitPoint.z);
          } else {
            this._instanceMatrix.setPosition(this._hiddenPosition.x, this._hiddenPosition.y, this._hiddenPosition.z);
          }
          this.hitSpheres.setMatrixAt(i, this._instanceMatrix);
        }
      }
    }
    
    // Mark geometries as needing update
    if (shouldVisualize) {
      this.rayLines.geometry.attributes.position.needsUpdate = true;
      this.hitSpheres.instanceMatrix.needsUpdate = true;
      
      // Update target line
      this.updateTargetLine(droneX, droneY, droneZ);
    }
    
    return this.distances;
  }
  
  /**
   * Update target direction line
   */
  updateTargetLine(droneX, droneY, droneZ) {
    if (!this.targetPosition || !this.targetLine) return;
    
    const positions = this.targetLine.geometry.attributes.position.array;
    
    // Start at drone position
    positions[0] = droneX;
    positions[1] = droneY;
    positions[2] = droneZ;
    
    // End at target position
    positions[3] = this.targetPosition.x;
    positions[4] = this.targetPosition.y;
    positions[5] = this.targetPosition.z;
    
    this.targetLine.geometry.attributes.position.needsUpdate = true;
    
    // Update color based on visibility
    // Green = can see target (path is clear)
    // Red = cannot see target (obstacles in way)
    if (this.targetVisible) {
      this.targetLineMaterial.color.setHex(0x00ff88); // Bright green
      this.targetLineMaterial.opacity = 0.9;
    } else {
      this.targetLineMaterial.color.setHex(0xff4444); // Red
      this.targetLineMaterial.opacity = 0.6;
    }
  }
  
  /**
   * Set target position for visualization
   * @param {number} x - Target X position
   * @param {number} y - Target Y position
   * @param {number} z - Target Z position
   */
  setTargetPosition(x, y, z) {
    this.targetPosition = { x, y, z };
  }
  
  /**
   * Set whether target is visible (for line color)
   * @param {boolean} visible - Whether target is visible
   */
  setTargetVisible(visible) {
    this.targetVisible = visible;
  }

  /**
   * Get normalized distances (0-1 range)
   */
  getNormalizedDistances() {
    return this.distances.map(d => d / LIDAR.MAX_RANGE);
  }

  /**
   * Get raw distances
   */
  getDistances() {
    return this.distances;
  }

  /**
   * Get nadir (downward) distance
   */
  getNadirDistance() {
    return this.distances[this.nadirIndex];
  }

  /**
   * Get zenith (upward) distance
   */
  getZenithDistance() {
    return this.distances[this.zenithIndex];
  }

  /**
   * Get all hit points from last scan
   */
  getHitPoints() {
    return this.hitPoints;
  }

  /**
   * Get minimum distance across all rays
   */
  getMinDistance() {
    return Math.min(...this.distances);
  }

  /**
   * Get minimum distance in forward direction (center rays)
   */
  getForwardMinDistance() {
    const numH = LIDAR.NUM_HORIZONTAL_RAYS;
    const numV = LIDAR.NUM_VERTICAL_RAYS;
    
    let minDist = LIDAR.MAX_RANGE;
    const hCenter = Math.floor(numH / 2);
    const hRange = Math.max(1, Math.floor(numH / 4));
    
    for (let v = 0; v < numV; v++) {
      for (let h = hCenter - hRange; h <= hCenter + hRange; h++) {
        if (h >= 0 && h < numH) {
          const idx = v * numH + h;
          if (this.distances[idx] < minDist) {
            minDist = this.distances[idx];
          }
        }
      }
    }
    
    return minDist;
  }

  /**
   * Check if forward path is clear
   */
  isPathClear(minClearance = 3) {
    return this.getForwardMinDistance() > minClearance;
  }

  /**
   * Get the visualization group (to add to scene)
   */
  getVisualGroup() {
    return this.visualGroup;
  }

  /**
   * Enable or disable visualization
   */
  setVisualizationEnabled(enabled) {
    this.visualizationEnabled = enabled;
    this.visualGroup.visible = enabled;
    
    // Show/hide target line with lidar
    if (this.targetLine) {
      this.targetLine.visible = enabled;
    }
    
    // Force an immediate scan update if enabling
    if (enabled) {
      this.frameCounter = this.scanInterval - 1;
    }
  }

  /**
   * Get number of grid rays (excluding nadir/zenith)
   */
  getNumGridRays() {
    return this.numGridRays;
  }

  /**
   * Get total number of rays (including nadir/zenith)
   */
  getNumRays() {
    return this.numRays;
  }
}
