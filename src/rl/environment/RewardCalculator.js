/**
 * Reward Calculator for RL Environment
 * 
 * Rewards:
 * 1. TARGET REACHED: +10 (terminal)
 * 2. COLLISION: -10 (terminal)
 * 3. DISTANCE PROGRESS: +0.1 per meter closer
 * 4. PROXIMITY PENALTY: Rapidly increasing when lidar < 1m (critical zone only)
 * 5. SMALL TIME PENALTY: -0.01 per step
 */

export class RewardCalculator {
  constructor() {
    this.config = {
      // Terminal rewards
      targetReached: 10,
      collision: -1,
      
      // Distance shaping - STRONG signal for approaching target
      // At 5 m/s towards target: reward = 5 * 5 = 25 per second
      distanceProgress: 5.0,
      
      // Proximity penalty - gentle
      proximityCriticalDist: 0.5,
      proximitySeverePenalty: -0.5,
      
      // Time penalty
      timePenalty: 0,
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
      minLidarDist,
      nadirDistance,
      zenithDistance,
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
    
    // Debug: log reward every 500 steps
    this.debugCounter = (this.debugCounter || 0) + 1;
    if (this.debugCounter <= 10 || this.debugCounter % 500 === 0) {
      console.log(`[REWARD] prev=${prevDistance.toFixed(2)} curr=${currentDistance.toFixed(2)} delta=${distanceDelta.toFixed(3)} reward=${progressReward.toFixed(3)}`);
    }
    
    // 4. PROXIMITY PENALTY - CRITICAL ZONE ONLY (< 1m)
    // Find minimum distance across all sensors
    let minDist = minLidarDist || Infinity;
    
    // Also check nadir (ground) and zenith (ceiling) if provided
    if (nadirDistance !== undefined && nadirDistance < minDist) {
      minDist = nadirDistance;
    }
    if (zenithDistance !== undefined && zenithDistance < minDist) {
      minDist = zenithDistance;
    }
    
    // Calculate proximity penalty (only if < 1m)
    const proximityPenalty = this.calculateProximityPenalty(minDist);
    if (proximityPenalty < 0) {
      reward += proximityPenalty;
      breakdown.proximity = proximityPenalty;
    }
    
    // 5. TIME PENALTY (small urgency)
    reward += this.config.timePenalty;
    breakdown.time = this.config.timePenalty;
    
    return { reward, breakdown };
  }
  
  /**
   * Calculate proximity penalty based on minimum lidar distance
   * Only penalizes when distance < 1m (critical zone)
   * Penalty rapidly increases as distance approaches 0
   */
  calculateProximityPenalty(minDist) {
    const { proximityCriticalDist, proximitySeverePenalty } = this.config;
    
    // Only penalize if in critical zone (< 1m)
    if (minDist >= proximityCriticalDist) {
      return 0; // Safe - no penalty
    }
    
    // Critical zone (< 1m) - severe penalty that increases rapidly
    // At 1m: -2, at 0.5m: -4, at 0.25m: -8, at 0.1m: -20, etc.
    const severity = proximityCriticalDist / Math.max(minDist, 0.1);
    return proximitySeverePenalty * severity;
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
