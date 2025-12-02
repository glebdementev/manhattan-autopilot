/**
 * Car - vehicle state and kinematic model
 * Uses bicycle model for vehicle dynamics
 */
import * as THREE from 'three';
import { VEHICLE, COLORS } from '../config.js';

export class Car {
  constructor() {
    // State
    this.x = 0;           // World X position
    this.z = 0;           // World Z position (forward is -Z in Three.js)
    this.heading = 0;     // Heading angle in radians (0 = +X direction)
    this.speed = 0;       // Current speed in m/s
    
    // Control inputs
    this.steering = 0;    // Steering angle in radians
    this.throttle = 0;    // Throttle/brake (-1 to 1)
    
    // Three.js mesh
    this.mesh = this.createMesh();
    
    // Stats
    this.distanceTraveled = 0;
    this.maxSpeedReached = 0;
  }

  /**
   * Create the car mesh
   */
  createMesh() {
    const group = new THREE.Group();
    group.name = 'car';
    
    // Main body
    const bodyGeometry = new THREE.BoxGeometry(
      VEHICLE.WIDTH,
      VEHICLE.HEIGHT * 0.6,
      VEHICLE.LENGTH
    );
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.CAR_CLASSIC,
      metalness: 0.6,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    body.position.y = VEHICLE.HEIGHT * 0.3;
    body.castShadow = true;
    body.name = 'body';
    group.add(body);
    
    // Cabin
    const cabinGeometry = new THREE.BoxGeometry(
      VEHICLE.WIDTH * 0.85,
      VEHICLE.HEIGHT * 0.45,
      VEHICLE.LENGTH * 0.5
    );
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.CAR_WINDOWS,
      metalness: 0.8,
      roughness: 0.2,
    });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.y = VEHICLE.HEIGHT * 0.75;
    cabin.position.z = -VEHICLE.LENGTH * 0.1;
    cabin.castShadow = true;
    group.add(cabin);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.8,
    });
    
    const wheelPositions = [
      { x: VEHICLE.WIDTH / 2 + 0.1, z: VEHICLE.LENGTH * 0.35 },
      { x: -VEHICLE.WIDTH / 2 - 0.1, z: VEHICLE.LENGTH * 0.35 },
      { x: VEHICLE.WIDTH / 2 + 0.1, z: -VEHICLE.LENGTH * 0.35 },
      { x: -VEHICLE.WIDTH / 2 - 0.1, z: -VEHICLE.LENGTH * 0.35 },
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.35, pos.z);
      wheel.castShadow = true;
      group.add(wheel);
    });
    
    // Headlights
    const lightGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.05);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5,
    });
    
    [-0.6, 0.6].forEach(x => {
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(x, VEHICLE.HEIGHT * 0.35, VEHICLE.LENGTH / 2);
      group.add(light);
    });
    
    return group;
  }

  /**
   * Update vehicle physics using bicycle model
   */
  update(dt) {
    // Clamp steering
    const steer = Math.max(-VEHICLE.MAX_STEER_ANGLE, 
                           Math.min(VEHICLE.MAX_STEER_ANGLE, this.steering));
    
    // Calculate acceleration
    let acceleration = 0;
    if (this.throttle > 0) {
      acceleration = this.throttle * VEHICLE.MAX_ACCELERATION;
    } else {
      acceleration = this.throttle * VEHICLE.MAX_BRAKE;
    }
    
    // Apply drag
    const drag = VEHICLE.DRAG_COEFFICIENT * this.speed * this.speed * Math.sign(this.speed);
    acceleration -= drag;
    
    // Update speed
    this.speed += acceleration * dt;
    this.speed = Math.max(0, Math.min(VEHICLE.MAX_SPEED, this.speed));
    
    // Track max speed
    if (this.speed > this.maxSpeedReached) {
      this.maxSpeedReached = this.speed;
    }
    
    // Bicycle model kinematics
    // Only turn when moving
    if (Math.abs(this.speed) > 0.01) {
      // Angular velocity from steering
      const angularVelocity = (this.speed / VEHICLE.WHEELBASE) * Math.tan(steer);
      this.heading += angularVelocity * dt;
      
      // Normalize heading to [-PI, PI]
      while (this.heading > Math.PI) this.heading -= 2 * Math.PI;
      while (this.heading < -Math.PI) this.heading += 2 * Math.PI;
    }
    
    // Update position
    const dx = this.speed * Math.cos(this.heading) * dt;
    const dz = this.speed * Math.sin(this.heading) * dt;
    
    this.x += dx;
    this.z += dz;
    
    // Track distance
    this.distanceTraveled += Math.sqrt(dx * dx + dz * dz);
    
    // Update mesh position and rotation
    this.updateMesh();
  }

  /**
   * Update Three.js mesh to match state
   */
  updateMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    // Three.js Y rotation is heading (rotation around up axis)
    // Heading 0 = +X, need to rotate so car faces direction of travel
    this.mesh.rotation.y = -this.heading + Math.PI / 2;
  }

  /**
   * Set car position and heading
   */
  setPosition(x, z, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.updateMesh();
  }

  /**
   * Set control inputs
   */
  setControls(steering, throttle) {
    this.steering = steering;
    this.throttle = Math.max(-1, Math.min(1, throttle));
  }

  /**
   * Get car's forward direction vector
   */
  getForwardVector() {
    return {
      x: Math.cos(this.heading),
      z: Math.sin(this.heading),
    };
  }

  /**
   * Get car's right direction vector
   */
  getRightVector() {
    return {
      x: Math.cos(this.heading - Math.PI / 2),
      z: Math.sin(this.heading - Math.PI / 2),
    };
  }

  /**
   * Transform world coordinates to car-local coordinates
   */
  worldToLocal(worldX, worldZ) {
    const dx = worldX - this.x;
    const dz = worldZ - this.z;
    
    const cos = Math.cos(-this.heading);
    const sin = Math.sin(-this.heading);
    
    return {
      x: dx * cos - dz * sin,
      z: dx * sin + dz * cos,
    };
  }

  /**
   * Transform car-local coordinates to world coordinates
   */
  localToWorld(localX, localZ) {
    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);
    
    return {
      x: this.x + localX * cos - localZ * sin,
      z: this.z + localX * sin + localZ * cos,
    };
  }

  /**
   * Get current state vector for neural network
   */
  getState() {
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed: this.speed,
      normalizedSpeed: this.speed / VEHICLE.MAX_SPEED,
      steering: this.steering,
      throttle: this.throttle,
    };
  }

  /**
   * Reset vehicle state
   */
  reset() {
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.steering = 0;
    this.throttle = 0;
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
   * Set car body color based on driver mode
   */
  setMode(mode) {
    let color;
    switch (mode) {
      case 'autopilot':
        color = COLORS.CAR_AUTOPILOT;
        break;
      case 'manual':
        color = COLORS.CAR_MANUAL;
        break;
      case 'classic':
      default:
        color = COLORS.CAR_CLASSIC;
        break;
    }
    
    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(color);
      this.bodyMaterial.emissive.setHex(color);
      this.bodyMaterial.emissiveIntensity = 0.1;
    }
  }
}

