/**
 * Reward Calculator for RL Environment
 * 
 * SIMPLIFIED for stable learning:
 * 1. TARGET REACHED: +10 (terminal)
 * 2. COLLISION: -10 (terminal)
 * 3. DISTANCE PROGRESS: +0.1 per meter closer, -0.1 per meter farther
 * 4. SMALL TIME PENALTY: -0.01 per step
 * 
 * That's it. No complex proximity penalties, altitude rewards, etc.
 * Keep the signal clean and let the agent learn.
 */

export class RewardCalculator {
  constructor() {
    this.config = {
      // Terminal rewards (keep moderate to avoid gradient explosion)
      targetReached: 10,
      collision: -10,
      
      // Distance shaping (small but consistent)
      distanceProgress: 0.1,  // Per meter closer
      
      // Time penalty (encourages efficiency)
      timePenalty: -0.01,
    };
  }
  
  /**
   * Calculate reward for current step
   * @param {Object} params - Reward calculation parameters
   * @returns {Object} - { reward, breakdown }
   */
  calculate(params) {
    const {
      prevDistance,
      currentDistance,
      targetRadius,
      hadCollision,
    } = params;
    
    let reward = 0;
    const breakdown = {};
    
    // 1. COLLISION (terminal) - immediate failure
    if (hadCollision) {
      reward = this.config.collision;
      breakdown.collision = this.config.collision;
      return { reward, breakdown };
    }
    
    // 2. TARGET REACHED (terminal) - success!
    if (currentDistance < targetRadius) {
      reward = this.config.targetReached;
      breakdown.targetReached = this.config.targetReached;
      return { reward, breakdown };
    }
    
    // 3. DISTANCE PROGRESS (main learning signal)
    const distanceDelta = prevDistance - currentDistance;
    const progressReward = distanceDelta * this.config.distanceProgress;
    reward += progressReward;
    breakdown.progress = progressReward;
    
    // 4. TIME PENALTY (small urgency)
    reward += this.config.timePenalty;
    breakdown.time = this.config.timePenalty;
    
    return { reward, breakdown };
  }
  
  /**
   * Reset state (call on episode reset)
   */
  reset() {
    // No state to reset
  }
  
  /**
   * Get reward configuration
   */
  getConfig() {
    return { ...this.config };
  }
}
