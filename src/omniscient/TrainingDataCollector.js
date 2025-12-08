/**
 * TrainingDataCollector - Collects LIDAR observations along omniscient paths
 * 
 * At each step of the omniscient path, records:
 * - Target direction (relative to drone heading)
 * - Target distance
 * - Target visibility (line of sight)
 * - All LIDAR ray distances (normalized)
 * - Current velocity
 * - The "correct" action to take (direction toward next waypoint)
 */
import { LIDAR, DRONE } from '../config.js';

export class TrainingDataCollector {
  constructor(lidar) {
    this.lidar = lidar;
    
    // Training samples: { observation, action }
    this.samples = [];
    
    // Observation dimensions
    this.numLidarRays = lidar.getTotalRays();
  }
  
  /**
   * Clear collected samples
   */
  clear() {
    this.samples = [];
  }
  
  /**
   * Get number of collected samples
   */
  getNumSamples() {
    return this.samples.length;
  }
  
  /**
   * Collect a training sample at current position
   * 
   * @param {Object} droneState - Current drone state {x, y, z, vx, vy, vz, yaw}
   * @param {Object} target - Target position {x, y, z}
   * @param {Object} nextWaypoint - Next waypoint on omniscient path {x, y, z}
   * @param {boolean} canSeeTarget - Whether target is visible (line of sight)
   */
  collectSample(droneState, target, nextWaypoint, canSeeTarget) {
    // Build observation
    const observation = this.buildObservation(droneState, target, canSeeTarget);
    
    // Build action (direction toward next waypoint, normalized)
    const action = this.buildAction(droneState, nextWaypoint);
    
    this.samples.push({ observation, action });
  }
  
  /**
   * Build observation vector
   */
  buildObservation(droneState, target, canSeeTarget) {
    const { x, y, z, vx, vy, vz, yaw } = droneState;
    
    // Target direction in world space
    const dx = target.x - x;
    const dy = target.y - y;
    const dz = target.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Normalize target direction
    const targetDirX = dist > 0.001 ? dx / dist : 0;
    const targetDirY = dist > 0.001 ? dy / dist : 0;
    const targetDirZ = dist > 0.001 ? dz / dist : 0;
    
    // Convert target direction to drone-local frame
    const cosYaw = Math.cos(-yaw);
    const sinYaw = Math.sin(-yaw);
    const localTargetX = targetDirX * cosYaw - targetDirZ * sinYaw;
    const localTargetZ = targetDirX * sinYaw + targetDirZ * cosYaw;
    
    // Normalize distance (0 = at target, 1 = far away)
    const normalizedDist = Math.min(1, dist / 50);
    
    // Get LIDAR distances (already normalized)
    const lidarDistances = this.lidar.getNormalizedDistances();
    
    // Normalize velocity
    const maxSpeed = DRONE.MAX_SPEED;
    const normVx = vx / maxSpeed;
    const normVy = vy / maxSpeed;
    const normVz = vz / maxSpeed;
    
    // Build observation array
    // [localTargetX, localTargetY, localTargetZ, normalizedDist, canSeeTarget, vx, vy, vz, ...lidarDistances]
    const obs = new Float32Array(8 + this.numLidarRays);
    
    obs[0] = localTargetX;
    obs[1] = targetDirY; // Y is the same in local/world
    obs[2] = localTargetZ;
    obs[3] = normalizedDist;
    obs[4] = canSeeTarget ? 1 : 0;
    obs[5] = normVx;
    obs[6] = normVy;
    obs[7] = normVz;
    
    for (let i = 0; i < this.numLidarRays; i++) {
      obs[8 + i] = lidarDistances[i];
    }
    
    return obs;
  }
  
  /**
   * Build action vector (direction toward next waypoint)
   */
  buildAction(droneState, nextWaypoint) {
    const { x, y, z, yaw } = droneState;
    
    // Direction to next waypoint
    const dx = nextWaypoint.x - x;
    const dy = nextWaypoint.y - y;
    const dz = nextWaypoint.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) {
      return new Float32Array([0, 0, 0]);
    }
    
    // Normalize
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirZ = dz / dist;
    
    // Convert to drone-local frame
    const cosYaw = Math.cos(-yaw);
    const sinYaw = Math.sin(-yaw);
    const localX = dirX * cosYaw - dirZ * sinYaw;
    const localZ = dirX * sinYaw + dirZ * cosYaw;
    
    // Action is normalized velocity command in local frame
    return new Float32Array([localX, dirY, localZ]);
  }
  
  /**
   * Get all collected samples
   */
  getSamples() {
    return this.samples;
  }
  
  /**
   * Get observation dimension
   */
  getObservationDim() {
    return 8 + this.numLidarRays;
  }
  
  /**
   * Get action dimension
   */
  getActionDim() {
    return 3; // [vx, vy, vz] normalized
  }
  
  /**
   * Export samples as JSON-serializable object
   */
  exportSamples() {
    return {
      observationDim: this.getObservationDim(),
      actionDim: this.getActionDim(),
      numSamples: this.samples.length,
      samples: this.samples.map(s => ({
        observation: Array.from(s.observation),
        action: Array.from(s.action),
      })),
    };
  }
  
  /**
   * Import samples from exported data
   */
  importSamples(data) {
    this.samples = data.samples.map(s => ({
      observation: new Float32Array(s.observation),
      action: new Float32Array(s.action),
    }));
  }
}

