/**
 * Drone - flying box with 6-axis movement
 * 
 * Physics model:
 * - Controls are in LOCAL coordinates (relative to drone facing)
 * - thrustZ > 0 = forward (direction drone is facing)
 * - thrustX > 0 = strafe right
 * - thrustY > 0 = up
 * - Velocity has inertia (drag-based deceleration)
 * 
 * Uses CollisionSystem for robust collision detection:
 * - Three.js Box3 for accurate AABB collision
 * - Swept collision detection to prevent tunneling
 * - Proper terrain and obstacle collision
 */
import * as THREE from 'three';
import { DRONE, COLORS } from '../config.js';
import { CollisionSystem } from '../collision/index.js';

export class Drone {
  constructor() {
    // Position state (world coordinates)
    this.x = 0;
    this.y = 5;
    this.z = 0;
    
    // Velocity state (world coordinates)
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    
    // Facing direction (yaw only)
    this.yaw = 0;
    
    // Control inputs in LOCAL coordinates (-1 to 1)
    // These are relative to drone's facing direction
    this.thrustX = 0;  // Strafe: negative=left, positive=right
    this.thrustY = 0;  // Vertical: negative=down, positive=up
    this.thrustZ = 0;  // Forward/Back: negative=back, positive=forward
    
    // Three.js mesh
    this.mesh = this.createMesh();
    
    // Light for the drone
    this.droneLight = this.createLight();
    
    // Stats
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    
    // Collision system
    this.collisionSystem = new CollisionSystem();
    this.collisionSystem.setDroneSize(DRONE.SIZE, DRONE.SIZE * 0.35, DRONE.SIZE);
    
    // Collision state
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionFrozen = false; // Freeze drone completely after collision
    
    // Collision callback
    this.onCollision = null;
    
    // Legacy collision checker reference (for backwards compatibility)
    this.collisionChecker = null;
    
    // Debug logging throttling
    this.lastDebugLog = 0;
  }
  
  /**
   * Set collision checker (forest generator reference)
   * This initializes the collision system with terrain and obstacles
   */
  setCollisionChecker(checker) {
    this.collisionChecker = checker;
    
    if (checker) {
      // Set terrain height function
      this.collisionSystem.setTerrainHeightFunction((x, z) => {
        return checker.getTerrainHeight(x, z);
      });
      
      // Clear and add all obstacles
      this.collisionSystem.clearObstacles();
      const obstacles = checker.getObstacles();
      this.collisionSystem.addObstacles(obstacles);
      
      // Set world bounds (no ceiling - use very high value)
      const halfSize = 150 / 2 - 5; // FOREST.SIZE / 2 with margin
      this.collisionSystem.setWorldBounds(
        -halfSize, halfSize,  // X bounds
        -100, 1000,           // Y bounds (no ceiling!)
        -halfSize, halfSize   // Z bounds
      );
      
      console.log(`Collision system initialized with ${obstacles.length} obstacles.`);
    }
  }
  
