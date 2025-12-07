/**
 * Curriculum Manager for Progressive Training
 * 
 * Key principles:
 * - FIXED target size (2m radius) - always the same
 * - Keep SAME target until success (many retries allowed)
 * - Require MANY successes on DIFFERENT targets to advance
 * - Gradual distance increase
 */

export class CurriculumManager {
  constructor() {
    // Current difficulty level (0 = easiest)
    this.level = 0;
    
    // Curriculum stages - ONLY distance changes, target radius is ALWAYS 1.0 (2m diameter)
    this.stages = [
      { minDist: 3,  maxDist: 5,  name: 'trivial' },
      { minDist: 5,  maxDist: 8,  name: 'very_easy' },
      { minDist: 8,  maxDist: 12, name: 'easy' },
      { minDist: 12, maxDist: 18, name: 'medium' },
      { minDist: 18, maxDist: 25, name: 'hard' },
      { minDist: 25, maxDist: 40, name: 'very_hard' },
    ];
    
    // FIXED target radius (1.0 = 2m diameter sphere)
    this.fixedTargetRadius = 1.0;
    
    // Tracking for level progression
    // Need CONSECUTIVE successes to prove reliable learning
    this.consecutiveSuccesses = 0;
    this.successesNeededToAdvance = 50; // Need 50 CONSECUTIVE successes
    
    // Track current target (don't regenerate on failure)
    this.currentTargetPosition = null;
    this.attemptsOnCurrentTarget = 0;
    this.maxAttemptsPerTarget = 100; // Allow MANY retries on same target
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
   * Get target radius - ALWAYS FIXED at 1.0 (2m diameter)
   */
  getTargetRadius() {
    return this.fixedTargetRadius;
  }
  
  /**
   * Record episode result and update curriculum
   * @param {boolean} success - Whether episode was successful
   * @returns {Object} - { levelChanged, newLevel, stageName }
   */
  recordEpisodeResult(success) {
    const oldLevel = this.level;
    
    if (success) {
      // Success - increment consecutive counter
      this.consecutiveSuccesses++;
      this.attemptsOnCurrentTarget = 0;
      this.currentTargetPosition = null; // Generate new target on success
      
      // Advance level after enough CONSECUTIVE successes
      if (this.consecutiveSuccesses >= this.successesNeededToAdvance) {
        if (this.level < this.stages.length - 1) {
          this.level++;
          this.consecutiveSuccesses = 0; // Reset counter for new level
          console.log(`🎉 LEVEL UP! Now at level ${this.level}: ${this.getCurrentStage().name}`);
        }
      }
    } else {
      // Failure - reset consecutive counter!
      this.consecutiveSuccesses = 0;
      this.attemptsOnCurrentTarget++;
      
      // After MANY failures on same target, generate new one
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
      successesNeeded: this.successesNeededToAdvance,
      attemptsOnTarget: this.attemptsOnCurrentTarget,
      maxAttempts: this.maxAttemptsPerTarget,
    };
  }
}
