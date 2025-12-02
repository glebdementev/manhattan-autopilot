/**
 * LiDAR sensor simulation using Three.js raycasting
 */
import * as THREE from 'three';
import { LIDAR, VEHICLE } from '../config.js';

export class Lidar {
  constructor(car) {
    this.car = car;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = LIDAR.MAX_RANGE;
    
    // Store latest readings
    this.distances = new Array(LIDAR.NUM_RAYS).fill(LIDAR.MAX_RANGE);
    this.hitPoints = [];
    
    // Visualization
    this.visualGroup = new THREE.Group();
    this.visualGroup.name = 'lidar_visual';
    this.rayLines = [];
    this.hitMarkers = [];
    
    if (LIDAR.VISUALIZE) {
      this.setupVisualization();
    }
    
    // Pre-calculate ray angles (relative to car heading)
    this.rayAngles = [];
    const startAngle = -LIDAR.FOV / 2;
    const angleStep = LIDAR.FOV / (LIDAR.NUM_RAYS - 1);
    
    for (let i = 0; i < LIDAR.NUM_RAYS; i++) {
      this.rayAngles.push(startAngle + i * angleStep);
    }
  }

  /**
   * Setup visualization elements
   */
  setupVisualization() {
    const rayMaterial = new THREE.LineBasicMaterial({ 
      color: LIDAR.RAY_COLOR,
      opacity: 0.3,
      transparent: true,
    });
    
    const hitMaterial = new THREE.MeshBasicMaterial({ 
      color: LIDAR.HIT_COLOR,
    });
    const hitGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    
    for (let i = 0; i < LIDAR.NUM_RAYS; i++) {
      // Ray line
      const lineGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 points * 3 coords
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const line = new THREE.Line(lineGeometry, rayMaterial);
      line.frustumCulled = false;
      this.rayLines.push(line);
      this.visualGroup.add(line);
      
      // Hit marker
      const marker = new THREE.Mesh(hitGeometry, hitMaterial);
      marker.visible = false;
      this.hitMarkers.push(marker);
      this.visualGroup.add(marker);
    }
  }

  /**
   * Perform LiDAR scan
   * @param {Array} obstacles - Array of Three.js objects to raycast against
   */
  scan(obstacles) {
    this.hitPoints = [];
    
    // Get car position and heading
    const carPos = new THREE.Vector3(this.car.x, LIDAR.HEIGHT, this.car.z);
    
    for (let i = 0; i < LIDAR.NUM_RAYS; i++) {
      // Calculate ray direction in world space
      const worldAngle = this.car.heading + this.rayAngles[i];
      const direction = new THREE.Vector3(
        Math.cos(worldAngle),
        0,
        Math.sin(worldAngle)
      ).normalize();
      
      // Perform raycast
      this.raycaster.set(carPos, direction);
      const intersections = this.raycaster.intersectObjects(obstacles, true);
      
      if (intersections.length > 0) {
        const hit = intersections[0];
        this.distances[i] = hit.distance;
        this.hitPoints.push({
          x: hit.point.x,
          y: hit.point.y,
          z: hit.point.z,
          distance: hit.distance,
          rayIndex: i,
        });
        
        // Update visualization
        if (LIDAR.VISUALIZE) {
          this.updateRayVisual(i, carPos, hit.point, true);
        }
      } else {
        this.distances[i] = LIDAR.MAX_RANGE;
        
        // Update visualization (no hit)
        if (LIDAR.VISUALIZE) {
          const endPoint = new THREE.Vector3(
            carPos.x + direction.x * LIDAR.MAX_RANGE,
            carPos.y,
            carPos.z + direction.z * LIDAR.MAX_RANGE
          );
          this.updateRayVisual(i, carPos, endPoint, false);
        }
      }
    }
    
    return this.distances;
  }

  /**
   * Update ray visualization
   */
  updateRayVisual(index, start, end, hasHit) {
    const line = this.rayLines[index];
    const positions = line.geometry.attributes.position.array;
    
    positions[0] = start.x;
    positions[1] = start.y;
    positions[2] = start.z;
    positions[3] = end.x;
    positions[4] = end.y;
    positions[5] = end.z;
    
    line.geometry.attributes.position.needsUpdate = true;
    
    // Update hit marker
    const marker = this.hitMarkers[index];
    if (hasHit) {
      marker.position.copy(end);
      marker.visible = true;
    } else {
      marker.visible = false;
    }
  }

  /**
   * Get normalized distances (0-1, where 1 = max range)
   */
  getNormalizedDistances() {
    return this.distances.map(d => d / LIDAR.MAX_RANGE);
  }

  /**
   * Get distances array
   */
  getDistances() {
    return this.distances;
  }

  /**
   * Get hit points
   */
  getHitPoints() {
    return this.hitPoints;
  }

  /**
   * Get minimum distance (for collision detection)
   */
  getMinDistance() {
    return Math.min(...this.distances);
  }

  /**
   * Get distances in a specific angular range
   */
  getDistancesInRange(startAngle, endAngle) {
    const results = [];
    
    for (let i = 0; i < LIDAR.NUM_RAYS; i++) {
      const angle = this.rayAngles[i];
      if (angle >= startAngle && angle <= endAngle) {
        results.push(this.distances[i]);
      }
    }
    
    return results;
  }

  /**
   * Get forward-facing distances (center rays)
   */
  getForwardDistances(fov = Math.PI / 4) {
    return this.getDistancesInRange(-fov / 2, fov / 2);
  }

  /**
   * Check if path ahead is clear
   */
  isPathClear(minClearance = 5) {
    const forwardDist = this.getForwardDistances();
    return Math.min(...forwardDist) > minClearance;
  }

  /**
   * Get the visualization group
   */
  getVisualGroup() {
    return this.visualGroup;
  }

  /**
   * Toggle visualization
   */
  setVisualizationEnabled(enabled) {
    this.visualGroup.visible = enabled;
  }
}

