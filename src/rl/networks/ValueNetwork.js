/**
 * Value Network (Critic) for RL Agent
 * Estimates state value for advantage calculation
 */

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../../config.js';

export class ValueNetwork {
  constructor(observationSize) {
    this.observationSize = observationSize;
    this.model = null;
    
    // Reusable buffer for single predictions
    this._inputBuffer = null;
    
    this.build();
  }
  
  /**
   * Build the value network architecture
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
          units: 1,
          activation: 'linear',
          kernelInitializer: 'glorotNormal',
        }),
      ],
    });
    
    this.model.compile({
      optimizer: tf.train.adam(RL_CONFIG.LEARNING_RATE * 2),
      loss: 'meanSquaredError',
    });
  }
  
  /**
   * Predict value from observation
   * OPTIMIZED: Reuses input buffer to minimize tensor allocation
   * @param {Array} observation - Single observation
   * @returns {number} - State value
   */
  predict(observation) {
    // Initialize reusable buffer on first call
    if (!this._inputBuffer) {
      this._inputBuffer = new Float32Array(this.observationSize);
    }
    
    // Copy observation to buffer
    for (let i = 0; i < observation.length; i++) {
      this._inputBuffer[i] = observation[i];
    }
    
    // Use tf.tidy to automatically clean up intermediate tensors
    return tf.tidy(() => {
      const obsTensor = tf.tensor2d(this._inputBuffer, [1, this.observationSize]);
      const valueTensor = this.model.predict(obsTensor);
      return valueTensor.dataSync()[0];
    });
  }
  
  /**
   * Predict values for batch of observations
   * @param {Array} observations - Array of observations
   * @returns {Array} - Array of values
   */
  predictBatch(observations) {
    return observations.map(obs => this.predict(obs));
  }
  
  /**
   * Train on batch
   * @param {tf.Tensor2D} observations
   * @param {tf.Tensor2D} targetValues
   * @returns {Promise<number>} - Loss value
   */
  async fit(observations, targetValues) {
    const result = await this.model.fit(observations, targetValues, {
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

