/**
 * Reinforcement Learning Agent using Policy Gradient (Actor-Critic style)
 * 
 * This implements a simple neural network policy that learns to navigate
 * through the forest environment. Similar to how TrackMania AI is trained.
 * 
 * Architecture:
 * - Policy Network (Actor): Outputs action probabilities/values
 * - Value Network (Critic): Estimates state value for advantage calculation
 * 
 * Training Algorithm: Proximal Policy Optimization (PPO) simplified
 */

import { RL_CONFIG } from '../config.js';
import { PolicyNetwork, ValueNetwork } from './networks/index.js';
import { TrainingManager } from './training/index.js';
import { ExplorationManager } from './exploration/index.js';
import { ModelIO } from './io/index.js';

export class RLAgent {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    
    // Networks
    this.policyNetwork = new PolicyNetwork(observationSize, actionSize);
    this.valueNetwork = new ValueNetwork(observationSize);
    
    // Training manager
    this.trainingManager = new TrainingManager(this.policyNetwork, this.valueNetwork);
    
    // Exploration manager
    this.explorationManager = new ExplorationManager();
    
    // Episode counter
    this.episodeCount = 0;
    
    console.log('RL Agent built');
    console.log(`Observation size: ${this.observationSize}, Action size: ${this.actionSize}`);
  }
  
  /**
   * Select action given observation
   * @param {Array} observation
   * @param {boolean} training - Whether to add exploration noise
   */
  selectAction(observation, training = false) {
    const action = this.policyNetwork.predict(observation);
    
    if (training) {
      return this.explorationManager.addNoise(action, true);
    }
    
    return action;
  }
  
  /**
   * Get value estimate for observation
   */
  getValue(observation) {
    return this.valueNetwork.predict(observation);
  }
  
  /**
   * Store experience in buffer
   */
  storeExperience(observation, action, reward, nextObservation, done) {
    this.trainingManager.storeExperience(observation, action, reward, nextObservation, done);
  }
  
  /**
   * Train on collected experiences
   */
  async train() {
    const result = await this.trainingManager.train();
    
    if (result) {
      this.explorationManager.decay();
    }
    
    return result;
  }
  
  /**
   * Clear experience buffer
   */
  clearBuffer() {
    this.trainingManager.clearBuffer();
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    const trainingStats = this.trainingManager.getStats();
    
    return {
      ...trainingStats,
      explorationRate: this.explorationManager.getRate(),
    };
  }
  
  /**
   * Check if agent is ready for inference
   */
  isReady() {
    return this.policyNetwork !== null && !this.trainingManager.isTraining;
  }
  
  /**
   * Check if currently training
   */
  get isTraining() {
    return this.trainingManager.isTraining;
  }
  
  /**
   * Get training step count
   */
  get trainingStep() {
    return this.trainingManager.trainingStep;
  }
  
  /**
   * Get exploration rate
   */
  get explorationRate() {
    return this.explorationManager.getRate();
  }
  
  /**
   * Set exploration rate
   */
  set explorationRate(rate) {
    this.explorationManager.setRate(rate);
  }
  
  /**
   * Get experience buffer size
   */
  get bufferSize() {
    return this.trainingManager.experienceBuffer.size;
  }
  
  /**
   * Get training history
   */
  get trainingHistory() {
    return this.trainingManager.getHistory();
  }
  
  /**
   * Export model to file
   */
  async exportToFile() {
    return ModelIO.exportToFile(
      this.policyNetwork,
      this.valueNetwork,
      this.trainingManager.getHistory(),
      this.trainingManager.trainingStep,
      this.explorationManager.getRate(),
      this.observationSize,
      this.actionSize
    );
  }
  
  /**
   * Import model from file
   */
  async importFromFile(file) {
    const result = await ModelIO.importFromFile(
      file,
      this.policyNetwork,
      this.valueNetwork
    );
    
    if (result) {
      this.trainingManager.setHistory(result.trainingHistory);
      this.trainingManager.setTrainingStep(result.trainingStep);
      this.explorationManager.setRate(result.explorationRate);
      return true;
    }
    
    return false;
  }
  
  /**
   * Dispose of networks
   */
  dispose() {
    if (this.policyNetwork) {
      this.policyNetwork.dispose();
      this.policyNetwork = null;
    }
    if (this.valueNetwork) {
      this.valueNetwork.dispose();
      this.valueNetwork = null;
    }
  }
}
