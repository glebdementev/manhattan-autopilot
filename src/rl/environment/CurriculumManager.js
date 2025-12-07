/**
 * Curriculum Manager for Progressive Training
 * 
 * Starts with trivially easy tasks and gradually increases difficulty.
 * Key insight: Keep the SAME target until success, then make it slightly harder.
 */

export class CurriculumManager {
  constructor() {
    // Current difficulty level (0 = easiest)
    this.level = 0;
    
    // Curriculum stages
    this.stages = [
      { minDist: 3,  maxDist: 5,  targetRadius: 3.0, name: 'trivial' },
      { minDist: 5,  maxDist: 8,  targetRadius: 2.5, name: 'very_easy' },
      { minDist: 8,  maxDist: 12, targetRadius: 2.0, name: 'easy' },
      { minDist: 12, maxDist: 18, targetRadius: 1.8, name: 'medium' },
      { minDist: 18, maxDist: 25, targetRadius: 1.5, name: 'hard' },
      { minDist: 25, maxDist: 40, targetRadius: 1.2, name: 'very_hard' },
    ];
    
    // Tracking for level progression
    this.consecutiveSuccesses = 0;
    this.successesNeededToAdvance = 3;
    
    // Track current target (don't regenerate on failure)
    this.currentTargetPosition = null;
    this.attemptsOnCurrentTarget = 0;
    this.maxAttemptsPerTarget = 5;
  }
  
  /**
   * Get current curriculum stage
   */
  getCurrentStage() {
    return this.stages[Math.min(this.level, this.stages.length - 1)];
  }
  
  /**
   * Get target distance range for current level
   */
  getTargetDistanceRange() {
    const stage = this.getCurrentStage();
    return { min: stage.minDist, max: stage.maxDist };
  }
  
  /**
   * Get target radius for current level
   */
  getTargetRadius() {
    return this.getCurrentStage().targetRadius;
  }
  
  /**
   * Record episode result and update curriculum
   * @param {boolean} success - Whether episode was successful
   * @returns {Object} - { levelChanged, newLevel, stageName }
   */
  recordEpisodeResult(success) {
    const oldLevel = this.level;
    
    if (success) {
      this.consecutiveSuccesses++;
      this.attemptsOnCurrentTarget = 0;
      this.currentTargetPosition = null; // Generate new target on success
      
      // Advance level after consecutive successes
      if (this.consecutiveSuccesses >= this.successesNeededToAdvance) {
        if (this.level < this.stages.length - 1) {
          this.level++;
          this.consecutiveSuccesses = 0;
        }
      }
    } else {
      this.consecutiveSuccesses = 0;
      this.attemptsOnCurrentTarget++;
      
      // After too many failures on same target, generate new one
      if (this.attemptsOnCurrentTarget >= this.maxAttemptsPerTarget) {
        this.currentTargetPosition = null;
        this.attemptsOnCurrentTarget = 0;
      }
    }
    
    return {
      levelChanged: this.level !== oldLevel,
      newLevel: this.level,
      stageName: this.getCurrentStage().name,
    };
  }
  
  /**
   * Check if we should keep the same target
   */
  shouldKeepSameTarget() {
    return this.currentTargetPosition !== null;
  }
  
  /**
   * Store current target position
   */
  setCurrentTarget(x, y, z) {
    this.currentTargetPosition = { x, y, z };
  }
  
  /**
   * Get stored target position
   */
  getCurrentTarget() {
    return this.currentTargetPosition;
  }
  
  /**
   * Reset curriculum to beginning
   */
  reset() {
    this.level = 0;
    this.consecutiveSuccesses = 0;
    this.currentTargetPosition = null;
    this.attemptsOnCurrentTarget = 0;
  }
  
  /**
   * Set level directly (for loading saved state)
   */
  setLevel(level) {
    this.level = Math.max(0, Math.min(level, this.stages.length - 1));
    this.consecutiveSuccesses = 0;
  }
  
  /**
   * Get current level
   */
  getLevel() {
    return this.level;
  }
  
  /**
   * Get stats for display
   */
  getStats() {
    return {
      level: this.level,
      stageName: this.getCurrentStage().name,
      consecutiveSuccesses: this.consecutiveSuccesses,
      attemptsOnTarget: this.attemptsOnCurrentTarget,
    };
  }
}

