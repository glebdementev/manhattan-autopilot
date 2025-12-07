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
   * @param {Array} action - Base action values
   * @param {boolean} shouldExplore - Whether to add exploration
   * @returns {Array} - Action with potential noise
   */
  addNoise(action, shouldExplore = true) {
    if (!shouldExplore || Math.random() >= this.explorationRate) {
      return action;
    }
    
    return action.map(a => {
      const noise = (Math.random() - 0.5) * 2 * this.actionNoise;
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

