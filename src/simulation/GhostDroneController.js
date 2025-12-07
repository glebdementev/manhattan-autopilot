/**
 * GhostDroneController - Manages ghost drone behavior and observation creation
 */
export class GhostDroneController {
  constructor(ghostDrone, rlAgent, rlEnvironment) {
    this.ghostDrone = ghostDrone;
    this.rlAgent = rlAgent;
    this.rlEnvironment = rlEnvironment;
  }

  /**
   * Update ghost drone with RL agent
   */
  update(dt, mainDrone) {
    if (!this.ghostDrone.isVisible()) return;
    
    const ghostState = this.ghostDrone.getState();
    const target = this.rlEnvironment.getTarget();
    
    // Calculate direction to target
    const dx = target.x - ghostState.x;
    const dy = target.y - ghostState.y;
    const dz = target.z - ghostState.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Create observation and get action
    const ghostObs = this.createObservation(ghostState, target, dist);
    const action = this.rlAgent.selectAction(ghostObs, false);
    
    // Apply action
    this.ghostDrone.setControls(action[0], action[1], action[2]);
    this.ghostDrone.update(dt);
    
    // Reset on collision
    if (this.ghostDrone.hadCollision()) {
      this.syncToMainDrone(mainDrone);
    }
  }

  /**
   * Create observation for ghost drone
   */
  createObservation(state, target, dist) {
    const obsSize = this.rlEnvironment.observationSize;
    const obs = new Array(obsSize).fill(0);
    
    // Target direction (normalized, in local coords)
    const yaw = state.yaw || 0;
    const cosYaw = Math.cos(-yaw);
    const sinYaw = Math.sin(-yaw);
    
    const worldDx = (target.x - state.x) / Math.max(dist, 0.1);
    const worldDy = (target.y - state.y) / Math.max(dist, 0.1);
    const worldDz = (target.z - state.z) / Math.max(dist, 0.1);
    
    // Transform to local coords
    const localX = worldDx * cosYaw - worldDz * sinYaw;
    const localZ = worldDx * sinYaw + worldDz * cosYaw;
    
    // Lidar data (first 14 values) - set to "clear" (1.0)
    for (let i = 0; i < 14; i++) {
      obs[i] = 1.0;
    }
    
    // Velocity (normalized)
    obs[14] = state.vx / 8;
    obs[15] = state.vy / 8;
    obs[16] = state.vz / 8;
    
    // Target direction
    obs[17] = localX;
    obs[18] = worldDy;
    obs[19] = localZ;
    
    // Distance (normalized)
    obs[20] = Math.min(dist / 100, 1);
    
    // Can see target
    obs[21] = 1;
    
    return obs;
  }

  /**
   * Sync ghost drone to main drone position
   */
  syncToMainDrone(mainDrone) {
    this.ghostDrone.syncFrom(mainDrone);
    this.ghostDrone.reset();
  }

  /**
   * Get distance to target
   */
  getDistanceToTarget() {
    const ghostState = this.ghostDrone.getState();
    const target = this.rlEnvironment.getTarget();
    return Math.sqrt(
      (target.x - ghostState.x) ** 2 +
      (target.y - ghostState.y) ** 2 +
      (target.z - ghostState.z) ** 2
    );
  }
}

