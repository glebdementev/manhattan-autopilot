/**
 * Drone - flying box with 6-axis movement
 * Simple physics model: no pitch/roll, just position-based movement
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
  }

  /**
   * Create the drone mesh - SIMPLIFIED for performance
   */
  createMesh() {
    const group = new THREE.Group();
    group.name = 'drone';
    
    const size = DRONE.SIZE;
    
    // Main body (box)
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
    
    // Simplified propeller indicators (just 4 small boxes)
    const propGeometry = new THREE.BoxGeometry(size * 0.4, 0.05, size * 0.4);
    const propMaterial = new THREE.MeshBasicMaterial({
      color: 0x66dddd,
      transparent: true,
      opacity: 0.5,
    });
    
    const propPositions = [
      { x: size * 0.5, z: size * 0.5 },
      { x: -size * 0.5, z: size * 0.5 },
      { x: size * 0.5, z: -size * 0.5 },
      { x: -size * 0.5, z: -size * 0.5 },
    ];
    
    propPositions.forEach(pos => {
      const prop = new THREE.Mesh(propGeometry, propMaterial);
      prop.position.set(pos.x, size * 0.12, pos.z);
      group.add(prop);
    });
    
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
   * Update drone physics
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
    
    // Update position
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const dz = this.vz * dt;
    
    this.x += dx;
    this.y += dy;
    this.z += dz;
    
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

