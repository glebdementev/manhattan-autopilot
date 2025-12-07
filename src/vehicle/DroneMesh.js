/**
 * DroneMesh - handles drone visual representation and lighting
 * 
 * Features:
 * - Main body mesh with front indicator
 * - Proximity-based lighting that brightens near surfaces
 * - Tilt animation based on LOCAL velocity (not world velocity)
 */
import * as THREE from 'three';
import { DRONE, COLORS } from '../config.js';

// Light configuration
const LIGHT_CONFIG = {
  BASE_INTENSITY: 0.5,      // Default light intensity
  MAX_INTENSITY: 3.0,       // Maximum intensity when close to surface
  PROXIMITY_DISTANCE: 8,    // Distance at which light starts brightening
  LIGHT_RANGE: 15,          // Light range
  LIGHT_COLOR: COLORS.DRONE_LIGHT,
};

// Tilt configuration
const TILT_CONFIG = {
  MAX_TILT: 0.25,           // Maximum tilt angle in radians (~14 degrees)
  SMOOTHING: 0.15,          // Smoothing factor for tilt transitions
};

export class DroneMesh {
  constructor() {
    this.mesh = this.createMesh();
    this.droneLight = this.createLight();
    
    // Current smoothed tilt values
    this.currentPitchTilt = 0;
    this.currentRollTilt = 0;
    
    // Raycaster for proximity detection
    this.raycaster = new THREE.Raycaster();
    this.rayDirections = this.createRayDirections();
    
    // Scene reference for raycasting
    this.scene = null;
  }
  
  /**
   * Set scene reference for proximity detection
   */
  setScene(scene) {
    this.scene = scene;
  }
  
  /**
   * Create ray directions for proximity sensing
   */
  createRayDirections() {
    return [
      new THREE.Vector3(0, -1, 0),   // Down
      new THREE.Vector3(0, 1, 0),    // Up
      new THREE.Vector3(1, 0, 0),    // Right
      new THREE.Vector3(-1, 0, 0),   // Left
      new THREE.Vector3(0, 0, 1),    // Forward
      new THREE.Vector3(0, 0, -1),   // Back
      // Diagonals for better coverage
      new THREE.Vector3(0.7, -0.7, 0).normalize(),
      new THREE.Vector3(-0.7, -0.7, 0).normalize(),
      new THREE.Vector3(0, -0.7, 0.7).normalize(),
      new THREE.Vector3(0, -0.7, -0.7).normalize(),
    ];
  }
  
  /**
   * Create the drone mesh
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
    const light = new THREE.PointLight(
      LIGHT_CONFIG.LIGHT_COLOR,
      LIGHT_CONFIG.BASE_INTENSITY,
      LIGHT_CONFIG.LIGHT_RANGE
    );
    light.castShadow = false;
    this.mesh.add(light);
    return light;
  }
  
  /**
   * Update mesh position and rotation
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} z - World Z position
   * @param {number} yaw - Yaw rotation in radians
   * @param {Object} localVelocity - { x: forward/back, y: right/left, z: up/down }
   */
  update(x, y, z, yaw, localVelocity) {
    // Update position
    this.mesh.position.set(x, y, z);
    
    // Calculate target tilt based on LOCAL velocity
    // Pitch (rotation.x): tilts forward when moving forward, back when moving back
    // Roll (rotation.z): tilts right when strafing right, left when strafing left
    const targetPitch = -localVelocity.x * TILT_CONFIG.MAX_TILT / DRONE.MAX_SPEED;
    const targetRoll = localVelocity.y * TILT_CONFIG.MAX_TILT / DRONE.MAX_SPEED;
    
    // Smooth the tilt transitions
    this.currentPitchTilt += (targetPitch - this.currentPitchTilt) * TILT_CONFIG.SMOOTHING;
    this.currentRollTilt += (targetRoll - this.currentRollTilt) * TILT_CONFIG.SMOOTHING;
    
    // Apply rotations: yaw first, then local pitch and roll
    // We need to apply tilt in local space, so we use a specific order
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotation.y = yaw;
    
    // Apply local tilt by rotating around local axes
    // Pitch around local X axis (forward/back tilt)
    // Roll around local Z axis (left/right tilt)
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.currentPitchTilt
    );
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      this.currentRollTilt
    );
    
    // Get current yaw quaternion
    const yawQuat = new THREE.Quaternion().setFromEuler(this.mesh.rotation);
    
    // Combine: yaw * pitch * roll (apply tilt in local space after yaw)
    const finalQuat = yawQuat.multiply(pitchQuat).multiply(rollQuat);
    this.mesh.quaternion.copy(finalQuat);
    
    // Update proximity light
    this.updateProximityLight();
  }
  
  /**
   * Update light intensity based on proximity to surfaces
   */
  updateProximityLight() {
    if (!this.scene) {
      return;
    }
    
    let minDistance = LIGHT_CONFIG.PROXIMITY_DISTANCE;
    const origin = this.mesh.position.clone();
    
    // Get all meshes to raycast against (excluding drone itself)
    const meshesToTest = [];
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.name !== 'body' && !obj.parent?.name?.includes('drone')) {
        meshesToTest.push(obj);
      }
    });
    
    // Cast rays in all directions
    for (const direction of this.rayDirections) {
      this.raycaster.set(origin, direction);
      this.raycaster.far = LIGHT_CONFIG.PROXIMITY_DISTANCE;
      
      const intersects = this.raycaster.intersectObjects(meshesToTest, false);
      
      if (intersects.length > 0) {
        const distance = intersects[0].distance;
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }
    
    // Calculate light intensity based on proximity
    // Closer = brighter
    const proximityFactor = 1 - (minDistance / LIGHT_CONFIG.PROXIMITY_DISTANCE);
    const intensity = LIGHT_CONFIG.BASE_INTENSITY + 
      (LIGHT_CONFIG.MAX_INTENSITY - LIGHT_CONFIG.BASE_INTENSITY) * proximityFactor * proximityFactor;
    
    this.droneLight.intensity = intensity;
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
  
  /**
   * Get the Three.js mesh
   */
  getMesh() {
    return this.mesh;
  }
  
  /**
   * Reset tilt values
   */
  reset() {
    this.currentPitchTilt = 0;
    this.currentRollTilt = 0;
    this.droneLight.intensity = LIGHT_CONFIG.BASE_INTENSITY;
  }
}

