/**
 * Advantage Calculator using GAE (Generalized Advantage Estimation)
 * Computes advantages and returns for policy gradient training
 */

import { RL_CONFIG } from '../../config.js';

export class AdvantageCalculator {
  constructor(gamma = RL_CONFIG.GAMMA, lambda = RL_CONFIG.GAE_LAMBDA) {
    this.gamma = gamma;
    this.lambda = lambda;
  }
  
  /**
   * Compute advantages using TD error
   * @param {Array} observations - Current states
   * @param {Array} rewards - Rewards received
   * @param {Array} nextObservations - Next states
   * @param {Array} dones - Episode termination flags (1 = done, 0 = not done)
   * @param {Function} valueFunction - Function to estimate state value
   * @returns {Object} - { advantages, returns }
   */
  compute(observations, rewards, nextObservations, dones, valueFunction) {
    // Get value estimates
    const values = observations.map(obs => valueFunction(obs));
    const nextValues = nextObservations.map(obs => valueFunction(obs));
    
    const advantages = [];
    const returns = [];
    
    for (let i = 0; i < rewards.length; i++) {
      // TD error: r + γV(s') - V(s)
      const tdError = rewards[i] + this.gamma * nextValues[i] * (1 - dones[i]) - values[i];
      
      // Simple advantage (could extend to full GAE)
      advantages.push(tdError);
      
      // Returns for value function training: r + γV(s')
      returns.push(rewards[i] + this.gamma * nextValues[i] * (1 - dones[i]));
    }
    
    // Normalize advantages
    const normalizedAdvantages = this.normalize(advantages);
    
    return { advantages: normalizedAdvantages, returns };
  }
  
  /**
   * Compute GAE (Generalized Advantage Estimation)
   * More sophisticated advantage estimation for better variance reduction
   * @param {Array} rewards - Rewards received
   * @param {Array} values - Value estimates for states
   * @param {Array} nextValues - Value estimates for next states
   * @param {Array} dones - Episode termination flags
   * @returns {Object} - { advantages, returns }
   */
  computeGAE(rewards, values, nextValues, dones) {
    const advantages = new Array(rewards.length);
    const returns = new Array(rewards.length);
    
    let lastGAE = 0;
    
    // Compute backwards for proper GAE calculation
    for (let i = rewards.length - 1; i >= 0; i--) {
      const nextValue = nextValues[i] * (1 - dones[i]);
      const delta = rewards[i] + this.gamma * nextValue - values[i];
      
      // GAE: δ + γλ * GAE(t+1)
      lastGAE = delta + this.gamma * this.lambda * (1 - dones[i]) * lastGAE;
      advantages[i] = lastGAE;
      
      // Returns = advantages + values
      returns[i] = advantages[i] + values[i];
    }
    
    return {
      advantages: this.normalize(advantages),
      returns,
    };
  }
  
  /**
   * Normalize advantages to have zero mean and unit variance
   * @param {Array} advantages - Raw advantages
   * @returns {Array} - Normalized advantages
   */
  normalize(advantages) {
    if (advantages.length === 0) return [];
    
    const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const variance = advantages.reduce((a, b) => a + (b - mean) ** 2, 0) / advantages.length;
    const std = Math.sqrt(variance) + 1e-8; // Add small epsilon for numerical stability
    
    return advantages.map(a => (a - mean) / std);
  }
}

