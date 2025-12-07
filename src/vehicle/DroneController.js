/**
 * Drone controller for navigation to target
 * Uses simple proportional control with obstacle avoidance
 */
import { CONTROLLER, DRONE, LIDAR } from '../config.js';

export class DroneController {
  constructor(drone, forestGenerator) {
    this.drone = drone;
    this.forest = forestGenerator;
    
    // Target position
    this.targetX = 0;
    this.targetY = 5;
    this.targetZ = 0;
    
    // Controller state
    this.isActive = false;
    this.lastThrust = { x: 0, y: 0, z: 0 };
    
    // Obstacle avoidance state
    this.avoidanceVector = { x: 0, y: 0, z: 0 };
  }

  /**
   * Set target position
   */
  setTarget(x, y, z) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
  }

  /**
   * Get target position
   */
  getTarget() {
    return {
      x: this.targetX,
      y: this.targetY,
      z: this.targetZ,
    };
  }

  /**
   * Compute control commands
   */
  computeControl(lidarDistances = null) {
    const state = this.drone.getState();
    
    // Vector to target
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    
    const distToTarget = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Normalize direction to target
    let dirX = 0, dirY = 0, dirZ = 0;
    if (distToTarget > 0.1) {
      dirX = dx / distToTarget;
      dirY = dy / distToTarget;
      dirZ = dz / distToTarget;
    }
    
    // Base thrust towards target (proportional to distance)
    const approachGain = 0.3;
    let thrustX = dirX * Math.min(distToTarget * approachGain, 1);
    let thrustY = dirY * Math.min(distToTarget * approachGain, 1);
    let thrustZ = dirZ * Math.min(distToTarget * approachGain, 1);
    
    // Obstacle avoidance using LiDAR
    if (lidarDistances && lidarDistances.length > 0) {
      const avoidance = this.computeObstacleAvoidance(lidarDistances);
      
      // Blend avoidance with target seeking
      const avoidanceStrength = avoidance.strength;
      thrustX = thrustX * (1 - avoidanceStrength) + avoidance.x * avoidanceStrength;
      thrustY = thrustY * (1 - avoidanceStrength) + avoidance.y * avoidanceStrength;
      thrustZ = thrustZ * (1 - avoidanceStrength) + avoidance.z * avoidanceStrength;
    }
    
    // Velocity damping (to prevent oscillation)
    const dampingGain = 0.3;
    thrustX -= state.vx * dampingGain / DRONE.MAX_SPEED;
    thrustY -= state.vy * dampingGain / DRONE.MAX_SPEED;
    thrustZ -= state.vz * dampingGain / DRONE.MAX_SPEED;
    
    // Maintain minimum altitude
    const groundY = this.forest ? this.forest.getTerrainHeight(state.x, state.z) : 0;
    const minAltitude = groundY + 2;
    if (state.y < minAltitude) {
      thrustY += (minAltitude - state.y) * 0.5;
    }
    
    // Clamp thrust
    thrustX = Math.max(-1, Math.min(1, thrustX));
    thrustY = Math.max(-1, Math.min(1, thrustY));
    thrustZ = Math.max(-1, Math.min(1, thrustZ));
    
    // Store for data recording
    this.lastThrust = { x: thrustX, y: thrustY, z: thrustZ };
    
    return { thrustX, thrustY, thrustZ };
  }

  /**
   * Compute obstacle avoidance vector from LiDAR readings
   */
  computeObstacleAvoidance(lidarDistances) {
    const numHorizontal = 32;
    const numVertical = 8;
    const horizontalFov = Math.PI * 1.5;
    const verticalFov = Math.PI / 3;
    
    let avoidX = 0;
    let avoidY = 0;
    let avoidZ = 0;
    let maxStrength = 0;
    
    const avoidDist = CONTROLLER.OBSTACLE_AVOIDANCE_DIST;
    const droneYaw = this.drone.yaw;
    
    let rayIndex = 0;
    
    for (let v = 0; v < numVertical; v++) {
      const verticalAngle = -verticalFov / 2 + (v / (numVertical - 1)) * verticalFov;
      
      for (let h = 0; h < numHorizontal; h++) {
        const horizontalAngle = -horizontalFov / 2 + (h / (numHorizontal - 1)) * horizontalFov;
        
        if (rayIndex >= lidarDistances.length) break;
        
        const dist = lidarDistances[rayIndex];
        rayIndex++;
        
        if (dist < avoidDist) {
          // Calculate repulsion strength (inverse of distance)
          const strength = 1 - (dist / avoidDist);
          maxStrength = Math.max(maxStrength, strength);
          
          // Calculate ray direction in world space
          const worldHAngle = droneYaw + horizontalAngle;
          const cosV = Math.cos(verticalAngle);
          const sinV = Math.sin(verticalAngle);
          
          const rayDirX = Math.sin(worldHAngle) * cosV;
          const rayDirY = sinV;
          const rayDirZ = Math.cos(worldHAngle) * cosV;
          
          // Add repulsion (opposite to ray direction)
          avoidX -= rayDirX * strength * strength;
          avoidY -= rayDirY * strength * strength;
          avoidZ -= rayDirZ * strength * strength;
        }
      }
    }
    
    // Normalize avoidance vector
    const avoidMag = Math.sqrt(avoidX * avoidX + avoidY * avoidY + avoidZ * avoidZ);
    if (avoidMag > 0.01) {
      avoidX /= avoidMag;
      avoidY /= avoidMag;
      avoidZ /= avoidMag;
    }
    
    return {
      x: avoidX,
      y: avoidY,
      z: avoidZ,
      strength: Math.min(maxStrength, 0.9), // Cap avoidance strength
    };
  }

  /**
   * Apply controls to drone
   */
  applyControl(lidarDistances = null) {
    const { thrustX, thrustY, thrustZ } = this.computeControl(lidarDistances);
    this.drone.setControls(thrustX, thrustY, thrustZ);
    return { thrustX, thrustY, thrustZ };
  }

  /**
   * Get current control state (for data recording)
   */
  getCurrentControl() {
    return this.lastThrust;
  }

  /**
   * Get distance to target
   */
  getDistanceToTarget() {
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Check if target is reached
   */
  isTargetReached() {
    return this.getDistanceToTarget() < CONTROLLER.WAYPOINT_REACH_DIST;
  }

  /**
   * Get direction to target in drone-local coordinates
   */
  getTargetDirection() {
    const state = this.drone.getState();
    const local = this.drone.worldToLocal(this.targetX, this.targetY, this.targetZ);
    
    const dist = Math.sqrt(local.x * local.x + local.y * local.y + local.z * local.z);
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    
    return {
      x: local.x / dist,
      y: local.y / dist,
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

