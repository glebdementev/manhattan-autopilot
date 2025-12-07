/**
 * VelocityController - PD controller for velocity tracking
 * 
 * Converts velocity setpoints to thrust commands.
 * Handles inertia compensation so RL agent doesn't need to learn physics.
 */
import { DRONE } from '../config.js';

export class VelocityController {
  constructor() {
    // PD gains (tuned for responsive tracking)
    this.Kp = 2.0;  // Proportional gain
    this.Kd = 0.3;  // Derivative gain
    
    // Previous error for derivative term
    this.prevError = { x: 0, y: 0, z: 0 };
    
    // Target velocity setpoint
    this.targetVel = { x: 0, y: 0, z: 0 };
  }
  
  /**
   * Set target velocity setpoint
   * @param {number} vx - Target X velocity (m/s)
   * @param {number} vy - Target Y velocity (m/s)
   * @param {number} vz - Target Z velocity (m/s)
   */
  setTargetVelocity(vx, vy, vz) {
    // Clamp to max speed
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > DRONE.MAX_SPEED) {
      const scale = DRONE.MAX_SPEED / speed;
      vx *= scale;
      vy *= scale;
      vz *= scale;
    }
    
    this.targetVel.x = vx;
    this.targetVel.y = vy;
    this.targetVel.z = vz;
  }
  
  /**
   * Set target velocity from normalized action [-1, 1]
   * Maps to [-MAX_SPEED, MAX_SPEED]
   */
  setTargetFromAction(actionX, actionY, actionZ) {
    this.setTargetVelocity(
      actionX * DRONE.MAX_SPEED,
      actionY * DRONE.MAX_SPEED,
      actionZ * DRONE.MAX_SPEED
    );
  }
  
  /**
   * Compute thrust commands from current velocity
   * @param {number} currentVx - Current X velocity
   * @param {number} currentVy - Current Y velocity
   * @param {number} currentVz - Current Z velocity
   * @returns {Object} - { thrustX, thrustY, thrustZ } in [-1, 1]
   */
  computeThrust(currentVx, currentVy, currentVz) {
    // Compute velocity error
    const error = {
      x: this.targetVel.x - currentVx,
      y: this.targetVel.y - currentVy,
      z: this.targetVel.z - currentVz,
    };
    
    // PD control: thrust = Kp * error + Kd * d(error)/dt
    // Since d(error)/dt ≈ (error - prevError) / dt, and we want normalized output,
    // we fold dt into the gains
    const thrust = {
      x: this.Kp * error.x + this.Kd * (error.x - this.prevError.x),
      y: this.Kp * error.y + this.Kd * (error.y - this.prevError.y),
      z: this.Kp * error.z + this.Kd * (error.z - this.prevError.z),
    };
    
    // Store error for next iteration
    this.prevError = { ...error };
    
    // Normalize to [-1, 1] range (divide by max acceleration to get normalized thrust)
    const maxThrust = DRONE.MAX_ACCELERATION;
    return {
      thrustX: Math.max(-1, Math.min(1, thrust.x / maxThrust)),
      thrustY: Math.max(-1, Math.min(1, thrust.y / maxThrust)),
      thrustZ: Math.max(-1, Math.min(1, thrust.z / maxThrust)),
    };
  }
  
  /**
   * Reset controller state
   */
  reset() {
    this.prevError = { x: 0, y: 0, z: 0 };
    this.targetVel = { x: 0, y: 0, z: 0 };
  }
  
  /**
   * Get current target velocity
   */
  getTargetVelocity() {
    return { ...this.targetVel };
  }
}

