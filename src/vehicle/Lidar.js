/**
 * 3D LiDAR sensor simulation for drone navigation
 * OPTIMIZED: Reduced rays, frame skipping, simplified visualization
 */
import * as THREE from 'three';
import { LIDAR } from '../config.js';

export class Lidar {
  constructor(drone) {
    this.drone = drone;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = LIDAR.MAX_RANGE;
    
    // Total rays = horizontal * vertical
    this.numRays = LIDAR.NUM_HORIZONTAL_RAYS * LIDAR.NUM_VERTICAL_RAYS;
    
    // Store latest readings
    this.distances = new Array(this.numRays).fill(LIDAR.MAX_RANGE);
    this.hitPoints = [];
    
    // Frame skipping for performance
    this.frameCounter = 0;
    this.scanInterval = 2; // Scan every 2 frames
    
    // Visualization (disabled by default)
    this.visualGroup = new THREE.Group();
    this.visualGroup.name = 'lidar_visual';
    this.visualGroup.visible = LIDAR.VISUALIZE;
    
    if (LIDAR.VISUALIZE) {
      this.setupVisualization();
    }
    
    // Pre-calculate ray directions
    this.rayDirections = this.calculateRayDirections();
    
    // Reusable vectors
    this._direction = new THREE.Vector3();
    this._origin = new THREE.Vector3();
  }

  /**
   * Calculate all ray directions (in local drone space)
   */
  calculateRayDirections() {
    const directions = [];
    
    const hFov = LIDAR.HORIZONTAL_FOV;
    const vFov = LIDAR.VERTICAL_FOV;
    const numH = LIDAR.NUM_HORIZONTAL_RAYS;
    const numV = LIDAR.NUM_VERTICAL_RAYS;
    
    for (let v = 0; v < numV; v++) {
      const verticalAngle = -vFov / 2 + (v / Math.max(numV - 1, 1)) * vFov;
      
      for (let h = 0; h < numH; h++) {
        const horizontalAngle = -hFov / 2 + (h / Math.max(numH - 1, 1)) * hFov;
        
        const cosV = Math.cos(verticalAngle);
        const sinV = Math.sin(verticalAngle);
        const cosH = Math.cos(horizontalAngle);
        const sinH = Math.sin(horizontalAngle);
        
        directions.push({
          x: sinH * cosV,
          y: sinV,
          z: cosH * cosV,
        });
      }
    }
    
    return directions;
  }

  /**
   * Setup simplified visualization
   */
  setupVisualization() {
    // Just show hit points, not rays (much faster)
    const hitGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.numRays * 3);
    hitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const hitMaterial = new THREE.PointsMaterial({
      color: LIDAR.HIT_COLOR,
      size: 0.3,
      sizeAttenuation: true,
    });
    
    this.hitPointsCloud = new THREE.Points(hitGeometry, hitMaterial);
    this.visualGroup.add(this.hitPointsCloud);
  }

  /**
   * Perform 3D LiDAR scan with frame skipping
   */
  scan(obstacles) {
    // Frame skipping for performance
    this.frameCounter++;
    if (this.frameCounter % this.scanInterval !== 0) {
      return this.distances;
    }
    
    this.hitPoints = [];
    
    const droneX = this.drone.x;
    const droneY = this.drone.y;
    const droneZ = this.drone.z;
    const droneYaw = this.drone.yaw;
    
    const cosYaw = Math.cos(droneYaw);
    const sinYaw = Math.sin(droneYaw);
    
    this._origin.set(droneX, droneY, droneZ);
    
    const positions = LIDAR.VISUALIZE && this.hitPointsCloud 
      ? this.hitPointsCloud.geometry.attributes.position.array 
      : null;
    
    for (let i = 0; i < this.numRays; i++) {
      const localDir = this.rayDirections[i];
      
      // Transform direction from local to world space
      this._direction.set(
        localDir.x * cosYaw + localDir.z * sinYaw,
        localDir.y,
        -localDir.x * sinYaw + localDir.z * cosYaw
      ).normalize();
      
      this.raycaster.set(this._origin, this._direction);
      const intersections = this.raycaster.intersectObjects(obstacles, false);
      
      if (intersections.length > 0) {
        const hit = intersections[0];
        this.distances[i] = hit.distance;
        
        if (positions) {
          positions[i * 3] = hit.point.x;
          positions[i * 3 + 1] = hit.point.y;
          positions[i * 3 + 2] = hit.point.z;
        }
        
        this.hitPoints.push({
          x: hit.point.x,
          y: hit.point.y,
          z: hit.point.z,
          distance: hit.distance,
          rayIndex: i,
        });
      } else {
        this.distances[i] = LIDAR.MAX_RANGE;
        
        if (positions) {
          // Hide non-hit points far away
          positions[i * 3] = droneX;
          positions[i * 3 + 1] = droneY - 1000;
          positions[i * 3 + 2] = droneZ;
        }
      }
    }
    
    if (positions && this.hitPointsCloud) {
      this.hitPointsCloud.geometry.attributes.position.needsUpdate = true;
    }
    
    return this.distances;
  }

  getNormalizedDistances() {
    return this.distances.map(d => d / LIDAR.MAX_RANGE);
  }

  getDistances() {
    return this.distances;
  }

  getHitPoints() {
    return this.hitPoints;
  }

  getMinDistance() {
    return Math.min(...this.distances);
  }

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

  isPathClear(minClearance = 3) {
    return this.getForwardMinDistance() > minClearance;
  }

  getVisualGroup() {
    return this.visualGroup;
  }

  setVisualizationEnabled(enabled) {
    this.visualGroup.visible = enabled;
  }
}
