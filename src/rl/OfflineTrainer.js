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
    
    // Training config - optimized for speed
    this.targetEpisodes = 1000;
    // Reduced max steps for faster episodes
    this.stepsPerEpisode = Math.min(RL_CONFIG.MAX_EPISODE_STEPS, 500);
    // Train less frequently for faster episode throughput
    this.trainInterval = Math.max(RL_CONFIG.TRAIN_INTERVAL, 25);
    // Use larger timestep for faster simulation (2x normal speed)
    this.timestep = SIMULATION.TIMESTEP * 2;
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
    // Run episodes in batches for better performance
    const BATCH_SIZE = 3; // Run multiple episodes before yielding
    
    while (this.isRunning && this.episodeCount < this.targetEpisodes) {
      // Run a batch of episodes
      for (let i = 0; i < BATCH_SIZE && this.isRunning && this.episodeCount < this.targetEpisodes; i++) {
        await this.runEpisode();
      }
      
      // Yield to UI after each batch
      await this.yield();
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
    let lastInfo = {};
    
    while (!done && stepCount < this.stepsPerEpisode) {
      // Get action from agent (with exploration)
      const action = this.agent.selectAction(observation, true);
      
      // Take step with accelerated timestep
      const result = this.environment.step(action, this.timestep);
      
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
      lastInfo = result.info;
      stepCount++;
    }
    
    // Episode finished
    this.episodeCount++;
    this.totalReward += episodeReward;
    this.recentRewards.push(episodeReward);
    if (this.recentRewards.length > 100) {
      this.recentRewards.shift();
    }
    
    // Determine episode outcome
    const wasSuccess = lastInfo.success === true;
    const reason = lastInfo.reason || (stepCount >= this.stepsPerEpisode ? 'timeout' : 'unknown');
    const collisionType = lastInfo.collisionType || null;
    
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
        reason,
        collisionType,
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

