/**
 * DroneState - provides state access for RL/autopilot
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
    
    return {
      // World position
      x: p.x,
      y: p.y,
      z: p.z,
      // World velocity
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      // Speed
      speed: speed,
      normalizedSpeed: speed / DRONE.MAX_SPEED,
      // Orientation
      yaw: p.yaw,
    };
  }
  
  getPosition() {
    return {
      x: this.physics.x,
      y: this.physics.y,
      z: this.physics.z,
    };
  }
  
  getVelocity() {
    return {
      x: this.physics.vx,
      y: this.physics.vy,
      z: this.physics.vz,
    };
  }
  
  getSpeed() {
    const p = this.physics;
    return Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  }
  
  getYaw() {
    return this.physics.yaw;
  }
  
  getDistanceTraveled() {
    return this.physics.distanceTraveled;
  }
  
  getMaxSpeedReached() {
    return this.physics.maxSpeedReached;
  }
}
