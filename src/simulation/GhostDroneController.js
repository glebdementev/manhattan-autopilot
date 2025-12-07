/**
 * GhostDroneController - Manages ghost drone behavior
 * Uses ObservationBuilder as single source of truth for observations
 */
export class GhostDroneController {
  constructor(ghostDrone, rlAgent, rlEnvironment) {
    this.ghostDrone = ghostDrone;
    this.rlAgent = rlAgent;
    this.rlEnvironment = rlEnvironment;
    // Use the SAME observation builder as the environment
    this.observationBuilder = rlEnvironment.observationBuilder;
  }

  /**
   * Update ghost drone with RL agent
   */
  update(dt, mainDrone) {
    if (!this.ghostDrone.isVisible()) return;
    
    const ghostState = this.ghostDrone.getState();
    const target = this.rlEnvironment.getTarget();
    
    // Use ObservationBuilder - SINGLE SOURCE OF TRUTH
    const ghostObs = this.observationBuilder.buildFromPositions(
      ghostState.x, ghostState.y, ghostState.z,
      target.x, target.y, target.z
    );
    
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

