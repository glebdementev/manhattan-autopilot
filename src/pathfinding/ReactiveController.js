/**
 * ReactiveController - LIDAR-based reactive obstacle avoidance
 * 
 * Philosophy:
 * 1. If target is in direct line of sight, go straight to it
 * 2. Otherwise, avoid obstacles reactively using multi-layer LIDAR
 * 3. Go UP/DOWN to clear obstacles when needed
 */
import { DRONE, LIDAR, CONTROLLER } from '../config.js';

export class ReactiveController {
  constructor(drone, lidar) {
    this.drone = drone;
    this.lidar = lidar;
    
    // Target position
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.hasTarget = false;
    
    // Control parameters
    this.targetSpeed = CONTROLLER.TARGET_SPEED || 5.0;
    this.avoidanceDist = CONTROLLER.OBSTACLE_AVOIDANCE_DIST || 4.0;
    this.emergencyDist = 2.0;
    
    // Smoothing for steering (prevents jitter)
    this.steeringSmoothingFactor = 0.3;
    this.lastSteeringX = 0;
    this.lastSteeringZ = 0;
    this.lastSteeringY = 0;
    
    // Height control
    this.minGroundClearance = 1.5;
    this.maxCeilingClearance = 2.0;
  }
  
  /**
   * Set target position
   */
  setTarget(x, y, z) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.hasTarget = true;
  }
  
  /**
   * Clear target
   */
  clearTarget() {
    this.hasTarget = false;
  }
  
  /**
   * Check if has active target
   */
  hasActiveTarget() {
    return this.hasTarget;
  }
  
  /**
   * Get distance to target
   */
  getDistanceToTarget() {
    if (!this.hasTarget) return Infinity;
    
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Main update - returns velocity command based on LIDAR and target
   * @returns {Array} [vx, vy, vz] normalized velocity commands [-1, 1]
   */
  update() {
    if (!this.hasTarget) {
      return [0, 0, 0];
    }
    
    const state = this.drone.getState();
    
    // Calculate direction to target
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    const distToTarget = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distToTarget < 0.5) {
      return [0, 0, 0];
    }
    
    // Normalize direction to target
    const targetDirX = dx / distToTarget;
    const targetDirY = dy / distToTarget;
    const targetDirZ = dz / distToTarget;
    
    // Check if we have direct line of sight to target
    const hasLineOfSight = this.lidar.isPathToPointClear(
      this.targetX, this.targetY, this.targetZ, 1.0
    );
    
    let moveX, moveY, moveZ;
    let speedFactor = 1.0;
    
    if (hasLineOfSight) {
      // DIRECT PATH: Go straight to target
      moveX = targetDirX;
      moveY = targetDirY;
      moveZ = targetDirZ;
      
      // Slow down when approaching target
      if (distToTarget < 5.0) {
        speedFactor = Math.max(0.3, distToTarget / 5.0);
      }
    } else {
      // OBSTACLE AVOIDANCE: Use reactive navigation
      const result = this.computeAvoidanceMovement(state, targetDirX, targetDirY, targetDirZ);
      moveX = result.moveX;
      moveY = result.moveY;
      moveZ = result.moveZ;
      speedFactor = result.speedFactor;
    }
    
    // Apply smoothing
    moveX = this.lastSteeringX * (1 - this.steeringSmoothingFactor) + 
            moveX * this.steeringSmoothingFactor;
    moveY = this.lastSteeringY * (1 - this.steeringSmoothingFactor) + 
            moveY * this.steeringSmoothingFactor;
    moveZ = this.lastSteeringZ * (1 - this.steeringSmoothingFactor) + 
            moveZ * this.steeringSmoothingFactor;
    
    this.lastSteeringX = moveX;
    this.lastSteeringY = moveY;
    this.lastSteeringZ = moveZ;
    
    // Apply safety overrides (ground/ceiling)
    moveY = this.applySafetyOverrides(moveY);
    
    // Convert to velocity commands
    const maxSpeed = DRONE.MAX_SPEED;
    const speed = this.targetSpeed * speedFactor;
    
    const vx = (moveX * speed) / maxSpeed;
    const vy = (moveY * speed) / maxSpeed;
    const vz = (moveZ * speed) / maxSpeed;
    
    return [
      Math.max(-1, Math.min(1, vx)),
      Math.max(-1, Math.min(1, vy)),
      Math.max(-1, Math.min(1, vz)),
    ];
  }
  
  /**
   * Compute avoidance movement when obstacles are present
   */
  computeAvoidanceMovement(state, targetDirX, targetDirY, targetDirZ) {
    const distances = this.lidar.getDistances();
    const minDist = this.lidar.getMinDistance();
    const minDistUpper = this.lidar.getMinDistanceUpper();
    const minDistLower = this.lidar.getMinDistanceLower();
    const zenithDist = this.lidar.getZenithDistance();
    const nadirDist = this.lidar.getNadirDistance();
    
    // Compute horizontal avoidance
    const avoidance = this.computeHorizontalAvoidance(distances, state.yaw);
    
    // Blend horizontal movement with avoidance
    let moveX = targetDirX;
    let moveZ = targetDirZ;
    
    if (avoidance.strength > 0) {
      const avoidWeight = Math.min(1.0, avoidance.strength);
      const targetWeight = 1.0 - avoidWeight * 0.8;
      
      moveX = targetDirX * targetWeight + avoidance.x * avoidWeight;
      moveZ = targetDirZ * targetWeight + avoidance.z * avoidWeight;
      
      // Renormalize horizontal
      const horizLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (horizLen > 0.01) {
        moveX /= horizLen;
        moveZ /= horizLen;
      }
    }
    
    // Compute vertical movement based on obstacle distribution
    let moveY = targetDirY;
    
    // If obstacle ahead, decide to go up or down
    if (minDist < this.avoidanceDist) {
      const canGoUp = zenithDist > this.maxCeilingClearance && minDistUpper > minDistLower;
      const canGoDown = nadirDist > this.minGroundClearance && minDistLower > minDistUpper;
      
      const urgency = 1.0 - (minDist / this.avoidanceDist);
      
      if (canGoUp && (!canGoDown || minDistUpper >= minDistLower)) {
        // Go UP - upper layers are clearer
        moveY = Math.max(moveY, urgency * 0.8);
      } else if (canGoDown) {
        // Go DOWN - lower layers are clearer
        moveY = Math.min(moveY, -urgency * 0.5);
      }
    }
    
    // Speed control based on obstacle proximity
    let speedFactor = 1.0;
    if (minDist < this.emergencyDist) {
      speedFactor = 0.2;
    } else if (minDist < this.avoidanceDist) {
      speedFactor = 0.4 + 0.6 * (minDist - this.emergencyDist) / 
                    (this.avoidanceDist - this.emergencyDist);
    }
    
    return { moveX, moveY, moveZ, speedFactor };
  }
  
  /**
   * Compute horizontal avoidance vector from LIDAR readings
   */
  computeHorizontalAvoidance(distances, yaw) {
    const horizontalRays = this.lidar.getHorizontalRays();
    const verticalLayers = this.lidar.getVerticalLayers();
    const halfFov = LIDAR.FOV / 2;
    
    let avoidX = 0;
    let avoidZ = 0;
    let totalWeight = 0;
    
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    
    // Process all scan rays (all layers)
    for (let layer = 0; layer < verticalLayers; layer++) {
      for (let h = 0; h < horizontalRays; h++) {
        const rayIdx = layer * horizontalRays + h;
        const dist = distances[rayIdx];
        
        if (dist >= this.avoidanceDist) continue;
        
        // Calculate horizontal angle
        const t = horizontalRays > 1 ? h / (horizontalRays - 1) : 0.5;
        const horizAngle = -halfFov + t * LIDAR.FOV;
        
        // Local direction (horizontal component only)
        const localX = Math.sin(horizAngle);
        const localZ = -Math.cos(horizAngle);
        
        // Transform to world space
        const worldX = localX * cosYaw - localZ * sinYaw;
        const worldZ = localX * sinYaw + localZ * cosYaw;
        
        // Weight: closer obstacles have more influence
        const proximity = 1.0 - (dist / this.avoidanceDist);
        const weight = proximity * proximity;
        
        // Add repulsion
        avoidX -= worldX * weight;
        avoidZ -= worldZ * weight;
        totalWeight += weight;
      }
    }
    
    if (totalWeight < 0.01) {
      return { x: 0, z: 0, strength: 0 };
    }
    
    // Normalize
    avoidX /= totalWeight;
    avoidZ /= totalWeight;
    
    const len = Math.sqrt(avoidX * avoidX + avoidZ * avoidZ);
    if (len > 0.01) {
      avoidX /= len;
      avoidZ /= len;
    }
    
    return {
      x: avoidX,
      z: avoidZ,
      strength: Math.min(1.0, totalWeight),
    };
  }
  
  /**
   * Apply safety overrides for ground and ceiling proximity
   */
  applySafetyOverrides(moveY) {
    const nadirDist = this.lidar.getNadirDistance();
    const zenithDist = this.lidar.getZenithDistance();
    
    // Ground avoidance
    if (nadirDist < this.minGroundClearance) {
      const urgency = 1.0 - (nadirDist / this.minGroundClearance);
      moveY = Math.max(moveY, urgency);
    }
    
    // Ceiling/canopy avoidance
    if (zenithDist < this.maxCeilingClearance) {
      const urgency = 1.0 - (zenithDist / this.maxCeilingClearance);
      moveY = Math.min(moveY, -urgency);
    }
    
    return Math.max(-1, Math.min(1, moveY));
  }
  
  /**
   * Get current target
   */
  getTarget() {
    return {
      x: this.targetX,
      y: this.targetY,
      z: this.targetZ,
    };
  }
}
