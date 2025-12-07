/**
 * Episode Statistics Tracker for RL Environment
 * Tracks training progress and episode metrics
 */

export class EpisodeStats {
  constructor() {
    // Counters
    this.totalEpisodes = 0;
    this.successfulEpisodes = 0;
    this.totalReward = 0;
    
    // Recent history for averaging
    this.recentRewards = [];
    this.maxRecentSize = 100;
    
    // Current episode state
    this.currentEpisodeReward = 0;
    this.currentEpisodeSteps = 0;
    this.episodeStartTime = 0;
  }
  
  /**
   * Start a new episode
   */
  startEpisode() {
    this.currentEpisodeReward = 0;
    this.currentEpisodeSteps = 0;
    this.episodeStartTime = performance.now();
  }
  
  /**
   * Record a step in the current episode
   * @param {number} reward - Reward received
   */
  recordStep(reward) {
    this.currentEpisodeReward += reward;
    this.currentEpisodeSteps++;
  }
  
  /**
   * End the current episode
   * @param {boolean} success - Whether episode was successful
   */
  endEpisode(success) {
    this.totalEpisodes++;
    this.totalReward += this.currentEpisodeReward;
    
    // Track recent rewards
    this.recentRewards.push(this.currentEpisodeReward);
    if (this.recentRewards.length > this.maxRecentSize) {
      this.recentRewards.shift();
    }
    
    if (success) {
      this.successfulEpisodes++;
    }
  }
  
  /**
   * Get current statistics
   * @returns {Object}
   */
  getStats() {
    const avgReward = this.recentRewards.length > 0
      ? this.recentRewards.reduce((a, b) => a + b, 0) / this.recentRewards.length
      : 0;
    
    return {
      totalEpisodes: this.totalEpisodes,
      successfulEpisodes: this.successfulEpisodes,
      successRate: this.totalEpisodes > 0 ? this.successfulEpisodes / this.totalEpisodes : 0,
      totalReward: this.totalReward,
      avgRecentReward: avgReward,
      currentEpisodeReward: this.currentEpisodeReward,
      currentEpisodeSteps: this.currentEpisodeSteps,
    };
  }
  
  /**
   * Get episode duration
   * @returns {number} - Duration in milliseconds
   */
  getEpisodeDuration() {
    return performance.now() - this.episodeStartTime;
  }
  
  /**
   * Reset all statistics
   */
  reset() {
    this.totalEpisodes = 0;
    this.successfulEpisodes = 0;
    this.totalReward = 0;
    this.recentRewards = [];
    this.currentEpisodeReward = 0;
    this.currentEpisodeSteps = 0;
    this.episodeStartTime = 0;
  }
}

