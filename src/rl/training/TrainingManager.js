/**
 * Training Manager for RL Agent
 * Handles the training loop and policy/value network updates
 */

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../../config.js';
import { ExperienceBuffer } from './ExperienceBuffer.js';
import { AdvantageCalculator } from './AdvantageCalculator.js';

export class TrainingManager {
  constructor(policyNetwork, valueNetwork) {
    this.policyNetwork = policyNetwork;
    this.valueNetwork = valueNetwork;
    
    this.experienceBuffer = new ExperienceBuffer();
    this.advantageCalculator = new AdvantageCalculator();
    
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
    if (!this.experienceBuffer.isReadyForTraining()) {
      return null;
    }
    
    this.isTraining = true;
    
    try {
      // Sample batch from buffer
      const batchSize = Math.min(RL_CONFIG.BATCH_SIZE, this.experienceBuffer.size);
      const batch = this.experienceBuffer.sample(batchSize);
      
      // Extract batch data
      const { observations, actions, rewards, nextObservations, dones } = 
        ExperienceBuffer.extractBatchData(batch);
      
      // Calculate advantages and returns
      const { advantages, returns } = this.advantageCalculator.compute(
        observations,
        rewards,
        nextObservations,
        dones,
        (obs) => this.valueNetwork.predict(obs)
      );
      
      // Train value network
      const valueLoss = await this.trainValueNetwork(observations, returns);
      
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
   * Train policy network using policy gradient
   */
  async trainPolicyNetwork(observations, actions, advantages) {
    const obsTensor = tf.tensor2d(observations);
    const actionsTensor = tf.tensor2d(actions);
    const advantagesTensor = tf.tensor1d(advantages);
    
    // Get current policy output
    const currentActions = this.policyNetwork.predictBatch(obsTensor);
    
    // Compute target actions (nudge towards actions with positive advantage)
    const scaledAdvantages = advantagesTensor.expandDims(1);
    const actionDeltas = tf.mul(
      tf.sub(actionsTensor, currentActions),
      scaledAdvantages
    );
    
    // Target = current + learning_rate * delta
    const targetActions = tf.add(
      currentActions,
      tf.mul(actionDeltas, tf.scalar(RL_CONFIG.POLICY_LEARNING_RATE))
    );
    
    // Clip to valid action range [-1, 1]
    const clippedTargets = tf.clipByValue(targetActions, -1, 1);
    
    // Train
    const loss = await this.policyNetwork.fit(obsTensor, clippedTargets);
    
    // Cleanup tensors
    obsTensor.dispose();
    actionsTensor.dispose();
    advantagesTensor.dispose();
    currentActions.dispose();
    scaledAdvantages.dispose();
    actionDeltas.dispose();
    targetActions.dispose();
    clippedTargets.dispose();
    
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
    const recentPolicyLoss = this.history.policyLoss.slice(-100);
    const recentValueLoss = this.history.valueLoss.slice(-100);
    
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

