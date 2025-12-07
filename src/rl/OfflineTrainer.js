/**
 * Offline Trainer - Runs RL training without rendering
 * 
 * SIMPLIFIED for curriculum learning:
 * - Trains more frequently (every 20 steps instead of 100)
 * - Reports curriculum progress
 * - Uses same physics timestep as visible simulation
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
    this.timestep = SIMULATION.TIMESTEP;
    
    // Train more frequently for faster learning
    this.trainInterval = 20;
    
    // Performance tracking
    this.stepsPerSecond = 0;
    this.lastPerfTime = 0;
    this.perfStepCount = 0;
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
    
    // Initialize episode state
    this.currentObservation = null;
    this.currentEpisodeReward = 0;
    this.currentEpisodeSteps = 0;
    this.currentEpisodeDone = true;
    this.currentEpisodeInfo = {};
    
    console.log(`Starting curriculum training for ${targetEpisodes} episodes...`);
    console.log(`Training interval: every ${this.trainInterval} steps`);
    console.log(`Starting at curriculum level: ${this.environment.getCurriculumManager().getLevel()}`);
    
    // Suppress verbose logging
    this.suppressLogging();
    
    // Start first episode
    this.startNewEpisode();
    
    // Run training loop
    await this.runTrainingLoop();
    
    // Restore logging
    this.restoreLogging();
  }
  
  /**
   * Suppress console.log during training
   */
  suppressLogging() {
    this._originalConsoleLog = console.log;
    console.log = (...args) => {
      const msg = args[0]?.toString() || '';
      if (msg.includes('Training') || msg.includes('Episode') || 
          msg.includes('Model') || msg.includes('curriculum') ||
          msg.includes('Level')) {
        this._originalConsoleLog.apply(console, args);
      }
    };
  }
  
  /**
   * Restore normal console.log
   */
  restoreLogging() {
    if (this._originalConsoleLog) {
      console.log = this._originalConsoleLog;
      this._originalConsoleLog = null;
    }
  }
  
  /**
   * Stop training
   */
  stop() {
    this.isRunning = false;
    this.restoreLogging();
    console.log('Training stopped');
  }
  
  /**
   * Main training loop
   */
  async runTrainingLoop() {
    const UI_YIELD_INTERVAL_MS = 100;
    const STEPS_PER_TIME_CHECK = 50;
    
    this.lastPerfTime = performance.now();
    this.perfStepCount = 0;
    
    let stepsSinceYield = 0;
    let lastYieldTime = performance.now();
    let stepsSinceTraining = 0;
    
    while (this.isRunning && this.episodeCount < this.targetEpisodes) {
      // Run steps in tight synchronous loop
      const stepsThisBatch = this.runStepsBatch(STEPS_PER_TIME_CHECK);
      stepsSinceYield += stepsThisBatch;
      stepsSinceTraining += stepsThisBatch;
      this.perfStepCount += stepsThisBatch;
      
      // Train periodically
      if (stepsSinceTraining >= this.trainInterval) {
        await this.agent.train();
        stepsSinceTraining = 0;
      }
      
      // Check if we should yield to UI
      const now = performance.now();
      if (now - lastYieldTime >= UI_YIELD_INTERVAL_MS) {
        this.updatePerformanceMetrics(now);
        await this.yieldToUI();
        lastYieldTime = performance.now();
        stepsSinceYield = 0;
      }
    }
    
    if (this.onComplete) {
      this.onComplete(this.getStats());
    }
  }
  
  /**
   * Run a batch of steps synchronously
   */
  runStepsBatch(maxSteps) {
    let stepsRun = 0;
    
    for (let i = 0; i < maxSteps && this.isRunning; i++) {
      const episodeDone = this.runSingleStep();
      stepsRun++;
      
      if (episodeDone) {
        this.finalizeEpisode();
        
        if (this.episodeCount >= this.targetEpisodes) {
          break;
        }
        
        this.startNewEpisode();
      }
    }
    
    return stepsRun;
  }
  
  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(now) {
    const elapsed = (now - this.lastPerfTime) / 1000;
    
    if (elapsed >= 0.5) {
      this.stepsPerSecond = Math.round(this.perfStepCount / elapsed);
      this.lastPerfTime = now;
      this.perfStepCount = 0;
    }
  }
  
  /**
   * Start a new episode
   */
  startNewEpisode() {
    this.currentObservation = this.environment.reset();
    this.currentEpisodeReward = 0;
    this.currentEpisodeSteps = 0;
    this.currentEpisodeDone = false;
    this.currentEpisodeInfo = {};
  }
  
  /**
   * Run a single simulation step
   */
  runSingleStep() {
    if (this.currentEpisodeDone || this.currentEpisodeSteps >= this.stepsPerEpisode) {
      return true;
    }
    
    // Get action from agent (with exploration)
    const action = this.agent.selectAction(this.currentObservation, true);
    
    // Take step
    const result = this.environment.step(action, this.timestep);
    
    // Store experience
    this.agent.storeExperience(
      this.currentObservation,
      action,
      result.reward,
      result.observation,
      result.done
    );
    
    // Update episode state
    this.currentObservation = result.observation;
    this.currentEpisodeReward += result.reward;
    this.currentEpisodeDone = result.done;
    this.currentEpisodeInfo = result.info;
    this.currentEpisodeSteps++;
    
    return result.done;
  }
  
  /**
   * Finalize current episode
   */
  finalizeEpisode() {
    this.episodeCount++;
    this.totalReward += this.currentEpisodeReward;
    this.recentRewards.push(this.currentEpisodeReward);
    if (this.recentRewards.length > 100) {
      this.recentRewards.shift();
    }
    
    const wasSuccess = this.currentEpisodeInfo.success === true;
    const reason = this.currentEpisodeInfo.reason || 
      (this.currentEpisodeSteps >= this.stepsPerEpisode ? 'timeout' : 'unknown');
    const collisionType = this.currentEpisodeInfo.collisionType || null;
    
    if (wasSuccess) {
      this.successCount++;
    }
    
    // Report every episode for curriculum tracking
    if (this.onEpisodeEnd) {
      this.onEpisodeEnd({
        episode: this.episodeCount,
        reward: this.currentEpisodeReward,
        steps: this.currentEpisodeSteps,
        success: wasSuccess,
        reason,
        collisionType,
        curriculumLevel: this.currentEpisodeInfo.curriculumLevel,
        curriculumStage: this.currentEpisodeInfo.curriculumStage,
      });
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
    const envStats = this.environment.getStats();
    
    const simSpeedMultiplier = this.stepsPerSecond > 0 
      ? (this.stepsPerSecond / 60).toFixed(1) 
      : 0;
    
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
      stepsPerSecond: this.stepsPerSecond,
      simSpeedMultiplier,
      curriculumLevel: envStats.curriculum?.level ?? 0,
      curriculumStage: envStats.curriculum?.stageName ?? 'trivial',
      curriculumSuccesses: envStats.curriculum?.uniqueSuccesses ?? 0,
      curriculumNeeded: envStats.curriculum?.successesNeeded ?? 20,
    };
  }
  
  /**
   * Yield control to UI
   */
  yieldToUI() {
    if (this.onProgress) {
      this.onProgress(this.getStats());
    }
    
    return new Promise(resolve => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}
