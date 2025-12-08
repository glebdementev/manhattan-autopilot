/**
 * PathPredictor - Neural network that predicts navigation actions from LIDAR observations
 * 
 * This is the "student" model that learns to imitate the omniscient pathfinder.
 * Uses a simple MLP architecture with TensorFlow.js
 */
import * as tf from '@tensorflow/tfjs';

export class PathPredictor {
  constructor(observationDim, actionDim) {
    this.observationDim = observationDim;
    this.actionDim = actionDim;
    this.model = null;
    this.isTraining = false;
    
    // Training history
    this.trainingHistory = [];
  }
  
  /**
   * Build the neural network model
   */
  build() {
    this.model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [this.observationDim],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        
        // Hidden layers
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dropout({ rate: 0.1 }),
        
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dropout({ rate: 0.1 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        
        // Output layer (normalized velocity commands)
        tf.layers.dense({
          units: this.actionDim,
          activation: 'tanh', // Output in [-1, 1]
        }),
      ],
    });
    
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });
    
    console.log('PathPredictor model built:');
    this.model.summary();
  }
  
  /**
   * Train the model on collected samples
   * @param {Array} samples - Array of {observation, action}
   * @param {Object} options - Training options
   */
  async train(samples, options = {}) {
    if (!this.model) {
      throw new Error('Model not built. Call build() first.');
    }
    
    if (samples.length === 0) {
      throw new Error('No samples to train on.');
    }
    
    const {
      epochs = 50,
      batchSize = 64,
      validationSplit = 0.1,
      onEpochEnd = null,
    } = options;
    
    this.isTraining = true;
    
    // Prepare training data
    const observations = samples.map(s => Array.from(s.observation));
    const actions = samples.map(s => Array.from(s.action));
    
    const xs = tf.tensor2d(observations);
    const ys = tf.tensor2d(actions);
    
    try {
      const history = await this.model.fit(xs, ys, {
        epochs,
        batchSize,
        validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            this.trainingHistory.push({
              epoch,
              loss: logs.loss,
              valLoss: logs.val_loss,
            });
            
            if (onEpochEnd) {
              onEpochEnd(epoch, logs);
            }
          },
        },
      });
      
      return history;
    } finally {
      xs.dispose();
      ys.dispose();
      this.isTraining = false;
    }
  }
  
  /**
   * Predict action from observation
   * @param {Float32Array} observation - Current observation
   * @returns {Float32Array} Predicted action [vx, vy, vz]
   */
  predict(observation) {
    if (!this.model) {
      throw new Error('Model not built. Call build() first.');
    }
    
    // Guard against mismatched observation dimensions (e.g. legacy models)
    if (!observation || observation.length !== this.observationDim) {
      console.warn(
        `PathPredictor.predict: observation dim mismatch (expected ${this.observationDim}, got ${observation ? observation.length : 0}). Returning zero action.`
      );
      return new Float32Array(this.actionDim);
    }
    
    const input = tf.tensor2d([Array.from(observation)]);
    const output = this.model.predict(input);
    const action = output.dataSync();
    
    input.dispose();
    output.dispose();
    
    return new Float32Array(action);
  }
  
  /**
   * Predict actions for a batch of observations
   * @param {Array} observations - Array of observations
   * @returns {Array} Array of predicted actions
   */
  predictBatch(observations) {
    if (!this.model) {
      throw new Error('Model not built. Call build() first.');
    }
    
    const input = tf.tensor2d(observations.map(o => Array.from(o)));
    const output = this.model.predict(input);
    const actions = output.arraySync();
    
    input.dispose();
    output.dispose();
    
    return actions.map(a => new Float32Array(a));
  }
  
  /**
   * Save model to IndexedDB
   */
  async save(name = 'path-predictor') {
    this.assertModelReady();
    await this.model.save(`indexeddb://${name}`);
    console.log(`Model saved as '${name}'`);
  }
  
  /**
   * Save model to local files (downloads)
   */
  async download(name = 'path-predictor') {
    this.assertModelReady();
    await this.model.save(`downloads://${name}`);
    console.log(`Model downloaded as '${name}'`);
  }

  /**
   * Load model from IndexedDB
   */
  async load(name = 'path-predictor') {
    try {
      const loadedModel = await tf.loadLayersModel(`indexeddb://${name}`);
      return this.applyLoadedModel(loadedModel, name);
    } catch (e) {
      console.warn(`Could not load model '${name}':`, e.message);
      return false;
    }
  }

  /**
   * Load model from local files (json + weights)
   */
  async loadFromFiles(files) {
    try {
      const sources = this.normalizeModelFiles(files);
      const loadedModel = await tf.loadLayersModel(tf.io.browserFiles(sources));
      return this.applyLoadedModel(loadedModel, sources[0].name);
    } catch (e) {
      console.warn('Could not load model from files:', e.message);
      return false;
    }
  }
  
  /**
   * Export model weights as JSON
   */
  async exportWeights() {
    if (!this.model) {
      throw new Error('Model not built. Call build() first.');
    }
    
    const weights = [];
    for (const layer of this.model.layers) {
      const layerWeights = layer.getWeights();
      weights.push(layerWeights.map(w => ({
        shape: w.shape,
        data: Array.from(w.dataSync()),
      })));
    }
    
    return {
      observationDim: this.observationDim,
      actionDim: this.actionDim,
      weights,
    };
  }
  
  /**
   * Import model weights from JSON
   */
  async importWeights(data) {
    if (!this.model) {
      this.observationDim = data.observationDim;
      this.actionDim = data.actionDim;
      this.build();
    }
    
    for (let i = 0; i < this.model.layers.length; i++) {
      if (data.weights[i] && data.weights[i].length > 0) {
        const tensors = data.weights[i].map(w => 
          tf.tensor(w.data, w.shape)
        );
        this.model.layers[i].setWeights(tensors);
        tensors.forEach(t => t.dispose());
      }
    }
  }
  
  /**
   * Get training history
   */
  getTrainingHistory() {
    return this.trainingHistory;
  }
  
  /**
   * Check if model is ready for prediction
   */
  isReady() {
    return this.model !== null;
  }

  /**
   * Shared helpers
   */
  getInputDim(model) {
    const firstLayer = model && model.layers && model.layers[0];
    return firstLayer && firstLayer.batchInputShape
      ? firstLayer.batchInputShape[1]
      : null;
  }

  applyLoadedModel(model, sourceName) {
    const inputDim = this.getInputDim(model);
    if (inputDim !== this.observationDim) {
      console.warn(
        `PathPredictor.load: ignoring model '${sourceName}' (inputDim=${inputDim}, expected=${this.observationDim}).`
      );
      return false;
    }

    this.model = model;
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });
    console.log(`Model loaded from '${sourceName}'`);
    return true;
  }

  normalizeModelFiles(files) {
    const fileList = Array.from(files || []);
    const jsonFile = fileList.find(f => f.name.toLowerCase().endsWith('.json'));
    const weightFiles = fileList.filter(f => f !== jsonFile && f.name.toLowerCase().endsWith('.bin'));

    if (!jsonFile || weightFiles.length === 0) {
      throw new Error('Select the exported model JSON and weight BIN files.');
    }

    weightFiles.sort((a, b) => a.name.localeCompare(b.name));
    return [jsonFile, ...weightFiles];
  }

  assertModelReady() {
    if (!this.model) {
      throw new Error('Model not built. Call build() first.');
    }
  }
}