  /**
   * Refresh collision data (call after scene regeneration)
   */
  refreshCollisionData() {
    if (this.collisionChecker) {
      this.collisionSystem.clearObstacles();
      const obstacles = this.collisionChecker.getObstacles();
      this.collisionSystem.addObstacles(obstacles);
      console.log(`Collision data refreshed. ${obstacles.length} obstacles.`);
    }
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
   * Update drone physics with swept collision detection
   * 
   * Controls are in LOCAL coordinates:
   * - thrustZ > 0 pushes drone forward (in direction of yaw)
   * - thrustX > 0 pushes drone right (perpendicular to yaw)
   * - thrustY > 0 pushes drone up
   * 
   * Physics has inertia - velocity persists and decays with drag
   */
  update(dt) {
    // If frozen from collision, do nothing
    if (this.collisionFrozen) {
      this.lastCollision = true;
      return;
    }
    
    // Reset collision state at start of frame
    this.lastCollision = false;
    this.lastCollisionType = null;
    
    // FIRST: Check if we're already in collision (before any physics)
    const currentCollision = this.collisionSystem.checkCollision(this.x, this.y, this.z);
    if (currentCollision.collided) {
      this.lastCollision = true;
      this.lastCollisionType = currentCollision.type;
      this.collisionFrozen = true;
      
      // Zero velocity
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      
      if (this.onCollision) {
        this.onCollision(currentCollision.type);
      }
      return;
    }
    
    // Convert LOCAL thrust to WORLD acceleration
    // Local Z (forward) maps to world based on yaw
    // Local X (right) maps to world based on yaw
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    
    // Local to world transformation for thrust
    // Forward (local +Z) -> world: (sin(yaw), 0, cos(yaw))
    // Right (local +X) -> world: (cos(yaw), 0, -sin(yaw))
    const worldAccelX = (this.thrustZ * sinYaw + this.thrustX * cosYaw) * DRONE.MAX_ACCELERATION;
    const worldAccelZ = (this.thrustZ * cosYaw - this.thrustX * sinYaw) * DRONE.MAX_ACCELERATION;
    const worldAccelY = this.thrustY * DRONE.MAX_ACCELERATION;
    
    // Apply acceleration to velocity (with inertia)
    this.vx += worldAccelX * dt;
    this.vy += worldAccelY * dt;
    this.vz += worldAccelZ * dt;
    
    // Apply drag (creates inertia feel)
    const drag = DRONE.DRAG_COEFFICIENT;
    this.vx *= (1 - drag * dt);
    this.vy *= (1 - drag * dt);
    this.vz *= (1 - drag * dt);
    
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
    
    // Calculate proposed movement
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const dz = this.vz * dt;
    const moveDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Swept collision detection along movement path
    if (moveDistance > 0.0001) {
      const sweptResult = this.collisionSystem.checkSweptCollision(
        this.x, this.y, this.z,
        this.x + dx, this.y + dy, this.z + dz
      );
      
      if (sweptResult.collided) {
        this.lastCollision = true;
        this.lastCollisionType = sweptResult.type;
        this.collisionFrozen = true;
        
        // Zero velocity
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        
        if (this.onCollision) {
          this.onCollision(sweptResult.type);
        }
        return;
      }
    }
    
    // No collision - update position
    this.x += dx;
    this.y += dy;
    this.z += dz;
    
    // Track distance
    this.distanceTraveled += moveDistance;
    
    // Yaw is now FIXED - drone doesn't auto-rotate to face movement
    // The agent must learn to control direction via thrust
    
    // Update mesh
    this.updateMesh();
  }
  
  /**
   * Check collision at a specific position
   * Uses the new CollisionSystem
   * @returns {Object} - { collided, type }
   */
  checkCollisionAtPosition(posX, posY, posZ) {
    const result = this.collisionSystem.checkCollision(posX, posY, posZ);
    return {
      collided: result.collided,
      type: result.type,
    };
  }
  
  /**
   * Legacy method for backwards compatibility
   * @deprecated Use checkCollisionAtPosition instead
   */
  checkCollision(newX, newY, newZ) {
    return this.checkCollisionAtPosition(newX, newY, newZ);
  }
  
  /**
   * Check if drone had a collision in the last update
   */
  hadCollision() {
    return this.lastCollision;
  }
  
  /**
   * Get the type of the last collision (if any)
   * @returns {string|null} - 'terrain', 'trunk', 'canopy', 'bush', or null
   */
  getLastCollisionType() {
    return this.lastCollisionType;
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
   * Set drone yaw (facing direction)
   * @param {number} yaw - Yaw angle in radians
   */
  setYaw(yaw) {
    this.yaw = yaw;
    this.updateMesh();
  }
  
  /**
   * Make drone face a target position
   * Sets yaw so that drone's forward direction (+Z local) points at target
   * @param {number} targetX - Target X position in world coords
   * @param {number} targetZ - Target Z position in world coords
   */
  lookAt(targetX, targetZ) {
    const dx = targetX - this.x;
    const dz = targetZ - this.z;
    
    // Only update yaw if target is not at same position
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      // atan2(dx, dz) gives angle where +Z is 0, +X is PI/2
      this.yaw = Math.atan2(dx, dz);
    }
    
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
   * Includes both world and local velocities
   */
  getState() {
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    const localVel = this.getLocalVelocity();
    
    return {
      // World position
      x: this.x,
      y: this.y,
      z: this.z,
      // World velocity
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      // Local velocity (relative to drone facing)
      localVx: localVel.x,  // Right/left speed
      localVy: localVel.y,  // Up/down speed
      localVz: localVel.z,  // Forward/back speed
      // Speed
      speed: speed,
      normalizedSpeed: speed / DRONE.MAX_SPEED,
      // Orientation
      yaw: this.yaw,
      // Current controls
      thrustX: this.thrustX,
      thrustY: this.thrustY,
      thrustZ: this.thrustZ,
    };
  }
  
  /**
   * Get velocity in LOCAL coordinates (relative to drone facing)
   * localVz > 0 means moving forward
   * localVx > 0 means moving right
   */
  getLocalVelocity() {
    const cos = Math.cos(-this.yaw);
    const sin = Math.sin(-this.yaw);
    
    return {
      x: this.vx * cos - this.vz * sin,  // Right/left
      y: this.vy,                          // Up/down (same in both frames)
      z: this.vx * sin + this.vz * cos,   // Forward/back
    };
  }

  /**
   * Get forward direction vector (based on yaw) in world coords
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
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionFrozen = false;
    this.updateMesh();
  }

  /**
   * Get the Three.js mesh
   */
  getMesh() {
    return this.mesh;
  }
  
  /**
   * Get the collision system (for debugging/visualization)
   */
  getCollisionSystem() {
    return this.collisionSystem;
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
