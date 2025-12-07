/**
 * Reinforcement Learning Agent - Hybrid Approach
 * 
 * BASE ACTION: Always go towards target (observation = direction to target)
 * RL CORRECTION: Network learns adjustments for obstacle avoidance
 * 
 * Final action = base_action + learned_correction
 * 
 * This guarantees the drone always moves towards the target,
 * while RL learns the nuances of obstacle avoidance.
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
    
    // Networks - correction network outputs small adjustments
    this.policyNetwork = new PolicyNetwork(observationSize, actionSize);
    this.valueNetwork = new ValueNetwork(observationSize);
    
    this.trainingManager = new TrainingManager(this.policyNetwork, this.valueNetwork);
    this.explorationManager = new ExplorationManager();
    
    this.episodeCount = 0;
    this.debugCounter = 0;
    
    // How much to trust the base action vs learned correction
    // 1.0 = pure base action, 0.0 = pure learned action
    this.baseActionWeight = 0.8;
    
    console.log('RL Agent initialized (hybrid: base + correction)');
    console.log(`Base action weight: ${this.baseActionWeight}`);
  }
  
  /**
   * Select action given observation
   * 
   * observation = [dirX, dirY, dirZ] = direction to target
   * 
   * Base action = observation (go towards target)
   * Correction = network output (learned adjustments)
   * Final = weighted combination
   */
  selectAction(observation, training = false) {
    // Base action: go directly towards target
    const baseAction = [...observation];
    
    // Get learned correction from network
    const correction = this.policyNetwork.predict(observation);
    
    // Combine: mostly base action, small correction
    const action = baseAction.map((base, i) => {
      const combined = this.baseActionWeight * base + (1 - this.baseActionWeight) * correction[i];
      return Math.max(-1, Math.min(1, combined));
    });
    
    // Debug logging
    this.debugCounter++;
    if (this.debugCounter <= 20 || this.debugCounter % 500 === 0) {
      console.log(`[ACTION] obs=[${observation.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`  base=[${baseAction.map(v => v.toFixed(2)).join(', ')}] corr=[${correction.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`  final=[${action.map(v => v.toFixed(2)).join(', ')}]`);
    }
    
    if (training) {
      const noisyAction = this.explorationManager.addNoise(action, true);
      return noisyAction;
    }
    
    return action;
  }
  
  getValue(observation) {
    return this.valueNetwork.predict(observation);
  }
  
  storeExperience(observation, action, reward, nextObservation, done) {
    this.trainingManager.storeExperience(observation, action, reward, nextObservation, done);
  }
  
  async train() {
    const result = await this.trainingManager.train();
    
    if (result) {
      this.explorationManager.decay();
    }
    
    return result;
  }
  
  clearBuffer() {
    this.trainingManager.clearBuffer();
  }
  
  getStats() {
    const trainingStats = this.trainingManager.getStats();
    
    return {
      ...trainingStats,
      explorationRate: this.explorationManager.getRate(),
      baseActionWeight: this.baseActionWeight,
    };
  }
  
  isReady() {
    return this.policyNetwork !== null && !this.trainingManager.isTraining;
  }
  
  get isTraining() {
    return this.trainingManager.isTraining;
  }
  
  get trainingStep() {
    return this.trainingManager.trainingStep;
  }
  
  get explorationRate() {
    return this.explorationManager.getRate();
  }
  
  set explorationRate(rate) {
    this.explorationManager.setRate(rate);
  }
  
  get bufferSize() {
    return this.trainingManager.experienceBuffer.size;
  }
  
  get trainingHistory() {
    return this.trainingManager.getHistory();
  }
  
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
