/**
 * Reinforcement Learning Agent - Residual Policy
 * 
 * Observation (12 values):
 * - [0-2] Target direction (X, Y, Z) - normalized
 * - [3-5] Current velocity (vx, vy, vz) - normalized
 * - [6-9] 4 closest obstacle distances
 * - [10] Nadir distance
 * - [11] Zenith distance
 * 
 * Action (3 values):
 * - Velocity setpoints [vx, vy, vz] in [-1, 1]
 * - Mapped to [-MAX_SPEED, MAX_SPEED] by the drone's velocity controller
 * 
 * The network outputs a CORRECTION to the base action (target direction).
 * Final action = base_action + correction
 */

import { PolicyNetwork, ValueNetwork } from './networks/index.js';
import { TrainingManager } from './training/index.js';
import { ExplorationManager } from './exploration/index.js';
import { ModelIO } from './io/index.js';

export class RLAgent {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    
    this.policyNetwork = new PolicyNetwork(observationSize, actionSize);
    this.valueNetwork = new ValueNetwork(observationSize);
    
    this.trainingManager = new TrainingManager(this.policyNetwork, this.valueNetwork);
    this.explorationManager = new ExplorationManager();
    
    this.episodeCount = 0;
    
    console.log('RL Agent initialized (velocity setpoint control)');
    console.log(`Observation size: ${observationSize}, Action size: ${actionSize}`);
  }
  
  /**
   * Select action given observation
   * 
   * observation[0:3] = target direction (base action for velocity)
   * observation[3:6] = current velocity
   * observation[6:12] = obstacle/lidar data
   * 
   * Network outputs correction, final = base + correction
   */
  selectAction(observation, training = false) {
    // Base action = target direction (first 3 elements)
    const baseAction = [observation[0], observation[1], observation[2]];
    
    // Get learned correction from network
    const correction = this.policyNetwork.predict(observation);
    
    // Final action = base + correction
    const action = baseAction.map((base, i) => {
      const final = base + correction[i];
      return Math.max(-1, Math.min(1, final));
    });
    
    if (training) {
      return this.explorationManager.addNoise(action, true);
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
    return {
      ...this.trainingManager.getStats(),
      explorationRate: this.explorationManager.getRate(),
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
