/**
 * Drone - flying box with 6-axis movement
 * Simple physics model: no pitch/roll, just position-based movement
 * Includes box-based collision detection with terrain and obstacles
 */
import * as THREE from 'three';
import { DRONE, COLORS } from '../config.js';

export class Drone {
  constructor() {
    // Position state
    this.x = 0;
    this.y = 5;
    this.z = 0;
    
    // Velocity state
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    
    // Facing direction (yaw only, for visual orientation)
    this.yaw = 0;
    
    // Control inputs (thrust in each axis, -1 to 1)
    this.thrustX = 0;  // Left/Right
    this.thrustY = 0;  // Up/Down
    this.thrustZ = 0;  // Forward/Back
    
    // Three.js mesh
    this.mesh = this.createMesh();
    
    // Light for the drone
    this.droneLight = this.createLight();
    
    // Stats
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    
    // Collision detection - use box dimensions
    this.collisionChecker = null;
    this.boxHalfWidth = DRONE.SIZE / 2;   // Half-width (X axis)
    this.boxHalfHeight = DRONE.SIZE * 0.35 / 2; // Half-height (Y axis)
    this.boxHalfDepth = DRONE.SIZE / 2;   // Half-depth (Z axis)
    this.lastCollision = false;
    
    // Collision callback
    this.onCollision = null;
  }
  
  /**
   * Set collision checker (forest generator reference)
   */
  setCollisionChecker(checker) {
    this.collisionChecker = checker;
  }
  
  /**
   * Set collision callback (called when drone collides with something)
   */
  setOnCollision(callback) {
    this.onCollision = callback;
  }

