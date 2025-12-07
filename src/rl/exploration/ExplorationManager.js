/**
 * Exploration Manager for RL Agent
 * Handles exploration rate decay and action noise
 */

import { RL_CONFIG } from '../../config.js';

export class ExplorationManager {
  constructor() {
    this.explorationRate = RL_CONFIG.INITIAL_EXPLORATION;
    this.explorationDecay = RL_CONFIG.EXPLORATION_DECAY;
    this.minExploration = RL_CONFIG.MIN_EXPLORATION;
    this.actionNoise = RL_CONFIG.ACTION_NOISE;
  }
  
  /**
   * Add exploration noise to action
   * Uses Gaussian noise (zero-mean) to avoid directional bias
   * @param {Array} action - Base action values
   * @param {boolean} shouldExplore - Whether to add exploration
   * @returns {Array} - Action with potential noise
   */
  addNoise(action, shouldExplore = true) {
    if (!shouldExplore) {
      return action;
    }
    
    // Always add Gaussian noise scaled by exploration rate
    // This is more stable than random on/off exploration
    const noiseScale = this.actionNoise * this.explorationRate;
    
    return action.map(a => {
      // Box-Muller transform for Gaussian noise
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const noise = gaussian * noiseScale;
      return Math.max(-1, Math.min(1, a + noise));
    });
  }
  
  /**
   * Decay exploration rate
   */
  decay() {
    this.explorationRate = Math.max(
      this.minExploration,
      this.explorationRate * this.explorationDecay
    );
  }
  
  /**
   * Get current exploration rate
   * @returns {number}
   */
  getRate() {
    return this.explorationRate;
  }
  
  /**
   * Set exploration rate directly
   * @param {number} rate
   */
  setRate(rate) {
    this.explorationRate = Math.max(this.minExploration, Math.min(1, rate));
  }
  
  /**
   * Reset exploration to initial value
   */
  reset() {
    this.explorationRate = RL_CONFIG.INITIAL_EXPLORATION;
  }
  
  /**
   * Set action noise level
   * @param {number} noise
   */
  setActionNoise(noise) {
    this.actionNoise = noise;
  }
  
  /**
   * Get action noise level
   * @returns {number}
   */
  getActionNoise() {
    return this.actionNoise;
  }
}

