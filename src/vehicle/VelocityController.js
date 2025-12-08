/**
 * VelocityController - PD controller for LOCAL velocity tracking
 * 
 * Works in drone-local coordinates:
 * - forward: positive = move in drone's facing direction
 * - vertical: positive = up
 * 
 * Converts local velocity setpoints to world-space thrust.
 */
import { DRONE } from '../config.js';

export class VelocityController {
  constructor() {
    // PD gains (tuned for responsive tracking)
    this.Kp = 2.0;  // Proportional gain
    this.Kd = 0.3;  // Derivative gain
    
    // Previous error for derivative term (in local space)
    this.prevError = { forward: 0, vertical: 0 };
    
    // Target velocity setpoint (LOCAL space)
    this.targetLocalVel = { forward: 0, vertical: 0 };
  }
  
  /**
   * Set target velocity in LOCAL coordinates
   * @param {number} forward - Forward velocity (m/s, positive = forward)
   * @param {number} vertical - Vertical velocity (m/s, positive = up)
   */
  setTargetLocalVelocity(forward, vertical) {
    // Clamp to max speed
    forward = Math.max(-DRONE.MAX_SPEED, Math.min(DRONE.MAX_SPEED, forward));
    vertical = Math.max(-DRONE.MAX_SPEED, Math.min(DRONE.MAX_SPEED, vertical));
    
    this.targetLocalVel.forward = forward;
    this.targetLocalVel.vertical = vertical;
  }
  
  /**
   * Set target velocity from normalized LOCAL action [-1, 1]
   * @param {number} forwardAction - Forward velocity [-1, 1]
   * @param {number} verticalAction - Vertical velocity [-1, 1]
   */
  setTargetFromLocalAction(forwardAction, verticalAction) {
    this.setTargetLocalVelocity(
      forwardAction * DRONE.MAX_SPEED,
      verticalAction * DRONE.MAX_SPEED
    );
  }
  
  /**
   * Get current local velocity target
   */
  getLocalVelocity() {
    return { ...this.targetLocalVel };
  }
  
  /**
   * Compute thrust commands from current world velocity
   * Transforms world velocity to local, computes PD, transforms back to world
   * 
   * @param {number} worldVx - Current world X velocity
   * @param {number} worldVy - Current world Y velocity
   * @param {number} worldVz - Current world Z velocity
   * @param {number} yaw - Current yaw angle
   * @returns {Object} - { thrustX, thrustY, thrustZ } in [-1, 1] (WORLD space)
   */
  computeLocalThrust(worldVx, worldVy, worldVz, yaw) {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    
    // Transform world velocity to local (forward is +Z in local, which is sin(yaw)*X + cos(yaw)*Z in world)
    // Local forward = world velocity projected onto drone's forward direction
    const currentForward = worldVx * sinYaw + worldVz * cosYaw;
    const currentVertical = worldVy;
    
    // Compute velocity error in local space
    const errorForward = this.targetLocalVel.forward - currentForward;
    const errorVertical = this.targetLocalVel.vertical - currentVertical;
    
    // PD control in local space
    const thrustForward = this.Kp * errorForward + this.Kd * (errorForward - this.prevError.forward);
    const thrustVertical = this.Kp * errorVertical + this.Kd * (errorVertical - this.prevError.vertical);
    
    // Store error for next iteration
    this.prevError.forward = errorForward;
    this.prevError.vertical = errorVertical;
    
    // Transform local thrust to world space
    // Forward thrust in local = thrust along drone's facing direction
    const worldThrustX = thrustForward * sinYaw;
    const worldThrustZ = thrustForward * cosYaw;
    const worldThrustY = thrustVertical;
    
    // Normalize to [-1, 1] range
    const maxThrust = DRONE.MAX_ACCELERATION;
    return {
      thrustX: Math.max(-1, Math.min(1, worldThrustX / maxThrust)),
      thrustY: Math.max(-1, Math.min(1, worldThrustY / maxThrust)),
      thrustZ: Math.max(-1, Math.min(1, worldThrustZ / maxThrust)),
    };
  }
  
  /**
   * Reset controller state
   */
  reset() {
    this.prevError = { forward: 0, vertical: 0 };
    this.targetLocalVel = { forward: 0, vertical: 0 };
  }
  
  /**
   * Get current target velocity (for compatibility)
   */
  getTargetVelocity() {
    return {
      forward: this.targetLocalVel.forward,
      vertical: this.targetLocalVel.vertical,
    };
  }
}

