/**
 * Reward Calculator for RL Environment
 * 
 * Clean reward signals for pure reinforcement learning:
 * 
 * 1. COLLISION - Terminal penalty (must avoid)
 * 2. TARGET REACHED - Terminal reward (goal)
 * 3. DISTANCE PROGRESS - Shaping reward (guides learning)
 * 4. TIME PENALTY - Small urgency signal
 * 
 * Keep rewards simple and well-scaled for stable learning.
 */

import { DRONE, RL_CONFIG } from '../../config.js';

export class RewardCalculator {
  constructor() {
    this.config = {
      // Terminal rewards
      targetReached: 100,
      collision: -100,
      
      // Shaping rewards
      distanceProgress: 1.0,    // Reward per meter closer
      distanceRegress: -1.5,    // Penalty per meter farther (slightly stronger)
      
      // Time penalty
      timePenalty: -0.01,       // Small urgency
      
      // Obstacle proximity (soft penalty before collision)
      proximityPenalty: -0.5,
      proximityThreshold: 3.0,  // Start penalizing at 3m
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
    } = params;
    
    let reward = 0;
    const breakdown = {};
    
    // 1. COLLISION (terminal)
    if (hadCollision) {
      reward += this.config.collision;
      breakdown.collision = this.config.collision;
      return { reward, breakdown };
    }
    
    // 2. TARGET REACHED (terminal)
    if (currentDistance < targetRadius) {
      reward += this.config.targetReached;
      breakdown.targetReached = this.config.targetReached;
      return { reward, breakdown };
    }
    
    // 3. DISTANCE PROGRESS (shaping)
    const distanceDelta = prevDistance - currentDistance;
    
    if (distanceDelta > 0) {
      const progressReward = distanceDelta * this.config.distanceProgress;
      reward += progressReward;
      breakdown.progress = progressReward;
    } else if (distanceDelta < 0) {
      const regressPenalty = distanceDelta * Math.abs(this.config.distanceRegress);
      reward += regressPenalty;
      breakdown.regress = regressPenalty;
    }
    
    // 4. PROXIMITY PENALTY (soft warning before collision)
    if (minLidarDist < this.config.proximityThreshold) {
      const proximityFactor = 1 - (minLidarDist / this.config.proximityThreshold);
      const proximityPenalty = this.config.proximityPenalty * proximityFactor;
      reward += proximityPenalty;
      breakdown.proximity = proximityPenalty;
    }
    
    // 5. TIME PENALTY
    reward += this.config.timePenalty;
    breakdown.time = this.config.timePenalty;
    
    return { reward, breakdown };
  }
  
  /**
   * Reset state (call on episode reset)
   */
  reset() {
    // No state to reset in simplified version
  }
  
  /**
   * Get reward configuration
   */
  getConfig() {
    return { ...this.config };
  }
}
