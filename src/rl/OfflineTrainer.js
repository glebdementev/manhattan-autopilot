/**
 * Offline Trainer - Runs RL training without rendering
 * 
 * Simulates episodes in a headless environment for fast training.
 */

import { RL_CONFIG, SIMULATION } from '../config.js';

export class OfflineTrainer {
  constructor(rlAgent, rlEnvironment, forestGenerator) {
    this.agent = rlAgent;
    this.environment = rlEnvironment;
    this.forest = forestGenerator;
    
    this.isRunning = false;
    this.episodeCount = 0;
    this.successCount = 0;
    this.totalReward = 0;
    this.recentRewards = [];
    
    // Callbacks
    this.onProgress = null;
    this.onEpisodeEnd = null;
    this.onComplete = null;
    
    // Training config
    this.targetEpisodes = 1000;
    this.stepsPerEpisode = RL_CONFIG.MAX_EPISODE_STEPS;
    this.trainInterval = RL_CONFIG.TRAIN_INTERVAL;
  }
  
  /**
   * Start training
   */
  async start(targetEpisodes = 1000) {
    this.targetEpisodes = targetEpisodes;
    this.isRunning = true;
    this.episodeCount = 0;
    this.successCount = 0;
    this.totalReward = 0;
    this.recentRewards = [];
    
    console.log(`Starting offline training for ${targetEpisodes} episodes...`);
    
    // Run training loop
    await this.runTrainingLoop();
  }
  
  /**
   * Stop training
   */
  stop() {
    this.isRunning = false;
    console.log('Training stopped');
  }
  
  /**
   * Main training loop
   */
  async runTrainingLoop() {
    while (this.isRunning && this.episodeCount < this.targetEpisodes) {
      await this.runEpisode();
      
      // Yield to UI every few episodes
      if (this.episodeCount % 5 === 0) {
        await this.yield();
      }
    }
    
    if (this.onComplete) {
      this.onComplete(this.getStats());
    }
  }
  
  /**
   * Run a single episode
   */
  async runEpisode() {
    let observation = this.environment.reset();
    let episodeReward = 0;
    let stepCount = 0;
    let done = false;
    
    while (!done && stepCount < this.stepsPerEpisode) {
      // Get action from agent (with exploration)
      const action = this.agent.selectAction(observation, true);
      
      // Take step
      const result = this.environment.step(action, SIMULATION.TIMESTEP);
      
      // Store experience
      this.agent.storeExperience(
        observation,
        action,
        result.reward,
        result.observation,
        result.done
      );
      
      // Train periodically
      if (stepCount % this.trainInterval === 0) {
        await this.agent.train();
      }
      
      // Update state
      observation = result.observation;
      episodeReward += result.reward;
      done = result.done;
      stepCount++;
    }
    
    // Episode finished
    this.episodeCount++;
    this.totalReward += episodeReward;
    this.recentRewards.push(episodeReward);
    if (this.recentRewards.length > 100) {
      this.recentRewards.shift();
    }
    
    // Check success
    const wasSuccess = done && this.environment.getDistanceToTarget() < this.environment.targetRadius;
    if (wasSuccess) {
      this.successCount++;
    }
    
    // Callbacks
    if (this.onEpisodeEnd) {
      this.onEpisodeEnd({
        episode: this.episodeCount,
        reward: episodeReward,
        steps: stepCount,
        success: wasSuccess,
      });
    }
    
    if (this.onProgress) {
      this.onProgress(this.getStats());
    }
  }
  
  /**
   * Get current stats
   */
  getStats() {
    const avgReward = this.recentRewards.length > 0
      ? this.recentRewards.reduce((a, b) => a + b, 0) / this.recentRewards.length
      : 0;
    
    const agentStats = this.agent.getStats();
    
    return {
      episodes: this.episodeCount,
      successRate: this.episodeCount > 0 ? this.successCount / this.episodeCount : 0,
      avgReward,
      trainingSteps: agentStats.trainingStep,
      explorationRate: agentStats.explorationRate,
      bufferSize: agentStats.bufferSize,
      policyLoss: agentStats.avgPolicyLoss || null,
      valueLoss: agentStats.avgValueLoss || null,
      targetEpisodes: this.targetEpisodes,
    };
  }
  
  /**
   * Yield control to UI
   */
  yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }
}

