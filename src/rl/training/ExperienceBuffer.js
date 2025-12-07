/**
 * Experience Replay Buffer for RL training
 * Stores and samples experience tuples (s, a, r, s', done)
 */

import { RL_CONFIG } from '../../config.js';

export class ExperienceBuffer {
  constructor(maxSize = RL_CONFIG.BUFFER_SIZE) {
    this.maxSize = maxSize;
    this.buffer = [];
  }
  
  /**
   * Store experience in buffer
   * @param {Array} observation - Current state
   * @param {Array} action - Action taken
   * @param {number} reward - Reward received
   * @param {Array} nextObservation - Next state
   * @param {boolean} done - Episode terminated
   */
  store(observation, action, reward, nextObservation, done) {
    this.buffer.push({
      observation,
      action,
      reward,
      nextObservation,
      done,
    });
    
    // Limit buffer size (FIFO)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }
  
  /**
   * Sample random batch from buffer
   * @param {number} batchSize - Number of samples
   * @returns {Array} - Array of experience objects
   */
  sample(batchSize) {
    const actualBatchSize = Math.min(batchSize, this.buffer.length);
    const batch = [];
    const indices = new Set();
    
    while (indices.size < actualBatchSize) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        batch.push(this.buffer[idx]);
      }
    }
    
    return batch;
  }
  
  /**
   * Get all experiences (for full batch training)
   * @returns {Array} - All experiences
   */
  getAll() {
    return [...this.buffer];
  }
  
  /**
   * Get recent experiences
   * @param {number} count - Number of recent experiences
   * @returns {Array} - Recent experiences
   */
  getRecent(count) {
    return this.buffer.slice(-count);
  }
  
  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
  }
  
  /**
   * Get buffer size
   * @returns {number}
   */
  get size() {
    return this.buffer.length;
  }
  
  /**
   * Check if buffer has minimum samples for training
   * @param {number} minSize - Minimum required size
   * @returns {boolean}
   */
  isReadyForTraining(minSize = RL_CONFIG.MIN_BUFFER_SIZE) {
    return this.buffer.length >= minSize;
  }
  
  /**
   * Extract batch data into separate arrays
   * @param {Array} batch - Array of experience objects
   * @returns {Object} - Separated arrays
   */
  static extractBatchData(batch) {
    return {
      observations: batch.map(e => e.observation),
      actions: batch.map(e => e.action),
      rewards: batch.map(e => e.reward),
      nextObservations: batch.map(e => e.nextObservation),
      dones: batch.map(e => e.done ? 1 : 0),
    };
  }
}

