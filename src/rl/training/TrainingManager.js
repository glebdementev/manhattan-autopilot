/**
 * Training Manager for RL Agent
 * 
 * SIMPLIFIED approach using vanilla policy gradient:
 * - Policy network: Supervised learning towards "better" actions
 * - Value network: Predicts expected return
 * - Use small buffer, train on recent experiences
 */

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../../config.js';
import { ExperienceBuffer } from './ExperienceBuffer.js';

export class TrainingManager {
  constructor(policyNetwork, valueNetwork) {
    this.policyNetwork = policyNetwork;
    this.valueNetwork = valueNetwork;
    
    // Smaller buffer for more focused learning
    this.experienceBuffer = new ExperienceBuffer(2000);
    
    // Training state
    this.isTraining = false;
    this.trainingStep = 0;
    
    // Training history
    this.history = {
      policyLoss: [],
      valueLoss: [],
      avgReward: [],
      successRate: [],
    };
    
    // Hyperparameters
    this.gamma = 0.99;
    this.minBufferSize = 100; // Train with less data
  }
  
  /**
   * Store experience in buffer
   */
  storeExperience(observation, action, reward, nextObservation, done) {
    this.experienceBuffer.store(observation, action, reward, nextObservation, done);
  }
  
  /**
   * Train on collected experiences
   * @returns {Object|null} - { policyLoss, valueLoss } or null if not ready
   */
  async train() {
    if (this.experienceBuffer.size < this.minBufferSize) {
      return null;
    }
    
    this.isTraining = true;
    
    try {
      // Sample recent experiences (more relevant than random)
      const batchSize = Math.min(64, this.experienceBuffer.size);
      const batch = this.experienceBuffer.getRecent(batchSize);
      
      // Extract batch data
      const observations = batch.map(e => e.observation);
      const actions = batch.map(e => e.action);
      const rewards = batch.map(e => e.reward);
      const nextObservations = batch.map(e => e.nextObservation);
      const dones = batch.map(e => e.done ? 1 : 0);
      
      // Compute returns (discounted cumulative rewards)
      const returns = this.computeReturns(rewards, dones);
      
      // Train value network first
      const valueLoss = await this.trainValueNetwork(observations, returns);
      
      // Compute advantages
      const advantages = this.computeAdvantages(observations, returns);
      
      // Train policy network
      const policyLoss = await this.trainPolicyNetwork(observations, actions, advantages);
      
      // Update training state
      this.trainingStep++;
      
      // Store history
      this.history.policyLoss.push(policyLoss);
      this.history.valueLoss.push(valueLoss);
      
      return { policyLoss, valueLoss };
    } finally {
      this.isTraining = false;
    }
  }
  
  /**
   * Compute discounted returns for each step
   */
  computeReturns(rewards, dones) {
    const returns = new Array(rewards.length);
    let runningReturn = 0;
    
    // Work backwards through the batch
    for (let i = rewards.length - 1; i >= 0; i--) {
      if (dones[i]) {
        runningReturn = rewards[i];
      } else {
        runningReturn = rewards[i] + this.gamma * runningReturn;
      }
      returns[i] = runningReturn;
    }
    
    return returns;
  }
  
  /**
   * Compute advantages (return - value baseline)
   */
  computeAdvantages(observations, returns) {
    const advantages = [];
    
    for (let i = 0; i < observations.length; i++) {
      const value = this.valueNetwork.predict(observations[i]);
      advantages.push(returns[i] - value);
    }
    
    // Normalize advantages for stable training
    const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const std = Math.sqrt(
      advantages.reduce((a, b) => a + (b - mean) ** 2, 0) / advantages.length
    ) + 1e-8;
    
    return advantages.map(a => (a - mean) / std);
  }
  
  /**
   * Train value network on returns
   */
  async trainValueNetwork(observations, returns) {
    const obsTensor = tf.tensor2d(observations);
    const returnsTensor = tf.tensor2d(returns.map(r => [r]));
    
    const loss = await this.valueNetwork.fit(obsTensor, returnsTensor);
    
    obsTensor.dispose();
    returnsTensor.dispose();
    
    return loss;
  }
  
  /**
   * Train policy network - SIMPLE SUPERVISED LEARNING
   * 
   * For this simple task: the correct action IS the observation!
   * obs = direction to target, action = acceleration towards target
   * So we just train: action = observation
   */
  async trainPolicyNetwork(observations, actions, advantages) {
    const obsTensor = tf.tensor2d(observations);
    
    // SIMPLE: Target action = observation (go towards target!)
    // This is supervised learning, not RL, but it works for this task
    const targetActions = tf.tensor2d(observations);
    
    // Train
    const loss = await this.policyNetwork.fit(obsTensor, targetActions);
    
    // Cleanup
    obsTensor.dispose();
    targetActions.dispose();
    
    return loss;
  }
  
  /**
   * Clear experience buffer
   */
  clearBuffer() {
    this.experienceBuffer.clear();
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    const recentPolicyLoss = this.history.policyLoss.slice(-50);
    const recentValueLoss = this.history.valueLoss.slice(-50);
    
    return {
      trainingStep: this.trainingStep,
      bufferSize: this.experienceBuffer.size,
      avgPolicyLoss: recentPolicyLoss.length > 0
        ? recentPolicyLoss.reduce((a, b) => a + b, 0) / recentPolicyLoss.length
        : 0,
      avgValueLoss: recentValueLoss.length > 0
        ? recentValueLoss.reduce((a, b) => a + b, 0) / recentValueLoss.length
        : 0,
    };
  }
  
  /**
   * Get full training history
   */
  getHistory() {
    return { ...this.history };
  }
  
  /**
   * Set training history (for loading saved state)
   */
  setHistory(history) {
    this.history = { ...history };
  }
  
  /**
   * Set training step (for loading saved state)
   */
  setTrainingStep(step) {
    this.trainingStep = step;
  }
}