  /**
   * Create the drone mesh - Blue box is the collision box
   */
  createMesh() {
    const group = new THREE.Group();
    group.name = 'drone';
    
    const size = DRONE.SIZE;
    
    // Main body (box) - This IS the collision box
    const bodyGeometry = new THREE.BoxGeometry(size, size * 0.35, size);
    this.bodyMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.DRONE_CLASSIC,
      emissive: COLORS.DRONE_CLASSIC,
      emissiveIntensity: 0.15,
    });
    const body = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    body.castShadow = true;
    body.name = 'body';
    group.add(body);
    
    // Front indicator (simple box)
    const frontGeom = new THREE.BoxGeometry(size * 0.15, size * 0.1, size * 0.05);
    const frontMat = new THREE.MeshBasicMaterial({ color: COLORS.DRONE_LIGHT });
    const front = new THREE.Mesh(frontGeom, frontMat);
    front.position.set(0, 0, size * 0.55);
    group.add(front);
    
    return group;
  }

  /**
   * Create point light attached to drone
   */
  createLight() {
    const light = new THREE.PointLight(COLORS.DRONE_LIGHT, 2, 15);
    light.castShadow = false;
    this.mesh.add(light);
    return light;
  }

  /**
   * Update drone physics with collision detection
   */
  update(dt) {
    // Calculate acceleration from thrust
    const accelX = this.thrustX * DRONE.MAX_ACCELERATION;
    const accelZ = this.thrustZ * DRONE.MAX_ACCELERATION;
    const accelY = this.thrustY * DRONE.MAX_ACCELERATION - DRONE.HOVER_POWER; // Gravity offset
    
    // Apply drag
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    const dragFactor = 1 - DRONE.DRAG_COEFFICIENT * dt;
    
    // Update velocity
    this.vx = (this.vx + accelX * dt) * dragFactor;
    this.vy = (this.vy + accelY * dt) * dragFactor;
    this.vz = (this.vz + accelZ * dt) * dragFactor;
    
    // Clamp speed
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    if (currentSpeed > DRONE.MAX_SPEED) {
      const scale = DRONE.MAX_SPEED / currentSpeed;
      this.vx *= scale;
      this.vy *= scale;
      this.vz *= scale;
    }
    
    // Track max speed
    if (currentSpeed > this.maxSpeedReached) {
      this.maxSpeedReached = currentSpeed;
    }
    
    // Calculate proposed new position
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const dz = this.vz * dt;
    
    let newX = this.x + dx;
    let newY = this.y + dy;
    let newZ = this.z + dz;
    
    // Collision detection and response
    this.lastCollision = false;
    if (this.collisionChecker) {
      const collision = this.checkCollision(newX, newY, newZ);
      
      if (collision.collided) {
        this.lastCollision = true;
        
        // Trigger collision callback (for restart)
        if (this.onCollision) {
          this.onCollision(collision.type);
        }
        
        // Don't update position - collision callback will handle restart
        return;
      }
    }
    
    // Update position
    this.x = newX;
    this.y = newY;
    this.z = newZ;
    
    // Track distance
    this.distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Update yaw to face movement direction (if moving horizontally)
    const horizontalSpeed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    if (horizontalSpeed > 0.5) {
      const targetYaw = Math.atan2(this.vx, this.vz);
      // Smooth yaw transition
      let yawDiff = targetYaw - this.yaw;
      while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
      while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
      this.yaw += yawDiff * 0.1;
    }
    
    // Update mesh
    this.updateMesh();
  }
  
  /**
   * Check collision at proposed position using box-based collision
   * Returns collision info with type of collision
   */
  checkCollision(newX, newY, newZ) {
    const result = {
      collided: false,
      type: null, // 'terrain', 'tree', 'bush'
    };
    
    if (!this.collisionChecker) return result;
    
    // Drone bounding box at new position
    const droneMinX = newX - this.boxHalfWidth;
    const droneMaxX = newX + this.boxHalfWidth;
    const droneMinY = newY - this.boxHalfHeight;
    const droneMaxY = newY + this.boxHalfHeight;
    const droneMinZ = newZ - this.boxHalfDepth;
    const droneMaxZ = newZ + this.boxHalfDepth;
    
    // Check terrain collision at all 4 corners and center of the drone box
    const checkPoints = [
      { x: newX, z: newZ },                           // Center
      { x: droneMinX, z: droneMinZ },                 // Corner 1
      { x: droneMaxX, z: droneMinZ },                 // Corner 2
      { x: droneMinX, z: droneMaxZ },                 // Corner 3
      { x: droneMaxX, z: droneMaxZ },                 // Corner 4
    ];
    
    for (const point of checkPoints) {
      const terrainY = this.collisionChecker.getTerrainHeight(point.x, point.z);
      if (droneMinY < terrainY) {
        result.collided = true;
        result.type = 'terrain';
        return result;
      }
    }
    
    // Check obstacle collisions (trees, bushes) using box-cylinder intersection
    const obstacles = this.collisionChecker.getObstacles();
    
    for (const obstacle of obstacles) {
      if (this.checkBoxCylinderCollision(
        droneMinX, droneMaxX, droneMinY, droneMaxY, droneMinZ, droneMaxZ,
        obstacle
      )) {
        result.collided = true;
        result.type = obstacle.type || 'tree';
        return result;
      }
    }
    
    return result;
  }
  
  /**
   * Check box-cylinder collision (AABB vs cylinder)
   * Drone is a box, obstacles are cylinders
   */
  checkBoxCylinderCollision(boxMinX, boxMaxX, boxMinY, boxMaxY, boxMinZ, boxMaxZ, obstacle) {
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
   * Check if drone had a collision in the last update
   */
  hadCollision() {
    return this.lastCollision;
  }

  /**
   * Update Three.js mesh to match state
   */
  updateMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.yaw;
    
    // Slight tilt based on horizontal movement (visual only)
    const tiltAmount = 0.15;
    this.mesh.rotation.x = -this.vz * tiltAmount / DRONE.MAX_SPEED;
    this.mesh.rotation.z = this.vx * tiltAmount / DRONE.MAX_SPEED;
  }

  /**
   * Set drone position
   */
  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.updateMesh();
  }

  /**
   * Set control inputs
   */
  setControls(thrustX, thrustY, thrustZ) {
    this.thrustX = Math.max(-1, Math.min(1, thrustX));
    this.thrustY = Math.max(-1, Math.min(1, thrustY));
    this.thrustZ = Math.max(-1, Math.min(1, thrustZ));
  }

  /**
   * Get current state vector
   */
  getState() {
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      speed: speed,
      normalizedSpeed: speed / DRONE.MAX_SPEED,
      yaw: this.yaw,
      thrustX: this.thrustX,
      thrustY: this.thrustY,
      thrustZ: this.thrustZ,
    };
  }

  /**
   * Get forward direction vector (based on yaw)
   */
  getForwardVector() {
    return {
      x: Math.sin(this.yaw),
      z: Math.cos(this.yaw),
    };
  }

  /**
   * Transform world coordinates to drone-local coordinates
   */
  worldToLocal(worldX, worldY, worldZ) {
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    const dz = worldZ - this.z;
    
    const cos = Math.cos(-this.yaw);
    const sin = Math.sin(-this.yaw);
    
    return {
      x: dx * cos - dz * sin,
      y: dy,
      z: dx * sin + dz * cos,
    };
  }

  /**
   * Reset drone state
   */
  reset() {
    this.x = 0;
    this.y = 5;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.thrustX = 0;
    this.thrustY = 0;
    this.thrustZ = 0;
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    this.updateMesh();
  }

  /**
   * Get the Three.js mesh
   */
  getMesh() {
    return this.mesh;
  }

  /**
   * Set drone body color based on mode
   */
  setMode(mode) {
    let color;
    switch (mode) {
      case 'autopilot':
        color = COLORS.DRONE_AUTOPILOT;
        break;
      case 'manual':
        color = COLORS.DRONE_MANUAL;
        break;
      case 'classic':
      default:
        color = COLORS.DRONE_CLASSIC;
        break;
    }
    
    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(color);
      this.bodyMaterial.emissive.setHex(color);
      this.bodyMaterial.emissiveIntensity = 0.2;
    }
  }
}

