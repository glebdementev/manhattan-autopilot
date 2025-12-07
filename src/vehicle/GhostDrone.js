/**
 * Ghost Drone - A transparent visualization of the RL agent's actions
 * Shows what the RL would do alongside the user's manual control
 */
import * as THREE from 'three';
import { DRONE, COLORS } from '../config.js';

export class GhostDrone {
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
    this.thrustX = 0;
    this.thrustY = 0;
    this.thrustZ = 0;
    
    // Three.js mesh
    this.mesh = this.createMesh();
    
    // Collision state (ghost doesn't stop on collision, just tracks it)
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.collisionChecker = null;
  }
  
  /**
   * Create transparent ghost mesh
   */
  createMesh() {
    const group = new THREE.Group();
    group.name = 'ghost_drone';
    
    const size = DRONE.SIZE;
    
    // Main body - transparent green
    const bodyGeometry = new THREE.BoxGeometry(size, size * 0.35, size);
    this.bodyMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.DRONE_AUTOPILOT,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const body = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    body.name = 'ghost_body';
    group.add(body);
    
    // Wireframe outline for visibility
    const wireGeometry = new THREE.BoxGeometry(size * 1.02, size * 0.37, size * 1.02);
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.DRONE_AUTOPILOT,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
    group.add(wireframe);
    
    // Front indicator
    const frontGeom = new THREE.BoxGeometry(size * 0.15, size * 0.1, size * 0.05);
    const frontMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
    });
    const front = new THREE.Mesh(frontGeom, frontMat);
    front.position.set(0, 0, size * 0.55);
    group.add(front);
    
    return group;
  }
  
  /**
   * Set collision checker reference
   */
  setCollisionChecker(checker) {
    this.collisionChecker = checker;
  }
  
  /**
   * Update ghost drone physics (simplified - no collision stopping)
   */
  update(dt) {
    // Reset collision state
    this.lastCollision = false;
    this.lastCollisionType = null;
    
    // Convert LOCAL thrust to WORLD acceleration
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    
    const worldAccelX = (this.thrustX * sinYaw + this.thrustY * cosYaw) * DRONE.MAX_ACCELERATION;
    const worldAccelZ = (this.thrustX * cosYaw - this.thrustY * sinYaw) * DRONE.MAX_ACCELERATION;
    const worldAccelY = this.thrustZ * DRONE.MAX_ACCELERATION;
    
    // Apply acceleration to velocity
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
    
    // Calculate proposed movement
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const dz = this.vz * dt;
    
    // Update position (ghost passes through obstacles but tracks collision)
    this.x += dx;
    this.y += dy;
    this.z += dz;
    
    // Check collision for visual feedback (but don't stop)
    if (this.collisionChecker) {
      const groundY = this.collisionChecker.getTerrainHeight(this.x, this.z);
      if (this.y < groundY + 0.5) {
        this.lastCollision = true;
        this.lastCollisionType = 'terrain';
      }
    }
    
    // Update mesh
    this.updateMesh();
  }
  
  /**
   * Update mesh position and rotation
   */
  updateMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.yaw;
    
    // Tilt based on velocity
    const tiltAmount = 0.15;
    this.mesh.rotation.x = -this.vz * tiltAmount / DRONE.MAX_SPEED;
    this.mesh.rotation.z = this.vx * tiltAmount / DRONE.MAX_SPEED;
    
    // Visual feedback for collision state
    if (this.lastCollision) {
      this.bodyMaterial.color.setHex(0xff4444);
      this.bodyMaterial.opacity = 0.6;
    } else {
      this.bodyMaterial.color.setHex(COLORS.DRONE_AUTOPILOT);
      this.bodyMaterial.opacity = 0.4;
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
   * Set position
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
   * Set yaw
   */
  setYaw(yaw) {
    this.yaw = yaw;
    this.updateMesh();
  }
  
  /**
   * Sync state from another drone (for reset)
   */
  syncFrom(drone) {
    this.x = drone.x;
    this.y = drone.y;
    this.z = drone.z;
    this.vx = drone.vx;
    this.vy = drone.vy;
    this.vz = drone.vz;
    this.yaw = drone.yaw;
    this.updateMesh();
  }
  
  /**
   * Get state for camera following
   */
  getState() {
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      yaw: this.yaw,
      speed,
    };
  }
  
  /**
   * Get mesh
   */
  getMesh() {
    return this.mesh;
  }
  
  /**
   * Reset state
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
    this.lastCollision = false;
    this.lastCollisionType = null;
    this.updateMesh();
  }
  
  /**
   * Set visibility
   */
  setVisible(visible) {
    this.mesh.visible = visible;
  }
  
  /**
   * Check if ghost drone is visible
   */
  isVisible() {
    return this.mesh.visible;
  }
  
  /**
   * Check if ghost drone had a collision
   */
  hadCollision() {
    return this.lastCollision;
  }
}

