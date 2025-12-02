/**
 * Data recorder for collecting training examples from the classical controller
 */
import { LIDAR, VEHICLE, AUTOPILOT } from '../config.js';

export class DataRecorder {
  constructor() {
    this.data = [];
    this.isRecording = false;
    this.episodeData = [];
    this.episodeCount = 0;
    this.maxDataSize = 50000; // Maximum number of samples to keep
  }

  /**
   * Start recording a new episode
   */
  startEpisode() {
    this.isRecording = true;
    this.episodeData = [];
    this.episodeCount++;
  }

  /**
   * Record a single timestep
   */
  record(lidarDistances, vehicleState, routeState, controlAction) {
    if (!this.isRecording) return;
    
    // Prepare input features
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    const input = [
      ...normalizedLidar,
      vehicleState.speed / VEHICLE.MAX_SPEED,
      routeState.headingError / Math.PI,
      routeState.lateralOffset / (VEHICLE.WIDTH * 2),
      routeState.targetDirection.x,
      routeState.targetDirection.z,
    ];
    
    // Prepare target (normalized control actions)
    const target = [
      controlAction.steering / VEHICLE.MAX_STEER_ANGLE,
      controlAction.throttle,
    ];
    
    // Store sample
    this.episodeData.push({
      input,
      target,
      timestamp: Date.now(),
    });
  }

  /**
   * End current episode
   */
  endEpisode(success = true) {
    this.isRecording = false;
    
    if (this.episodeData.length > 0 && success) {
      // Add episode data to main dataset
      this.data.push(...this.episodeData);
      
      // Trim to max size (keep newer data)
      if (this.data.length > this.maxDataSize) {
        this.data = this.data.slice(-this.maxDataSize);
      }
      
      console.log(`Episode ${this.episodeCount} recorded: ${this.episodeData.length} samples`);
    }
    
    this.episodeData = [];
  }

  /**
   * Get all recorded data
   */
  getData() {
    return this.data;
  }

  /**
   * Get data size
   */
  getDataSize() {
    return this.data.length;
  }

  /**
   * Get random batch of data for training
   */
  getRandomBatch(batchSize = AUTOPILOT.BATCH_SIZE) {
    if (this.data.length < batchSize) {
      return this.data;
    }
    
    // Shuffle and sample
    const shuffled = [...this.data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, batchSize);
  }

  /**
   * Get statistics about recorded data
   */
  getStats() {
    if (this.data.length === 0) {
      return {
        totalSamples: 0,
        episodes: this.episodeCount,
        avgSteer: 0,
        avgThrottle: 0,
      };
    }
    
    let steerSum = 0;
    let throttleSum = 0;
    
    this.data.forEach(sample => {
      steerSum += Math.abs(sample.target[0]);
      throttleSum += sample.target[1];
    });
    
    return {
      totalSamples: this.data.length,
      episodes: this.episodeCount,
      avgSteer: steerSum / this.data.length,
      avgThrottle: throttleSum / this.data.length,
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.data = [];
    this.episodeData = [];
    this.episodeCount = 0;
    this.isRecording = false;
  }

  /**
   * Export data as JSON
   */
  exportJSON() {
    return JSON.stringify(this.data);
  }

  /**
   * Import data from JSON
   */
  importJSON(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        this.data = imported;
        console.log(`Imported ${imported.length} samples`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }

  /**
   * Save data to localStorage
   */
  saveToStorage(key = 'autopilot-training-data') {
    try {
      localStorage.setItem(key, this.exportJSON());
      console.log(`Saved ${this.data.length} samples to localStorage`);
      return true;
    } catch (error) {
      console.error('Save error:', error);
      return false;
    }
  }

  /**
   * Load data from localStorage
   */
  loadFromStorage(key = 'autopilot-training-data') {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return this.importJSON(saved);
      }
      return false;
    } catch (error) {
      console.error('Load error:', error);
      return false;
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording() {
    return this.isRecording;
  }
}

