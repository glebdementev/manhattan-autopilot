/**
 * Training manager - coordinates data collection and model training
 */
import { AUTOPILOT } from '../config.js';

export class Trainer {
  constructor(model, dataRecorder) {
    this.model = model;
    this.recorder = dataRecorder;
    
    this.trainingInProgress = false;
    this.collectingData = false;
    this.targetEpisodes = 0;
    this.currentEpisode = 0;
    
    this.callbacks = {
      onTrainingStart: null,
      onTrainingProgress: null,
      onTrainingComplete: null,
      onEpisodeComplete: null,
    };
  }

  /**
   * Set callbacks for training events
   */
  setCallbacks(callbacks) {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Start automated data collection
   */
  startDataCollection(numEpisodes = 20) {
    this.collectingData = true;
    this.targetEpisodes = numEpisodes;
    this.currentEpisode = 0;
    console.log(`Starting data collection: ${numEpisodes} episodes`);
  }

  /**
   * Stop data collection
   */
  stopDataCollection() {
    this.collectingData = false;
    this.recorder.endEpisode(false);
    console.log('Data collection stopped');
  }

  /**
   * Called when an episode starts
   */
  onEpisodeStart() {
    if (this.collectingData) {
      this.recorder.startEpisode();
    }
  }

  /**
   * Called when an episode ends
   */
  onEpisodeEnd(success = true) {
    if (this.collectingData) {
      this.recorder.endEpisode(success);
      this.currentEpisode++;
      
      if (this.callbacks.onEpisodeComplete) {
        this.callbacks.onEpisodeComplete(this.currentEpisode, this.targetEpisodes);
      }
      
      // Check if collection is complete
      if (this.currentEpisode >= this.targetEpisodes) {
        this.collectingData = false;
        console.log(`Data collection complete: ${this.recorder.getDataSize()} samples`);
      }
    }
  }

  /**
   * Train model on collected data
   */
  async train(epochs = 10) {
    const data = this.recorder.getData();
    
    if (data.length < AUTOPILOT.BATCH_SIZE) {
      console.warn(`Not enough data to train. Have ${data.length}, need ${AUTOPILOT.BATCH_SIZE}`);
      return false;
    }
    
    this.trainingInProgress = true;
    
    if (this.callbacks.onTrainingStart) {
      this.callbacks.onTrainingStart();
    }
    
    // Build model if needed
    if (!this.model.isReady()) {
      this.model.build();
    }
    
    // Train
    const result = await this.model.trainOnData(data, epochs, (epoch, total, loss) => {
      if (this.callbacks.onTrainingProgress) {
        this.callbacks.onTrainingProgress(epoch, total, loss);
      }
    });
    
    this.trainingInProgress = false;
    
    if (this.callbacks.onTrainingComplete) {
      this.callbacks.onTrainingComplete(result);
    }
    
    return result !== null;
  }

  /**
   * Quick train on recent data
   */
  async quickTrain() {
    const batch = this.recorder.getRandomBatch(AUTOPILOT.BATCH_SIZE * 4);
    
    if (batch.length < AUTOPILOT.BATCH_SIZE) {
      return null;
    }
    
    const inputs = batch.map(d => d.input);
    const targets = batch.map(d => d.target);
    
    return await this.model.trainBatch(inputs, targets);
  }

  /**
   * Save model and data
   */
  async saveAll(modelName = 'autopilot-model', dataKey = 'autopilot-training-data') {
    const modelSaved = await this.model.save(modelName);
    const dataSaved = this.recorder.saveToStorage(dataKey);
    
    return { modelSaved, dataSaved };
  }

  /**
   * Load model and data
   */
  async loadAll(modelName = 'autopilot-model', dataKey = 'autopilot-training-data') {
    const modelLoaded = await this.model.load(modelName);
    const dataLoaded = this.recorder.loadFromStorage(dataKey);
    
    return { modelLoaded, dataLoaded };
  }

  /**
   * Get training status
   */
  getStatus() {
    return {
      trainingInProgress: this.trainingInProgress,
      collectingData: this.collectingData,
      currentEpisode: this.currentEpisode,
      targetEpisodes: this.targetEpisodes,
      dataSize: this.recorder.getDataSize(),
      modelReady: this.model.isReady(),
      trainingHistory: this.model.getTrainingHistory(),
    };
  }

  /**
   * Check if currently collecting data
   */
  isCollecting() {
    return this.collectingData;
  }

  /**
   * Check if training is in progress
   */
  isTraining() {
    return this.trainingInProgress;
  }
}

