/**
 * Policy Network (Actor) for RL Agent
 * Outputs action values in the continuous action space [-1, 1]
 */

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../../config.js';

export class PolicyNetwork {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    this.model = null;
    
    this.build();
  }
  
  /**
   * Build the policy network architecture
   */
  build() {
    this.model = tf.sequential({
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
    
    this.model.compile({
      optimizer: tf.train.adam(RL_CONFIG.LEARNING_RATE),
      loss: 'meanSquaredError',
    });
  }
  
  /**
   * Predict action from observation
   * @param {Array} observation - Single observation
   * @returns {Array} - Action values
   */
  predict(observation) {
    const obsTensor = tf.tensor2d([observation]);
    const actionTensor = this.model.predict(obsTensor);
    const action = actionTensor.dataSync();
    
    obsTensor.dispose();
    actionTensor.dispose();
    
    return Array.from(action);
  }
  
  /**
   * Predict actions for batch of observations
   * @param {tf.Tensor2D} obsTensor - Batch of observations
   * @returns {tf.Tensor2D} - Batch of actions
   */
  predictBatch(obsTensor) {
    return this.model.predict(obsTensor);
  }
  
  /**
   * Train on batch
   * @param {tf.Tensor2D} observations
   * @param {tf.Tensor2D} targetActions
   * @returns {Promise<number>} - Loss value
   */
  async fit(observations, targetActions) {
    const result = await this.model.fit(observations, targetActions, {
      epochs: 1,
      batchSize: RL_CONFIG.BATCH_SIZE,
      verbose: 0,
    });
    
    return result.history.loss[0];
  }
  
  /**
   * Get model weights
   * @returns {Array} - Layer weights data
   */
  getWeights() {
    const weights = [];
    for (const layer of this.model.layers) {
      const layerWeights = layer.getWeights();
      const layerData = [];
      for (const w of layerWeights) {
        layerData.push({
          shape: w.shape,
          data: Array.from(w.dataSync()),
        });
      }
      weights.push(layerData);
    }
    return weights;
  }
  
  /**
   * Set model weights
   * @param {Array} weights - Layer weights data
   */
  setWeights(weights) {
    for (let i = 0; i < this.model.layers.length && i < weights.length; i++) {
      const layerWeights = weights[i];
      if (layerWeights.length > 0) {
        const tensors = layerWeights.map(w => tf.tensor(w.data, w.shape));
        this.model.layers[i].setWeights(tensors);
        tensors.forEach(t => t.dispose());
      }
    }
  }
  
  /**
   * Dispose of the model
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

