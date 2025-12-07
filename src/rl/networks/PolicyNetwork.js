/**
 * Policy Network (Actor) for RL Agent
 * Outputs action values in the continuous action space [-1, 1]
 * 
 * SIMPLIFIED: Smaller network for easier training
 */

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../../config.js';

export class PolicyNetwork {
  constructor(observationSize, actionSize) {
    this.observationSize = observationSize;
    this.actionSize = actionSize;
    this.model = null;
    
    // Reusable tensor for single predictions
    this._inputBuffer = null;
    
    this.build();
  }
  
  /**
   * Build the policy network architecture
   */
  build() {
    const layers = [
      tf.layers.dense({
        inputShape: [this.observationSize],
        units: RL_CONFIG.HIDDEN_UNITS[0],
        activation: 'relu',
        kernelInitializer: 'heNormal',
      }),
    ];
    
    // Add remaining hidden layers
    for (let i = 1; i < RL_CONFIG.HIDDEN_UNITS.length; i++) {
      layers.push(tf.layers.dense({
        units: RL_CONFIG.HIDDEN_UNITS[i],
        activation: 'relu',
        kernelInitializer: 'heNormal',
      }));
    }
    
    // Output layer
    layers.push(tf.layers.dense({
      units: this.actionSize,
      activation: 'tanh', // Actions in [-1, 1]
      kernelInitializer: 'glorotNormal',
    }));
    
    this.model = tf.sequential({ layers });
    
    this.model.compile({
      optimizer: tf.train.adam(RL_CONFIG.LEARNING_RATE),
      loss: 'meanSquaredError',
    });
  }
  
  /**
   * Predict action from observation
   */
  predict(observation) {
    if (!this._inputBuffer) {
      this._inputBuffer = new Float32Array(this.observationSize);
    }
    
    for (let i = 0; i < observation.length; i++) {
      this._inputBuffer[i] = observation[i];
    }
    
    const action = tf.tidy(() => {
      const obsTensor = tf.tensor2d(this._inputBuffer, [1, this.observationSize]);
      const actionTensor = this.model.predict(obsTensor);
      return actionTensor.dataSync();
    });
    
    return Array.from(action);
  }
  
  /**
   * Predict actions for batch of observations
   */
  predictBatch(obsTensor) {
    return this.model.predict(obsTensor);
  }
  
  /**
   * Train on batch
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
