/**
 * Training Manager for Residual Policy RL Agent
 * 
 * The agent uses: final_action = base_action + correction
 * Where base_action = observation[0:3] (target direction)
 * 
 * We train the correction network using returns:
 * - High return: correction was helpful (long-term), reinforce it
 * - Low return: gently decay correction towards zero (trust base more)
 * 
 * Observation layout (see ObservationBuilder):
 * - [0-2]  Target direction (X, Y, Z)
 * - [3-5]  Current velocity (vx, vy, vz)
 * - [6-21] 16 lidar ray distances (normalized 0-1)
 * - [22]   Nadir distance (normalized)
 * - [23]   Zenith distance (normalized)
 * - [24]   Target distance (normalized)
 */

import * as tf from '@tensorflow/tfjs';
import { ExperienceBuffer } from './ExperienceBuffer.js';

export class TrainingManager {
  constructor(policyNetwork, valueNetwork) {
    this.policyNetwork = policyNetwork;
    this.valueNetwork = valueNetwork;
    
    this.experienceBuffer = new ExperienceBuffer(2000);
    
    this.isTraining = false;
    this.trainingStep = 0;
    
    this.history = {
      policyLoss: [],
      valueLoss: [],
      avgReward: [],
      successRate: [],
    };
    
    this.gamma = 0.99;
    this.minBufferSize = 64;
  }
  
  storeExperience(observation, action, reward, nextObservation, done) {
    this.experienceBuffer.store(observation, action, reward, nextObservation, done);
  }
  
  async train() {
    if (this.experienceBuffer.size < this.minBufferSize) {
      return null;
    }
    
    this.isTraining = true;
    
    try {
      const batchSize = Math.min(64, this.experienceBuffer.size);
      const batch = this.experienceBuffer.getRecent(batchSize);
      
      const observations = batch.map(e => e.observation);
      const actions = batch.map(e => e.action);
      const rewards = batch.map(e => e.reward);
      const dones = batch.map(e => e.done ? 1 : 0);
      
      const returns = this.computeReturns(rewards, dones);
      const valueLoss = await this.trainValueNetwork(observations, returns);
      const policyLoss = await this.trainPolicyNetwork(observations, actions, rewards, returns);
      
      this.trainingStep++;
      
      this.history.policyLoss.push(policyLoss);
      this.history.valueLoss.push(valueLoss);
      
      return { policyLoss, valueLoss };
    } finally {
      this.isTraining = false;
    }
  }
  
  computeReturns(rewards, dones) {
    const returns = new Array(rewards.length);
    let runningReturn = 0;
    
    for (let i = rewards.length - 1; i >= 0; i--) {
      if (dones[i]) {
        runningReturn = rewards[i];
      } else {
        runningReturn = rewards[i] + this.gamma * runningReturn;
      }
      returns[i] = runningReturn;
    }
    
    return returns;
  }
  
  async trainValueNetwork(observations, returns) {
    const obsTensor = tf.tensor2d(observations);
    const returnsTensor = tf.tensor2d(returns.map(r => [r]));
    
    const loss = await this.valueNetwork.fit(obsTensor, returnsTensor);
    
    obsTensor.dispose();
    returnsTensor.dispose();
    
    return loss;
  }
  
  /**
   * Train correction network
   * 
   * observation[0:3] = base action (target direction)
   * correction       = action - base
   * 
   * Strategy (simple return-weighted regression):
   * - Above-average return: reinforce the correction that worked
   * - Below-average return: gently decay correction towards zero (regularisation)
   * 
   * NOTE: We DO NOT zero-out corrections just because an obstacle
   *       is close — that would teach the agent to "do nothing"
   *       exactly when avoidance is needed. Proximity is only
   *       used as a soft signal, not a hard override.
   */
  async trainPolicyNetwork(observations, actions, rewards, returns) {
    const trainObs = [];
    const trainTargets = [];

    // Compute a simple baseline from returns to decide what is
    // "better than average" behaviour in this batch.
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      const action = actions[i];
      const reward = rewards[i]; // kept for logging only
      const G = returns[i];
      
      // Base action = target direction (first 3 elements)
      const baseAction = [obs[0], obs[1], obs[2]];
      
      // Correction that was applied: action = base + correction
      const correction = [
        action[0] - baseAction[0],
        action[1] - baseAction[1],
        action[2] - baseAction[2],
      ];
      
      // Lidar / proximity information from observation
      // 16 forward rays: [6..21], nadir: [22], zenith: [23]
      const lidarDists = obs.slice(6, 22);
      const minObsDist = Math.min(...lidarDists);
      const nadir = obs[22];
      const zenith = obs[23];

      const isVeryCloseObstacle =
        minObsDist < 0.15 || // < ~15% of lidar range
        nadir < 0.08 ||      // very close to ground
        zenith < 0.08;       // very close to canopy/ceiling
      
      trainObs.push(obs);

      // Advantage-like signal: how much better than batch baseline.
      const advantage = G - meanReturn;

      if (advantage > 0) {
        // Above-average long-term outcome - reinforce the correction
        trainTargets.push(correction);
      } else {
        // Below-average outcome - gentle regularisation towards zero.
        // If we are in a very close-proximity state, decay a bit faster
        // so the network doesn't learn to "like" being stuck near obstacles.
        const decay = isVeryCloseObstacle ? 0.4 : 0.7;
        trainTargets.push(correction.map(c => c * decay));
      }
    }
    
    if (trainObs.length === 0) {
      return 0;
    }
    
    // Debug logging
    if (this.trainingStep % 10 === 0) {
      const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
      const posCount = rewards.filter(r => r > 0.1).length;
      const negCount = rewards.filter(r => r < -0.1).length;
      console.log(`[TRAIN] step=${this.trainingStep} avgR=${avgReward.toFixed(3)} pos=${posCount} neg=${negCount}`);
    }
    
    const obsTensor = tf.tensor2d(trainObs);
    const targetTensor = tf.tensor2d(trainTargets);
    
    const loss = await this.policyNetwork.fit(obsTensor, targetTensor);
    
    obsTensor.dispose();
    targetTensor.dispose();
    
    return loss;
  }
  
  clearBuffer() {
    this.experienceBuffer.clear();
  }
  
  getStats() {
    const recentPolicyLoss = this.history.policyLoss.slice(-50);
    const recentValueLoss = this.history.valueLoss.slice(-50);
    
    return {
      trainingStep: this.trainingStep,
      bufferSize: this.experienceBuffer.size,
      avgPolicyLoss: recentPolicyLoss.length > 0
        ? recentPolicyLoss.reduce((a, b) => a + b, 0) / recentPolicyLoss.length
        : 0,
      avgValueLoss: recentValueLoss.length > 0
        ? recentValueLoss.reduce((a, b) => a + b, 0) / recentValueLoss.length
        : 0,
    };
  }
  
  getHistory() {
    return { ...this.history };
  }
  
  setHistory(history) {
    this.history = { ...history };
  }
  
  setTrainingStep(step) {
    this.trainingStep = step;
  }
}
