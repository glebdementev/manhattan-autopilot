/**
 * DronePhysics - handles drone movement, collision detection, and physics simulation
 * 
 * Uses LOCAL velocity setpoint control:
 * - forward/back velocity in drone's facing direction
 * - up/down velocity in world Y
 * - yaw rate for turning left/right
 */
import { DRONE } from '../config.js';
import { MeshCollider } from '../collision/MeshCollider.js';
import { VelocityController } from './VelocityController.js';

export class DronePhysics {
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
    this.yawRate = 0; // Current yaw angular velocity
    
    // Velocity controller (converts local setpoints to world thrust)
    this.velocityController = new VelocityController();
    
    // Stats
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    
    // Mesh-based collision system
    this.meshCollider = new MeshCollider();
    this.meshCollider.setDroneRadius(DRONE.SIZE / 2);
    
    // Terrain height function
    this.getTerrainHeight = null;
    
    // Collision state
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionFrozen = false;
    
    // Collision callback
    this.onCollision = null;
    
    // Forest reference for terrain
    this.collisionChecker = null;
  }
  
  /**
   * Set collision checker (forest generator reference)
   */
  setCollisionChecker(checker) {
    this.collisionChecker = checker;
    
    if (checker) {
      this.getTerrainHeight = (x, z) => checker.getTerrainHeight(x, z);
      
      // Set mesh targets for collision
      const targets = checker.getRaycastTargets();
      this.meshCollider.setTargets(targets);
      
      console.log(`Mesh collision initialized with ${targets.length} target meshes.`);
    }
  }
  
  /**
   * Refresh collision data (call after scene regeneration)
   */
  refreshCollisionData() {
    if (this.collisionChecker) {
      const targets = this.collisionChecker.getRaycastTargets();
      this.meshCollider.setTargets(targets);
      console.log(`Mesh collision refreshed with ${targets.length} targets.`);
    }
  }
  
  /**
   * Set collision callback
   */
  setOnCollision(callback) {
    this.onCollision = callback;
  }
  
  /**
   * Set velocity setpoint in LOCAL coordinates (main control interface)
   * @param {number} forward - Forward velocity normalized [-1, 1] (positive = forward)
   * @param {number} vertical - Vertical velocity normalized [-1, 1] (positive = up)
   * @param {number} yawInput - Yaw rate normalized [-1, 1] (positive = turn right)
   */
  setVelocitySetpoint(forward, vertical, yawInput) {
    // Store yaw rate target (will be applied in update)
    this.targetYawRate = Math.max(-1, Math.min(1, yawInput)) * DRONE.MAX_YAW_RATE;
    
    // Set local velocity target (forward/back and vertical)
    this.velocityController.setTargetFromLocalAction(
      Math.max(-1, Math.min(1, forward)),
      Math.max(-1, Math.min(1, vertical))
    );
  }
  
  /**
   * Update drone physics with local velocity control
   * @returns {Object} - { moved: boolean, dx, dy, dz } for mesh update
   */
  update(dt) {
    if (this.collisionFrozen) {
      this.lastCollision = true;
      return { moved: false };
    }
    
    this.lastCollision = false;
    this.lastCollisionType = null;
    
    // Check terrain collision first
    if (this.getTerrainHeight) {
      const terrainY = this.getTerrainHeight(this.x, this.z);
      const droneBottom = this.y - DRONE.SIZE * 0.175; // half height
      if (droneBottom < terrainY) {
        this.handleCollision('terrain');
        return { moved: false };
      }
    }
    
    // Check mesh collision at current position
    const currentCollision = this.meshCollider.checkCollision(this.x, this.y, this.z);
    if (currentCollision.collided) {
      this.handleCollision(currentCollision.type);
      return { moved: false };
    }
    
    // Update yaw (turning)
    if (this.targetYawRate !== undefined) {
      // Smooth yaw rate change
      const yawAccel = DRONE.YAW_ACCELERATION || 8;
      const yawDiff = this.targetYawRate - this.yawRate;
      this.yawRate += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), yawAccel * dt);
      
      // Apply yaw drag
      this.yawRate *= (1 - DRONE.DRAG_COEFFICIENT * dt);
      
      // Update yaw angle
      this.yaw += this.yawRate * dt;
      
      // Normalize yaw to [-PI, PI]
      while (this.yaw > Math.PI) this.yaw -= 2 * Math.PI;
      while (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;
    }
    
    // Get local velocity from controller
    const localVel = this.velocityController.getLocalVelocity();
    
    // Get thrust from velocity controller (in local space)
    const thrust = this.velocityController.computeLocalThrust(this.vx, this.vy, this.vz, this.yaw);
    
    // Apply thrust as acceleration (already in world space from computeLocalThrust)
    const accelX = thrust.thrustX * DRONE.MAX_ACCELERATION;
    const accelY = thrust.thrustY * DRONE.MAX_ACCELERATION;
    const accelZ = thrust.thrustZ * DRONE.MAX_ACCELERATION;
    
    // Update velocity
    this.vx += accelX * dt;
    this.vy += accelY * dt;
    this.vz += accelZ * dt;
    
    // Apply drag
    const drag = DRONE.DRAG_COEFFICIENT;
    this.vx *= (1 - drag * dt);
    this.vy *= (1 - drag * dt);
    this.vz *= (1 - drag * dt);
    
    // Clamp horizontal speed (vx, vz) separately from vertical
    const horizSpeed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    if (horizSpeed > DRONE.MAX_SPEED) {
      const scale = DRONE.MAX_SPEED / horizSpeed;
      this.vx *= scale;
      this.vz *= scale;
    }
    
    // Clamp vertical speed
    if (Math.abs(this.vy) > DRONE.MAX_SPEED) {
      this.vy = Math.sign(this.vy) * DRONE.MAX_SPEED;
    }
    
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    if (currentSpeed > this.maxSpeedReached) {
      this.maxSpeedReached = currentSpeed;
    }
    
    // Calculate proposed movement
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const dz = this.vz * dt;
    const moveDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Check new position for terrain collision
    const newX = this.x + dx;
    const newY = this.y + dy;
    const newZ = this.z + dz;
    
    if (this.getTerrainHeight) {
      const terrainY = this.getTerrainHeight(newX, newZ);
      const droneBottom = newY - DRONE.SIZE * 0.175;
      if (droneBottom < terrainY) {
        this.handleCollision('terrain');
        return { moved: false };
      }
    }
    
    // Swept mesh collision detection
    if (moveDistance > 0.0001) {
      const sweptResult = this.meshCollider.checkSweptCollision(
        this.x, this.y, this.z,
        newX, newY, newZ
      );
      
      if (sweptResult.collided) {
        this.handleCollision(sweptResult.type);
        return { moved: false };
      }
    }
    
    // Update position
    this.x = newX;
    this.y = newY;
    this.z = newZ;
    this.distanceTraveled += moveDistance;
    
    return { moved: true, dx, dy, dz };
  }
  
  /**
   * Handle collision event
   */
  handleCollision(type) {
    this.lastCollision = true;
    this.lastCollisionType = type;
    this.collisionFrozen = true;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    
    if (this.onCollision) {
      this.onCollision(type);
    }
  }
  
  /**
   * Check collision at a specific position
   */
  checkCollisionAtPosition(posX, posY, posZ) {
    // Check terrain
    if (this.getTerrainHeight) {
      const terrainY = this.getTerrainHeight(posX, posZ);
      const droneBottom = posY - DRONE.SIZE * 0.175;
      if (droneBottom < terrainY) {
        return { collided: true, type: 'terrain' };
      }
    }
    
    // Check mesh collision
    const result = this.meshCollider.checkCollision(posX, posY, posZ);
    return { collided: result.collided, type: result.type };
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
  }
  
  /**
   * Set drone yaw
   */
  setYaw(yaw) {
    this.yaw = yaw;
  }
  
  /**
   * Make drone face a target position
   */
  lookAt(targetX, targetZ) {
    const dx = targetX - this.x;
    const dz = targetZ - this.z;
    
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      this.yaw = Math.atan2(dx, dz);
    }
  }
  
  /**
   * Get velocity in LOCAL coordinates (relative to drone facing)
   */
  getLocalVelocity() {
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    
    return {
      x: this.vx * sinYaw + this.vz * cosYaw,
      y: this.vx * cosYaw - this.vz * sinYaw,
      z: this.vy,
    };
  }
  
  /**
   * Get forward direction vector in world coords
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
    
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    
    return {
      x: dx * cosYaw - dz * sinYaw,
      y: dy,
      z: dx * sinYaw + dz * cosYaw,
    };
  }
  
  /**
   * Reset physics state
   */
  reset() {
    this.x = 0;
    this.y = 5;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.yawRate = 0;
    this.targetYawRate = 0;
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionFrozen = false;
    this.velocityController.reset();
  }
  
  hadCollision() {
    return this.lastCollision;
  }
  
  getLastCollisionType() {
    return this.lastCollisionType;
  }
  
  getCollisionSystem() {
    return this.meshCollider;
  }
}
