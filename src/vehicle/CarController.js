/**
 * Classical car controller using Pure Pursuit algorithm
 * Used for generating training data and as a baseline
 */
import { CONTROLLER, VEHICLE, CITY } from '../config.js';

export class CarController {
  constructor(car, routeManager) {
    this.car = car;
    this.routeManager = routeManager;
    
    // Controller state
    this.isActive = false;
    this.lastSteer = 0;
    this.lastThrottle = 0;
  }

  /**
   * Compute control commands using Pure Pursuit
   */
  computeControl() {
    if (!this.routeManager || this.routeManager.waypoints.length === 0) {
      return { steering: 0, throttle: 0 };
    }

    const carState = this.car.getState();
    
    // Get lookahead target
    const target = this.routeManager.getLookaheadTarget(
      carState.x, 
      carState.z, 
      carState.heading,
      carState.speed
    );
    
    if (!target) {
      return { steering: 0, throttle: 0 };
    }

    // Calculate steering using Pure Pursuit
    const steering = this.purePursuitSteering(target);
    
    // Calculate throttle based on situation
    const throttle = this.calculateThrottle(target, steering);

    // Store for data recording
    this.lastSteer = steering;
    this.lastThrottle = throttle;

    return { steering, throttle };
  }

  /**
   * Pure Pursuit steering calculation
   */
  purePursuitSteering(target) {
    const carState = this.car.getState();
    
    // Transform target to car-local coordinates
    const localTarget = this.car.worldToLocal(target.x, target.z);
    
    // Calculate lookahead distance
    const lookaheadDist = Math.sqrt(
      localTarget.x * localTarget.x + 
      localTarget.z * localTarget.z
    );
    
    if (lookaheadDist < 0.1) {
      return 0;
    }

    // Pure pursuit formula: steering angle = atan(2 * L * sin(alpha) / Ld)
    // Where L = wheelbase, Ld = lookahead distance, alpha = angle to target
    // In local coords, sin(alpha) ≈ localTarget.z / Ld (lateral offset)
    
    const curvature = (2 * localTarget.z) / (lookaheadDist * lookaheadDist);
    let steeringAngle = Math.atan(VEHICLE.WHEELBASE * curvature);
    
    // Clamp to maximum steering angle
    steeringAngle = Math.max(-VEHICLE.MAX_STEER_ANGLE, 
                             Math.min(VEHICLE.MAX_STEER_ANGLE, steeringAngle));
    
    return steeringAngle;
  }

  /**
   * Calculate throttle based on steering and road conditions
   */
  calculateThrottle(target, steering) {
    const carState = this.car.getState();
    
    // Base target speed
    let targetSpeed = CONTROLLER.TARGET_SPEED;
    
    // Reduce speed for turns
    const steeringMagnitude = Math.abs(steering) / VEHICLE.MAX_STEER_ANGLE;
    if (steeringMagnitude > 0.2) {
      targetSpeed = CONTROLLER.TURN_SPEED + 
        (CONTROLLER.TARGET_SPEED - CONTROLLER.TURN_SPEED) * (1 - steeringMagnitude);
    }
    
    // Check for upcoming intersection
    const distToIntersection = this.routeManager.getDistanceToNextIntersection(
      carState.x, carState.z
    );
    
    if (distToIntersection < 15 && target.isIntersection) {
      // Slow down for intersection
      targetSpeed = Math.min(targetSpeed, CONTROLLER.TURN_SPEED);
    }
    
    // Check if route is complete
    if (this.routeManager.isComplete()) {
      targetSpeed = 0;
    }
    
    // Simple P controller for speed
    const speedError = targetSpeed - carState.speed;
    const kP = 0.5;
    
    let throttle = kP * speedError;
    
    // Clamp throttle
    throttle = Math.max(-1, Math.min(1, throttle));
    
    return throttle;
  }

  /**
   * Apply controls to car
   */
  applyControl() {
    const { steering, throttle } = this.computeControl();
    this.car.setControls(steering, throttle);
    return { steering, throttle };
  }

  /**
   * Get current control state (for data recording)
   */
  getCurrentControl() {
    return {
      steering: this.lastSteer,
      throttle: this.lastThrottle,
    };
  }

  /**
   * Calculate heading error (difference between car heading and route direction)
   */
  getHeadingError() {
    const routeTangent = this.routeManager.getRouteTangent();
    const routeHeading = Math.atan2(routeTangent.z, routeTangent.x);
    
    let error = this.car.heading - routeHeading;
    
    // Normalize to [-PI, PI]
    while (error > Math.PI) error -= 2 * Math.PI;
    while (error < -Math.PI) error += 2 * Math.PI;
    
    return error;
  }

  /**
   * Get lateral offset from route centerline
   */
  getLateralOffset() {
    return this.routeManager.getLateralOffset(this.car.x, this.car.z);
  }

  /**
   * Get target direction in car-local coordinates
   */
  getTargetDirection() {
    const target = this.routeManager.getCurrentTarget(this.car.x, this.car.z);
    if (!target) return { x: 1, z: 0 };
    
    const local = this.car.worldToLocal(target.x, target.z);
    const dist = Math.sqrt(local.x * local.x + local.z * local.z);
    
    if (dist < 0.001) return { x: 1, z: 0 };
    
    return {
      x: local.x / dist,
      z: local.z / dist,
    };
  }

  /**
   * Set active state
   */
  setActive(active) {
    this.isActive = active;
  }

  /**
   * Check if controller is active
   */
  getIsActive() {
    return this.isActive;
  }
}

