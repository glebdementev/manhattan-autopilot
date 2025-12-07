/**
 * TensorFlow.js neural network autopilot model for drone navigation
 * Takes 3D LiDAR and state inputs, outputs thrust commands
 */
import * as tf from '@tensorflow/tfjs';
import { AUTOPILOT, LIDAR, DRONE } from '../config.js';

export class AutopilotModel {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.trainingHistory = [];
  }

  /**
   * Build the neural network model
   */
  build() {
    const inputSize = AUTOPILOT.INPUT_SIZE;
    
    this.model = tf.sequential();
    
    // Input layer + first hidden layer
    this.model.add(tf.layers.dense({
      inputShape: [inputSize],
      units: AUTOPILOT.HIDDEN_LAYERS[0],
      activation: 'relu',
      kernelInitializer: 'heNormal',
    }));
    
    // Additional hidden layers
    for (let i = 1; i < AUTOPILOT.HIDDEN_LAYERS.length; i++) {
      this.model.add(tf.layers.dense({
        units: AUTOPILOT.HIDDEN_LAYERS[i],
        activation: 'relu',
        kernelInitializer: 'heNormal',
      }));
      
      // Add dropout for regularization
      if (i < AUTOPILOT.HIDDEN_LAYERS.length - 1) {
        this.model.add(tf.layers.dropout({ rate: 0.1 }));
      }
    }
    
    // Output layer: [thrustX, thrustY, thrustZ] with tanh for [-1, 1] range
    this.model.add(tf.layers.dense({
      units: AUTOPILOT.OUTPUT_SIZE,
      activation: 'tanh',
      kernelInitializer: 'glorotNormal',
    }));
    
    // Compile model
    this.model.compile({
      optimizer: tf.train.adam(AUTOPILOT.LEARNING_RATE),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });
    
    console.log('Autopilot model built:');
    this.model.summary();
    
    return this.model;
  }

  /**
   * Prepare input tensor from sensor data
   */
  prepareInput(lidarDistances, droneState, targetDirection) {
    // Normalize LiDAR distances
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    // Combine all inputs
    const input = [
      ...normalizedLidar,                              // 256 values (32*8)
      droneState.vx / DRONE.MAX_SPEED,                 // 1 value
      droneState.vy / DRONE.MAX_SPEED,                 // 1 value
      droneState.vz / DRONE.MAX_SPEED,                 // 1 value
      targetDirection.x,                               // 1 value
      targetDirection.y,                               // 1 value
      targetDirection.z,                               // 1 value
    ];
    
    return input;
  }

  /**
   * Run inference to get control commands
   */
  predict(lidarDistances, droneState, targetDirection) {
    if (!this.model) {
      console.warn('Model not built yet');
      return { thrustX: 0, thrustY: 0, thrustZ: 0 };
    }
    
    const input = this.prepareInput(lidarDistances, droneState, targetDirection);
    
    // Run prediction
    const inputTensor = tf.tensor2d([input]);
    const outputTensor = this.model.predict(inputTensor);
    const output = outputTensor.dataSync();
    
    // Cleanup tensors
    inputTensor.dispose();
    outputTensor.dispose();
    
    return {
      thrustX: output[0],
      thrustY: output[1],
      thrustZ: output[2],
    };
  }

  /**
   * Train on a batch of data
   */
  async trainBatch(inputs, targets) {
    if (!this.model) {
      console.warn('Model not built yet');
      return null;
    }
    
    this.isTraining = true;
    
    try {
      const inputTensor = tf.tensor2d(inputs);
      const targetTensor = tf.tensor2d(targets);
      
      const result = await this.model.fit(inputTensor, targetTensor, {
        epochs: 1,
        batchSize: AUTOPILOT.BATCH_SIZE,
        shuffle: true,
        verbose: 0,
      });
      
      inputTensor.dispose();
      targetTensor.dispose();
      
      const loss = result.history.loss[0];
      this.trainingHistory.push(loss);
      
      this.isTraining = false;
      return loss;
    } catch (error) {
      console.error('Training error:', error);
      this.isTraining = false;
      return null;
    }
  }

  /**
   * Train on recorded data
   */
  async trainOnData(trainingData, epochs = 10, onProgress = null) {
    if (!this.model) {
      this.build();
    }
    
    this.isTraining = true;
    
    // Prepare training data
    const inputs = trainingData.map(d => d.input);
    const targets = trainingData.map(d => d.target);
    
    const inputTensor = tf.tensor2d(inputs);
    const targetTensor = tf.tensor2d(targets);
    
    try {
      const result = await this.model.fit(inputTensor, targetTensor, {
        epochs,
        batchSize: AUTOPILOT.BATCH_SIZE,
        shuffle: true,
        validationSplit: 0.1,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(6)}`);
            this.trainingHistory.push(logs.loss);
            if (onProgress) {
              onProgress(epoch + 1, epochs, logs.loss);
            }
          }
        }
      });
      
      inputTensor.dispose();
      targetTensor.dispose();
      
      this.isTraining = false;
      return result;
    } catch (error) {
      console.error('Training error:', error);
      inputTensor.dispose();
      targetTensor.dispose();
      this.isTraining = false;
      return null;
    }
  }

  /**
   * Export model as downloadable JSON file
   */
  async exportToFile() {
    if (!this.model) {
      console.warn('No model to export');
      return false;
    }
    
    try {
      // Get model weights
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
      
      // Create export object
      const exportData = {
        version: 2,
        type: 'drone-autopilot',
        timestamp: Date.now(),
        config: {
          inputSize: AUTOPILOT.INPUT_SIZE,
          hiddenLayers: AUTOPILOT.HIDDEN_LAYERS,
          outputSize: AUTOPILOT.OUTPUT_SIZE,
        },
        weights,
        trainingHistory: this.trainingHistory,
      };
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drone-autopilot-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Model exported successfully');
      return true;
    } catch (error) {
      console.error('Export error:', error);
      return false;
    }
  }

  /**
   * Import model from JSON file
   */
  async importFromFile(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate version
      if (!importData.version || !importData.weights) {
        throw new Error('Invalid model file format');
      }
      
      // Build model structure
      this.build();
      
      // Load weights
      for (let i = 0; i < this.model.layers.length && i < importData.weights.length; i++) {
        const layerWeights = importData.weights[i];
        if (layerWeights.length > 0) {
          const tensors = layerWeights.map(w => tf.tensor(w.data, w.shape));
          this.model.layers[i].setWeights(tensors);
          tensors.forEach(t => t.dispose());
        }
      }
      
      // Restore training history
      if (importData.trainingHistory) {
        this.trainingHistory = importData.trainingHistory;
      }
      
      console.log('Model imported successfully');
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }

  /**
   * Save model to browser storage
   */
  async save(name = 'drone-autopilot-model') {
    if (!this.model) {
      console.warn('No model to save');
      return false;
    }
    
    try {
      await this.model.save(`localstorage://${name}`);
      console.log(`Model saved as ${name}`);
      return true;
    } catch (error) {
      console.error('Save error:', error);
      return false;
    }
  }

  /**
   * Load model from browser storage
   */
  async load(name = 'drone-autopilot-model') {
    try {
      this.model = await tf.loadLayersModel(`localstorage://${name}`);
      
      // Re-compile for inference
      this.model.compile({
        optimizer: tf.train.adam(AUTOPILOT.LEARNING_RATE),
        loss: 'meanSquaredError',
      });
      
      console.log(`Model loaded from ${name}`);
      return true;
    } catch (error) {
      console.error('Load error:', error);
      return false;
    }
  }

  /**
   * Get training history
   */
  getTrainingHistory() {
    return this.trainingHistory;
  }

  /**
   * Check if model is ready for inference
   */
  isReady() {
    return this.model !== null && !this.isTraining;
  }

  /**
   * Check if currently training
   */
  getIsTraining() {
    return this.isTraining;
  }

  /**
   * Get model summary as string
   */
  getSummary() {
    if (!this.model) return 'Model not built';
    
    let summary = [];
    this.model.summary(null, null, (line) => summary.push(line));
    return summary.join('\n');
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
