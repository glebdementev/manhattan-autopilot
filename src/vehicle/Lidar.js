/**
 * 3D LiDAR sensor simulation for drone navigation
 * Features:
 * - Dense horizontal sweep for obstacle detection
 * - Returns N closest obstacles with direction + distance (min angular separation)
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
    
    // Dense scan rays for obstacle detection
    this.numScanRays = LIDAR.NUM_SCAN_RAYS;
    this.numSpecialRays = 2; // nadir + zenith
    this.numRays = this.numScanRays + this.numSpecialRays;
    
    // Ray indices for special rays
    this.nadirIndex = this.numScanRays;     // Straight down
    this.zenithIndex = this.numScanRays + 1; // Straight up
    
    // Closest obstacles output config
    this.numClosestObstacles = LIDAR.NUM_CLOSEST_OBSTACLES;
    this.minAngularSeparation = LIDAR.MIN_ANGULAR_SEPARATION;
    
    // Store latest raw readings (all scan rays)
    this.distances = new Array(this.numRays).fill(LIDAR.MAX_RANGE);
    this.hitPoints = [];
    
    // Store closest obstacles: [{angle, distance}, ...]
    this.closestObstacles = [];
    
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
   * Dense horizontal sweep + nadir + zenith
   */
  calculateRayDirections() {
    const directions = [];
    
    const hFov = LIDAR.HORIZONTAL_FOV;
    const numScan = this.numScanRays;
    
    // Dense horizontal scan rays (single vertical layer at horizon)
    for (let i = 0; i < numScan; i++) {
      const horizontalAngle = -hFov / 2 + (i / Math.max(numScan - 1, 1)) * hFov;
      
      directions.push(new THREE.Vector3(
        Math.sin(horizontalAngle),
        0, // Horizontal plane only
        Math.cos(horizontalAngle)
      ).normalize());
    }
    
    // Nadir ray (straight down)
    directions.push(new THREE.Vector3(0, -1, 0));
    
    // Zenith ray (straight up)
    directions.push(new THREE.Vector3(0, 1, 0));
    
    return directions;
  }
  
  /**
   * Calculate horizontal angle for a ray index (in local space)
   */
  getRayAngle(rayIndex) {
    if (rayIndex >= this.numScanRays) return null; // Special rays
    const hFov = LIDAR.HORIZONTAL_FOV;
    return -hFov / 2 + (rayIndex / Math.max(this.numScanRays - 1, 1)) * hFov;
  }

  /**
   * Setup efficient visualization using single geometries
   */
  setupVisualization() {
    // Create ray lines for the closest obstacles only (much more efficient)
    // Each closest obstacle needs 2 vertices (start and end)
    const numVisualRays = this.numClosestObstacles + this.numSpecialRays;
    const rayPositions = new Float32Array(numVisualRays * 2 * 3);
    const rayColors = new Float32Array(numVisualRays * 2 * 3);
    
    // Initialize colors
    const rayColor = new THREE.Color(LIDAR.RAY_COLOR);
    const nadirColor = new THREE.Color(0x00ffff); // Cyan for nadir
    const zenithColor = new THREE.Color(0xffff00); // Yellow for zenith
    
    for (let i = 0; i < numVisualRays; i++) {
      let color = rayColor;
      if (i === this.numClosestObstacles) color = nadirColor;
      else if (i === this.numClosestObstacles + 1) color = zenithColor;
      
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
    
    this.hitSpheres = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, numVisualRays);
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
   * Returns the N closest obstacles with minimum angular separation
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
    
    // Collect all horizontal hits with angles
    const horizontalHits = [];
    
    // Scan all rays
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
        
        // Collect horizontal hits for closest obstacle selection
        if (i < this.numScanRays) {
          const angle = this.getRayAngle(i);
          horizontalHits.push({
            angle,
            distance: hitDistance,
            rayIndex: i,
            hitPoint: hitPoint.clone(),
            worldDir: this._direction.clone(),
          });
        }
      }
      
      this.distances[i] = hitDistance;
    }
    
    // Find N closest obstacles with minimum angular separation
    this.closestObstacles = this.findClosestObstacles(horizontalHits);
    
    // Update visualization
    this.updateVisualization(droneX, droneY, droneZ);
    
    return this.distances;
  }
  
  /**
   * Find N closest obstacles with minimum angular separation
   * @param {Array} hits - All horizontal hits with angle and distance
   * @returns {Array} - N closest obstacles [{angle, distance, dirX, dirZ}, ...]
   */
  findClosestObstacles(hits) {
    if (hits.length === 0) {
      // No obstacles - return empty slots
      return Array(this.numClosestObstacles).fill(null).map(() => ({
        angle: 0,
        distance: LIDAR.MAX_RANGE,
        dirX: 0,
        dirZ: 1,
        hitPoint: null,
      }));
    }
    
    // Sort by distance (closest first)
    const sortedHits = [...hits].sort((a, b) => a.distance - b.distance);
    
    const selected = [];
    const minSepRad = this.minAngularSeparation;
    
    for (const hit of sortedHits) {
      if (selected.length >= this.numClosestObstacles) break;
      
      // Check angular separation from already selected obstacles
      let tooClose = false;
      for (const sel of selected) {
        const angleDiff = Math.abs(this.normalizeAngle(hit.angle - sel.angle));
        if (angleDiff < minSepRad) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        // Calculate local direction (normalized)
        const localDir = this.rayDirections[hit.rayIndex];
        selected.push({
          angle: hit.angle,
          distance: hit.distance,
          dirX: localDir.x, // Local X component (right is positive)
          dirZ: localDir.z, // Local Z component (forward is positive)
          hitPoint: hit.hitPoint,
          worldDir: hit.worldDir,
        });
      }
    }
    
    // Fill remaining slots with max-range "no obstacle" entries
    while (selected.length < this.numClosestObstacles) {
      selected.push({
        angle: 0,
        distance: LIDAR.MAX_RANGE,
        dirX: 0,
        dirZ: 1,
        hitPoint: null,
      });
    }
    
    return selected;
  }
  
  /**
   * Normalize angle to [-PI, PI]
   */
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  /**
   * Update visualization for closest obstacles
   */
  updateVisualization(droneX, droneY, droneZ) {
    const shouldVisualize = this.visualizationEnabled;
    if (!shouldVisualize) return;
    
    const rayPositions = this.rayLines.geometry.attributes.position.array;
    const droneYaw = this.drone.yaw;
    const cosYaw = Math.cos(droneYaw);
    const sinYaw = Math.sin(droneYaw);
    
    // Visualize closest obstacles
    for (let i = 0; i < this.numClosestObstacles; i++) {
      const obs = this.closestObstacles[i];
      const rayIdx = i * 6;
      
      // Start at drone
      rayPositions[rayIdx + 0] = droneX;
      rayPositions[rayIdx + 1] = droneY;
      rayPositions[rayIdx + 2] = droneZ;
      
      if (obs && obs.hitPoint) {
        // End at hit point
        rayPositions[rayIdx + 3] = obs.hitPoint.x;
        rayPositions[rayIdx + 4] = obs.hitPoint.y;
        rayPositions[rayIdx + 5] = obs.hitPoint.z;
        
        // Update hit sphere
        this._instanceMatrix.setPosition(obs.hitPoint.x, obs.hitPoint.y, obs.hitPoint.z);
      } else {
        // No obstacle - extend to max range in forward direction
        rayPositions[rayIdx + 3] = droneX + cosYaw * LIDAR.MAX_RANGE;
        rayPositions[rayIdx + 4] = droneY;
        rayPositions[rayIdx + 5] = droneZ + sinYaw * LIDAR.MAX_RANGE;
        
        this._instanceMatrix.setPosition(this._hiddenPosition.x, this._hiddenPosition.y, this._hiddenPosition.z);
      }
      this.hitSpheres.setMatrixAt(i, this._instanceMatrix);
    }
    
    // Visualize nadir ray
    const nadirVisIdx = this.numClosestObstacles;
    rayPositions[nadirVisIdx * 6 + 0] = droneX;
    rayPositions[nadirVisIdx * 6 + 1] = droneY;
    rayPositions[nadirVisIdx * 6 + 2] = droneZ;
    
    const nadirDist = this.distances[this.nadirIndex];
    const nadirHit = nadirDist < LIDAR.MAX_RANGE;
    rayPositions[nadirVisIdx * 6 + 3] = droneX;
    rayPositions[nadirVisIdx * 6 + 4] = droneY - nadirDist;
    rayPositions[nadirVisIdx * 6 + 5] = droneZ;
    
    if (nadirHit) {
      this.nadirSphere.position.set(droneX, droneY - nadirDist, droneZ);
      this.nadirSphere.visible = true;
    } else {
      this.nadirSphere.visible = false;
    }
    
    // Visualize zenith ray
    const zenithVisIdx = this.numClosestObstacles + 1;
    rayPositions[zenithVisIdx * 6 + 0] = droneX;
    rayPositions[zenithVisIdx * 6 + 1] = droneY;
    rayPositions[zenithVisIdx * 6 + 2] = droneZ;
    
    const zenithDist = this.distances[this.zenithIndex];
    const zenithHit = zenithDist < LIDAR.MAX_RANGE;
    rayPositions[zenithVisIdx * 6 + 3] = droneX;
    rayPositions[zenithVisIdx * 6 + 4] = droneY + zenithDist;
    rayPositions[zenithVisIdx * 6 + 5] = droneZ;
    
    if (zenithHit) {
      this.zenithSphere.position.set(droneX, droneY + zenithDist, droneZ);
      this.zenithSphere.visible = true;
    } else {
      this.zenithSphere.visible = false;
    }
    
    // Mark geometries as needing update
    this.rayLines.geometry.attributes.position.needsUpdate = true;
    this.hitSpheres.instanceMatrix.needsUpdate = true;
    
    // Update target line
    this.updateTargetLine(droneX, droneY, droneZ);
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
   * Get closest obstacles data for RL observation
   * Returns flat array: [dirX1, dirZ1, dist1, dirX2, dirZ2, dist2, ...]
   * Directions are normalized local coordinates
   * Distances are normalized to [0, 1]
   */
  getClosestObstaclesFlat() {
    const result = [];
    for (const obs of this.closestObstacles) {
      result.push(obs.dirX);           // Local X direction
      result.push(obs.dirZ);           // Local Z direction
      result.push(obs.distance / LIDAR.MAX_RANGE); // Normalized distance
    }
    return result;
  }
  
  /**
   * Get closest obstacles as objects
   * @returns {Array} - [{angle, distance, dirX, dirZ}, ...]
   */
  getClosestObstacles() {
    return this.closestObstacles;
  }

  /**
   * Get normalized distances (0-1 range) - legacy, returns all scan rays
   */
  getNormalizedDistances() {
    return this.distances.map(d => d / LIDAR.MAX_RANGE);
  }

  /**
   * Get raw distances - legacy, returns all scan rays
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
   * Get minimum distance across all horizontal rays
   */
  getMinDistance() {
    let min = LIDAR.MAX_RANGE;
    for (let i = 0; i < this.numScanRays; i++) {
      if (this.distances[i] < min) min = this.distances[i];
    }
    return min;
  }

  /**
   * Get minimum distance in forward direction (center rays)
   */
  getForwardMinDistance() {
    const numScan = this.numScanRays;
    const hCenter = Math.floor(numScan / 2);
    const hRange = Math.max(1, Math.floor(numScan / 8)); // Check ~25% of rays around center
    
    let minDist = LIDAR.MAX_RANGE;
    for (let h = hCenter - hRange; h <= hCenter + hRange; h++) {
      if (h >= 0 && h < numScan) {
        if (this.distances[h] < minDist) {
          minDist = this.distances[h];
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
   * Get number of scan rays (excluding nadir/zenith)
   */
  getNumScanRays() {
    return this.numScanRays;
  }

  /**
   * Get total number of rays (including nadir/zenith)
   */
  getNumRays() {
    return this.numRays;
  }
  
  /**
   * Get number of closest obstacles tracked
   */
  getNumClosestObstacles() {
    return this.numClosestObstacles;
  }
}
