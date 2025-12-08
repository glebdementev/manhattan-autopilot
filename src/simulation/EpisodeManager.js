/**
 * EpisodeManager - Handles episode lifecycle (reset, end, splash screens)
 */
export class EpisodeManager {
  constructor(navEnvironment, ui) {
    this.navEnvironment = navEnvironment;
    this.ui = ui;
    this.isRegenerating = false;
    this.currentObservation = null;
    
    // Seed for randomization
    this.seed = Date.now();
    
    // Callbacks
    this.onReset = null;
  }

  /**
   * Reset current episode
   */
  reset() {
    if (this.isRegenerating) return;
    
    // Randomize seed for new episode
    this.seed = Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0);
    this.navEnvironment.setSeed(this.seed);
    
    this.currentObservation = this.navEnvironment.reset();
    
    if (this.onReset) this.onReset();
    
    console.log('Episode reset with seed:', this.seed);
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
      // Randomize seed for new episode
      this.seed = Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0);
      this.navEnvironment.setSeed(this.seed);
      
      this.currentObservation = this.navEnvironment.reset();
      
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
