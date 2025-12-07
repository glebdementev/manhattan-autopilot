/**
 * DronePhysics - handles drone movement, collision detection, and physics simulation
 */
import { DRONE } from '../config.js';
import { CollisionSystem } from '../collision/index.js';

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
    
    // Control inputs in LOCAL coordinates (-1 to 1)
    this.thrustX = 0;  // Forward/Back: negative=back, positive=forward
    this.thrustY = 0;  // Strafe: negative=left, positive=right
    this.thrustZ = 0;  // Vertical: negative=down, positive=up
    
    // Stats
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    
    // Collision system
    this.collisionSystem = new CollisionSystem();
    this.collisionSystem.setDroneSize(DRONE.SIZE, DRONE.SIZE * 0.35, DRONE.SIZE);
    
    // Collision state
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionFrozen = false;
    
    // Collision callback
    this.onCollision = null;
    
    // Legacy collision checker reference
    this.collisionChecker = null;
    
    // Performance logging
    this.perfLog = { currentCheck: 0, swept: 0, mesh: 0 };
    this.perfLogCounter = 0;
    this.perfLogInterval = 60;
  }
  
  /**
   * Set collision checker (forest generator reference)
   */
  setCollisionChecker(checker) {
    this.collisionChecker = checker;
    
    if (checker) {
      this.collisionSystem.setTerrainHeightFunction((x, z) => {
        return checker.getTerrainHeight(x, z);
      });
      
      this.collisionSystem.clearObstacles();
      const obstacles = checker.getObstacles();
      this.collisionSystem.addObstacles(obstacles);
      
      const halfSize = 150 / 2 - 5;
      this.collisionSystem.setWorldBounds(
        -halfSize, halfSize,
        -100, 1000,
        -halfSize, halfSize
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
   * Set collision callback
   */
  setOnCollision(callback) {
    this.onCollision = callback;
  }
  
  /**
   * Update drone physics with swept collision detection
   * @returns {Object} - { moved: boolean, dx, dy, dz } for mesh update
   */
  update(dt) {
    let t0, t1;
    
    if (this.collisionFrozen) {
      this.lastCollision = true;
      return { moved: false };
    }
    
    this.lastCollision = false;
    this.lastCollisionType = null;
    
    // Check if already in collision
    t0 = performance.now();
    const currentCollision = this.collisionSystem.checkCollision(this.x, this.y, this.z);
    t1 = performance.now();
    this.perfLog.currentCheck += t1 - t0;
    
    if (currentCollision.collided) {
      this.lastCollision = true;
      this.lastCollisionType = currentCollision.type;
      this.collisionFrozen = true;
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      
      if (this.onCollision) {
        this.onCollision(currentCollision.type);
      }
      return { moved: false };
    }
    
    // Convert LOCAL thrust to WORLD acceleration
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    
    const worldAccelX = (this.thrustX * sinYaw + this.thrustY * cosYaw) * DRONE.MAX_ACCELERATION;
    const worldAccelZ = (this.thrustX * cosYaw - this.thrustY * sinYaw) * DRONE.MAX_ACCELERATION;
    const worldAccelY = this.thrustZ * DRONE.MAX_ACCELERATION;
    
    // Apply acceleration
    this.vx += worldAccelX * dt;
    this.vy += worldAccelY * dt;
    this.vz += worldAccelZ * dt;
    
    // Apply drag
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
    
    if (currentSpeed > this.maxSpeedReached) {
      this.maxSpeedReached = currentSpeed;
    }
    
    // Calculate proposed movement
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const dz = this.vz * dt;
    const moveDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Swept collision detection
    if (moveDistance > 0.0001) {
      t0 = performance.now();
      const sweptResult = this.collisionSystem.checkSweptCollision(
        this.x, this.y, this.z,
        this.x + dx, this.y + dy, this.z + dz
      );
      t1 = performance.now();
      this.perfLog.swept += t1 - t0;
      
      if (sweptResult.collided) {
        this.lastCollision = true;
        this.lastCollisionType = sweptResult.type;
        this.collisionFrozen = true;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        
        if (this.onCollision) {
          this.onCollision(sweptResult.type);
        }
        return { moved: false };
      }
    }
    
    // Update position
    this.x += dx;
    this.y += dy;
    this.z += dz;
    this.distanceTraveled += moveDistance;
    
    // Log performance
    this.perfLogCounter++;
    if (this.perfLogCounter % this.perfLogInterval === 0) {
      const n = this.perfLogInterval;
      console.log(`[PERF DronePhysics] Avg over ${n}:`,
        `currentCheck=${(this.perfLog.currentCheck / n).toFixed(2)}ms`,
        `swept=${(this.perfLog.swept / n).toFixed(2)}ms`
      );
      this.perfLog.currentCheck = 0;
      this.perfLog.swept = 0;
    }
    
    return { moved: true, dx, dy, dz };
  }
  
  /**
   * Check collision at a specific position
   */
  checkCollisionAtPosition(posX, posY, posZ) {
    const result = this.collisionSystem.checkCollision(posX, posY, posZ);
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
   * Set control inputs
   */
  setControls(thrustX, thrustY, thrustZ) {
    this.thrustX = Math.max(-1, Math.min(1, thrustX));
    this.thrustY = Math.max(-1, Math.min(1, thrustY));
    this.thrustZ = Math.max(-1, Math.min(1, thrustZ));
  }
  
  /**
   * Get velocity in LOCAL coordinates (relative to drone facing)
   */
  getLocalVelocity() {
    const cos = Math.cos(-this.yaw);
    const sin = Math.sin(-this.yaw);
    
    return {
      x: this.vx * sin + this.vz * cos,   // Forward/back
      y: this.vx * cos - this.vz * sin,   // Right/left
      z: this.vy,                          // Up/down
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
    
    const cos = Math.cos(-this.yaw);
    const sin = Math.sin(-this.yaw);
    
    return {
      x: dx * cos - dz * sin,
      y: dy,
      z: dx * sin + dz * cos,
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
    this.thrustX = 0;
    this.thrustY = 0;
    this.thrustZ = 0;
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionFrozen = false;
  }
  
  hadCollision() {
    return this.lastCollision;
  }
  
  getLastCollisionType() {
    return this.lastCollisionType;
  }
  
  getCollisionSystem() {
    return this.collisionSystem;
  }
}

