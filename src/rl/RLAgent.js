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

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../config.js';

export class RLAgent {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    
    // Networks
    this.policyNetwork = null;
    this.valueNetwork = null;
    
    // Training state
    this.isTraining = false;
    this.trainingStep = 0;
    this.episodeCount = 0;
    
    // Experience buffer for batch training
    this.experienceBuffer = [];
    this.maxBufferSize = RL_CONFIG.BUFFER_SIZE;
    
    // Training history
    this.trainingHistory = {
      policyLoss: [],
      valueLoss: [],
      avgReward: [],
      successRate: [],
    };
    
    // Exploration parameters
    this.explorationRate = RL_CONFIG.INITIAL_EXPLORATION;
    this.explorationDecay = RL_CONFIG.EXPLORATION_DECAY;
    this.minExploration = RL_CONFIG.MIN_EXPLORATION;
    
    // Action noise for exploration
    this.actionNoise = RL_CONFIG.ACTION_NOISE;
    
    // Build networks
    this.build();
  }
  
  /**
   * Build neural networks
   */
  build() {
    // Policy Network (Actor) - outputs mean of action distribution
    this.policyNetwork = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.observationSize],
          units: RL_CONFIG.HIDDEN_UNITS[0],
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dense({
          units: RL_CONFIG.HIDDEN_UNITS[1],
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dense({
          units: RL_CONFIG.HIDDEN_UNITS[2],
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dense({
          units: this.actionSize,
          activation: 'tanh', // Actions in [-1, 1]
          kernelInitializer: 'glorotNormal',
        }),
      ],
    });
    
    // Value Network (Critic) - estimates state value
    this.valueNetwork = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.observationSize],
          units: RL_CONFIG.HIDDEN_UNITS[0],
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dense({
          units: RL_CONFIG.HIDDEN_UNITS[1],
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dense({
          units: 1,
          activation: 'linear',
          kernelInitializer: 'glorotNormal',
        }),
      ],
    });
    
    // Compile networks
    this.policyNetwork.compile({
      optimizer: tf.train.adam(RL_CONFIG.LEARNING_RATE),
      loss: 'meanSquaredError',
    });
    
    this.valueNetwork.compile({
      optimizer: tf.train.adam(RL_CONFIG.LEARNING_RATE * 2),
      loss: 'meanSquaredError',
    });
    
    console.log('RL Agent networks built');
    console.log(`Observation size: ${this.observationSize}, Action size: ${this.actionSize}`);
  }
  
  /**
   * Select action given observation
   * @param {Array} observation
   * @param {boolean} training - Whether to add exploration noise
   */
  selectAction(observation, training = false) {
    const obsTensor = tf.tensor2d([observation]);
    const actionTensor = this.policyNetwork.predict(obsTensor);
    const action = actionTensor.dataSync();
    
    obsTensor.dispose();
    actionTensor.dispose();
    
    // Add exploration noise during training
    if (training && Math.random() < this.explorationRate) {
      return action.map(a => {
        const noise = (Math.random() - 0.5) * 2 * this.actionNoise;
        return Math.max(-1, Math.min(1, a + noise));
      });
    }
    
    return Array.from(action);
  }
  
  /**
   * Get value estimate for observation
   */
  getValue(observation) {
    const obsTensor = tf.tensor2d([observation]);
    const valueTensor = this.valueNetwork.predict(obsTensor);
    const value = valueTensor.dataSync()[0];
    
    obsTensor.dispose();
    valueTensor.dispose();
    
    return value;
  }
  
  /**
   * Store experience in buffer
   */
  storeExperience(observation, action, reward, nextObservation, done) {
    this.experienceBuffer.push({
      observation,
      action,
      reward,
      nextObservation,
      done,
    });
    
    // Limit buffer size
    if (this.experienceBuffer.length > this.maxBufferSize) {
      this.experienceBuffer.shift();
    }
  }
  
  /**
   * Train on collected experiences
   */
  async train() {
    if (this.experienceBuffer.length < RL_CONFIG.MIN_BUFFER_SIZE) {
      return null;
    }
    
    this.isTraining = true;
    
    // Sample batch from buffer
    const batchSize = Math.min(RL_CONFIG.BATCH_SIZE, this.experienceBuffer.length);
    const batch = this.sampleBatch(batchSize);
    
    // Prepare training data
    const observations = batch.map(e => e.observation);
    const actions = batch.map(e => e.action);
    const rewards = batch.map(e => e.reward);
    const nextObservations = batch.map(e => e.nextObservation);
    const dones = batch.map(e => e.done ? 1 : 0);
    
    // Calculate advantages and returns
    const { advantages, returns } = this.computeAdvantages(
      observations, rewards, nextObservations, dones
    );
    
    // Train value network
    const valueLoss = await this.trainValueNetwork(observations, returns);
    
    // Train policy network
    const policyLoss = await this.trainPolicyNetwork(observations, actions, advantages);
    
    // Update training state
    this.trainingStep++;
    this.updateExploration();
    
    // Store history
    this.trainingHistory.policyLoss.push(policyLoss);
    this.trainingHistory.valueLoss.push(valueLoss);
    
    this.isTraining = false;
    
    return { policyLoss, valueLoss };
  }
  
  /**
   * Sample random batch from experience buffer
   */
  sampleBatch(batchSize) {
    const batch = [];
    const indices = new Set();
    
    while (indices.size < batchSize) {
      const idx = Math.floor(Math.random() * this.experienceBuffer.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        batch.push(this.experienceBuffer[idx]);
      }
    }
    
    return batch;
  }
  
  /**
   * Compute advantages using GAE (Generalized Advantage Estimation)
   */
  computeAdvantages(observations, rewards, nextObservations, dones) {
    const gamma = RL_CONFIG.GAMMA;
    const lambda = RL_CONFIG.GAE_LAMBDA;
    
    // Get value estimates
    const values = observations.map(obs => this.getValue(obs));
    const nextValues = nextObservations.map(obs => this.getValue(obs));
    
    const advantages = [];
    const returns = [];
    
    for (let i = 0; i < rewards.length; i++) {
      // TD error
      const tdError = rewards[i] + gamma * nextValues[i] * (1 - dones[i]) - values[i];
      
      // Simple advantage (could use GAE for better estimates)
      advantages.push(tdError);
      
      // Returns for value function training
      returns.push(rewards[i] + gamma * nextValues[i] * (1 - dones[i]));
    }
    
    // Normalize advantages
    const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const std = Math.sqrt(
      advantages.reduce((a, b) => a + (b - mean) ** 2, 0) / advantages.length
    ) + 1e-8;
    
    const normalizedAdvantages = advantages.map(a => (a - mean) / std);
    
    return { advantages: normalizedAdvantages, returns };
  }
  
  /**
   * Train value network
   */
  async trainValueNetwork(observations, returns) {
    const obsTensor = tf.tensor2d(observations);
    const returnsTensor = tf.tensor2d(returns.map(r => [r]));
    
    const result = await this.valueNetwork.fit(obsTensor, returnsTensor, {
      epochs: 1,
      batchSize: RL_CONFIG.BATCH_SIZE,
      verbose: 0,
    });
    
    const loss = result.history.loss[0];
    
    obsTensor.dispose();
    returnsTensor.dispose();
    
    return loss;
  }
  
  /**
   * Train policy network using policy gradient
   */
  async trainPolicyNetwork(observations, actions, advantages) {
    // For policy gradient, we need custom training
    // Target = current_action + advantage * gradient direction
    
    const obsTensor = tf.tensor2d(observations);
    const actionsTensor = tf.tensor2d(actions);
    const advantagesTensor = tf.tensor1d(advantages);
    
    // Compute target actions (nudge towards actions that had positive advantage)
    const currentActions = this.policyNetwork.predict(obsTensor);
    
    // Scale actions by advantages
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
    
    // Clip to valid action range
    const clippedTargets = tf.clipByValue(targetActions, -1, 1);
    
    // Train
    const result = await this.policyNetwork.fit(obsTensor, clippedTargets, {
      epochs: 1,
      batchSize: RL_CONFIG.BATCH_SIZE,
      verbose: 0,
    });
    
    const loss = result.history.loss[0];
    
    // Cleanup
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
   * Update exploration rate
   */
  updateExploration() {
    this.explorationRate = Math.max(
      this.minExploration,
      this.explorationRate * this.explorationDecay
    );
  }
  
  /**
   * Clear experience buffer
   */
  clearBuffer() {
    this.experienceBuffer = [];
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    const recentPolicyLoss = this.trainingHistory.policyLoss.slice(-100);
    const recentValueLoss = this.trainingHistory.valueLoss.slice(-100);
    
    return {
      trainingStep: this.trainingStep,
      explorationRate: this.explorationRate,
      bufferSize: this.experienceBuffer.length,
      avgPolicyLoss: recentPolicyLoss.length > 0 
        ? recentPolicyLoss.reduce((a, b) => a + b, 0) / recentPolicyLoss.length 
        : 0,
      avgValueLoss: recentValueLoss.length > 0 
        ? recentValueLoss.reduce((a, b) => a + b, 0) / recentValueLoss.length 
        : 0,
    };
  }
  
  /**
   * Check if agent is ready for inference
   */
  isReady() {
    return this.policyNetwork !== null && !this.isTraining;
  }
  
  /**
   * Export model to file
   */
  async exportToFile() {
    if (!this.policyNetwork || !this.valueNetwork) {
      console.warn('No model to export');
      return false;
    }
    
    try {
      // Get weights from both networks
      const policyWeights = [];
      for (const layer of this.policyNetwork.layers) {
        const layerWeights = layer.getWeights();
        const layerData = [];
        for (const w of layerWeights) {
          layerData.push({
            shape: w.shape,
            data: Array.from(w.dataSync()),
          });
        }
        policyWeights.push(layerData);
      }
      
      const valueWeights = [];
      for (const layer of this.valueNetwork.layers) {
        const layerWeights = layer.getWeights();
        const layerData = [];
        for (const w of layerWeights) {
          layerData.push({
            shape: w.shape,
            data: Array.from(w.dataSync()),
          });
        }
        valueWeights.push(layerData);
      }
      
      const exportData = {
        version: 1,
        type: 'drone-rl-agent',
        timestamp: Date.now(),
        config: {
          observationSize: this.observationSize,
          actionSize: this.actionSize,
          hiddenUnits: RL_CONFIG.HIDDEN_UNITS,
        },
        policyWeights,
        valueWeights,
        trainingHistory: this.trainingHistory,
        trainingStep: this.trainingStep,
        explorationRate: this.explorationRate,
      };
      
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drone-rl-agent-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('RL Agent exported successfully');
      return true;
    } catch (error) {
      console.error('Export error:', error);
      return false;
    }
  }
  
  /**
   * Import model from file
   */
  async importFromFile(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.version || !importData.policyWeights) {
        throw new Error('Invalid model file format');
      }
      
      // Rebuild networks if needed
      if (!this.policyNetwork) {
        this.build();
      }
      
      // Load policy weights
      for (let i = 0; i < this.policyNetwork.layers.length && i < importData.policyWeights.length; i++) {
        const layerWeights = importData.policyWeights[i];
        if (layerWeights.length > 0) {
          const tensors = layerWeights.map(w => tf.tensor(w.data, w.shape));
          this.policyNetwork.layers[i].setWeights(tensors);
          tensors.forEach(t => t.dispose());
        }
      }
      
      // Load value weights
      if (importData.valueWeights) {
        for (let i = 0; i < this.valueNetwork.layers.length && i < importData.valueWeights.length; i++) {
          const layerWeights = importData.valueWeights[i];
          if (layerWeights.length > 0) {
            const tensors = layerWeights.map(w => tf.tensor(w.data, w.shape));
            this.valueNetwork.layers[i].setWeights(tensors);
            tensors.forEach(t => t.dispose());
          }
        }
      }
      
      // Restore training state
      if (importData.trainingHistory) {
        this.trainingHistory = importData.trainingHistory;
      }
      if (importData.trainingStep) {
        this.trainingStep = importData.trainingStep;
      }
      if (importData.explorationRate) {
        this.explorationRate = importData.explorationRate;
      }
      
      console.log('RL Agent imported successfully');
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
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

