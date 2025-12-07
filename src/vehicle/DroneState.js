/**
 * DroneState - provides state access and coordinate transformations
 */
import { DRONE } from '../config.js';

export class DroneState {
  constructor(physics) {
    this.physics = physics;
  }
  
  /**
   * Get current state vector for RL/autopilot
   */
  getState() {
    const p = this.physics;
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
    const localVel = p.getLocalVelocity();
    
    return {
      // World position
      x: p.x,
      y: p.y,
      z: p.z,
      // World velocity
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      // Local velocity (relative to drone facing)
      localVx: localVel.x,
      localVy: localVel.y,
      localVz: localVel.z,
      // Speed
      speed: speed,
      normalizedSpeed: speed / DRONE.MAX_SPEED,
      // Orientation
      yaw: p.yaw,
      // Current controls
      thrustX: p.thrustX,
      thrustY: p.thrustY,
      thrustZ: p.thrustZ,
    };
  }
  
  /**
   * Get position
   */
  getPosition() {
    return {
      x: this.physics.x,
      y: this.physics.y,
      z: this.physics.z,
    };
  }
  
  /**
   * Get velocity
   */
  getVelocity() {
    return {
      x: this.physics.vx,
      y: this.physics.vy,
      z: this.physics.vz,
    };
  }
  
  /**
   * Get speed
   */
  getSpeed() {
    const p = this.physics;
    return Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  }
  
  /**
   * Get yaw
   */
  getYaw() {
    return this.physics.yaw;
  }
  
  /**
   * Get distance traveled
   */
  getDistanceTraveled() {
    return this.physics.distanceTraveled;
  }
  
  /**
   * Get max speed reached
   */
  getMaxSpeedReached() {
    return this.physics.maxSpeedReached;
  }
}

