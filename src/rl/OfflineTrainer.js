/**
 * Offline Trainer - Runs RL training without rendering
 * 
 * Simulates episodes in a headless environment for fast training.
 * Uses EXACT same physics timestep as visible simulation for consistency.
 * Runs as fast as CPU allows (no real-time waiting).
 * 
 * OPTIMIZED for maximum throughput:
 * - Batched training (less frequent, larger batches)
 * - Minimal async overhead
 * - Efficient UI yielding
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
    
    // Training config - MATCHES visible simulation exactly
    this.targetEpisodes = 1000;
    this.stepsPerEpisode = RL_CONFIG.MAX_EPISODE_STEPS;
    // Use EXACT same timestep as visible simulation
    this.timestep = SIMULATION.TIMESTEP;
    
    // OPTIMIZED: Train less frequently but with larger impact
    // Training every 10 steps is expensive - do it every 50-100 steps
    this.trainInterval = 100;
    
    // Performance tracking
    this.stepsPerSecond = 0;
    this.lastPerfTime = 0;
    this.perfStepCount = 0;
    this.totalStepsThisSecond = 0;
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
    this.currentEpisodeDone = true; // Will trigger startNewEpisode
    this.currentEpisodeInfo = {};
    
    console.log(`Starting offline training for ${targetEpisodes} episodes...`);
    console.log(`Training interval: every ${this.trainInterval} steps`);
    
    // Suppress verbose logging during training for performance
    this.suppressLogging();
    
    // Start first episode
    this.startNewEpisode();
    
    // Run training loop
    await this.runTrainingLoop();
    
    // Restore logging
    this.restoreLogging();
  }
  
  /**
   * Suppress console.log during training for performance
   */
  suppressLogging() {
    this._originalConsoleLog = console.log;
    console.log = (...args) => {
      // Only allow important messages through
      const msg = args[0]?.toString() || '';
      if (msg.includes('Training') || msg.includes('Episode') || msg.includes('Model')) {
        this._originalConsoleLog.apply(console, args);
      }
      // Suppress [PERF] logs
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
   * OPTIMIZED: Runs synchronous steps in tight loop, yields only for UI
   */
  async runTrainingLoop() {
    // Yield to UI every N milliseconds (keeps UI responsive)
    const UI_YIELD_INTERVAL_MS = 100; // Less frequent yields = more throughput
    // Steps to run before checking time (avoid performance.now() overhead)
    const STEPS_PER_TIME_CHECK = 50;
    
    this.lastPerfTime = performance.now();
    this.perfStepCount = 0;
    this.totalStepsThisSecond = 0;
    
    let stepsSinceYield = 0;
    let lastYieldTime = performance.now();
    let stepsSinceTraining = 0;
    
    while (this.isRunning && this.episodeCount < this.targetEpisodes) {
      // Run steps in tight synchronous loop
      const stepsThisBatch = this.runStepsBatch(STEPS_PER_TIME_CHECK);
      stepsSinceYield += stepsThisBatch;
      stepsSinceTraining += stepsThisBatch;
      this.perfStepCount += stepsThisBatch;
      
      // Train periodically (async operation)
      if (stepsSinceTraining >= this.trainInterval) {
        await this.agent.train();
        stepsSinceTraining = 0;
      }
      
      // Check if we should yield to UI
      const now = performance.now();
      if (now - lastYieldTime >= UI_YIELD_INTERVAL_MS) {
        // Update performance metrics
        this.updatePerformanceMetrics(now);
        
        // Yield to UI
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
   * Run a batch of steps synchronously (no await overhead)
   * Returns number of steps actually run
   */
  runStepsBatch(maxSteps) {
    let stepsRun = 0;
    
    for (let i = 0; i < maxSteps && this.isRunning; i++) {
      const episodeDone = this.runSingleStep();
      stepsRun++;
      
      if (episodeDone) {
        this.finalizeEpisode();
        
        // Check if we've hit target
        if (this.episodeCount >= this.targetEpisodes) {
          break;
        }
        
        // Start new episode
        this.startNewEpisode();
      }
    }
    
    return stepsRun;
  }
  
  /**
   * Update steps/second performance metric
   */
  updatePerformanceMetrics(now) {
    const elapsed = (now - this.lastPerfTime) / 1000;
    
    if (elapsed >= 0.5) { // Update every 0.5 seconds for smoother display
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
   * Run a single simulation step (synchronous, no await)
   * Returns true if episode is done
   */
  runSingleStep() {
    if (this.currentEpisodeDone || this.currentEpisodeSteps >= this.stepsPerEpisode) {
      return true;
    }
    
    // Get action from agent (with exploration)
    const action = this.agent.selectAction(this.currentObservation, true);
    
    // Take step with EXACT same timestep as visible simulation
    const result = this.environment.step(action, this.timestep);
    
    // Store experience (synchronous)
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
   * Finalize current episode and record stats
   */
  finalizeEpisode() {
    this.episodeCount++;
    this.totalReward += this.currentEpisodeReward;
    this.recentRewards.push(this.currentEpisodeReward);
    if (this.recentRewards.length > 100) {
      this.recentRewards.shift();
    }
    
    // Determine episode outcome
    const wasSuccess = this.currentEpisodeInfo.success === true;
    const reason = this.currentEpisodeInfo.reason || 
      (this.currentEpisodeSteps >= this.stepsPerEpisode ? 'timeout' : 'unknown');
    const collisionType = this.currentEpisodeInfo.collisionType || null;
    
    if (wasSuccess) {
      this.successCount++;
    }
    
    // Callbacks (only call onEpisodeEnd occasionally to reduce overhead)
    if (this.onEpisodeEnd && this.episodeCount % 10 === 0) {
      this.onEpisodeEnd({
        episode: this.episodeCount,
        reward: this.currentEpisodeReward,
        steps: this.currentEpisodeSteps,
        success: wasSuccess,
        reason,
        collisionType,
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
    
    // Calculate simulation speed multiplier
    // stepsPerSecond / 60 = how many times faster than real-time
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
    };
  }
  
  /**
   * Yield control to UI and update progress
   */
  yieldToUI() {
    // Update progress callback
    if (this.onProgress) {
      this.onProgress(this.getStats());
    }
    
    // Use requestAnimationFrame for smoother UI updates
    return new Promise(resolve => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}

