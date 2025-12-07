/**
 * EpisodeManager - Handles episode lifecycle (reset, end, splash screens)
 */
export class EpisodeManager {
  constructor(rlEnvironment, ui) {
    this.rlEnvironment = rlEnvironment;
    this.ui = ui;
    this.isRegenerating = false;
    this.currentObservation = null;
    
    // Callbacks
    this.onReset = null;
  }

  /**
   * Reset current episode
   */
  reset() {
    if (this.isRegenerating) return;
    
    this.currentObservation = this.rlEnvironment.reset();
    
    if (this.onReset) this.onReset();
    
    console.log('Episode reset');
    return this.currentObservation;
  }

  /**
   * Handle episode end
   */
  handleEnd(info, drone) {
    if (this.isRegenerating) return;
    this.isRegenerating = true;
    
    // Show appropriate splash
    if (info.success) {
      this.ui.showSuccessSplash();
    } else if (info.reason === 'collision') {
      const collisionType = drone.getLastCollisionType() || 'obstacle';
      this.ui.showCollisionSplash(collisionType);
    } else if (info.reason === 'timeout') {
      this.ui.showTimeoutSplash();
    }
    
    setTimeout(() => {
      this.currentObservation = this.rlEnvironment.reset();
      
      if (this.onReset) this.onReset();
      
      this.isRegenerating = false;
    }, 600);
  }

  /**
   * Check if currently regenerating
   */
  isInRegeneration() {
    return this.isRegenerating;
  }

  /**
   * Get current observation
   */
  getObservation() {
    return this.currentObservation;
  }

  /**
   * Set current observation
   */
  setObservation(obs) {
    this.currentObservation = obs;
  }
}

