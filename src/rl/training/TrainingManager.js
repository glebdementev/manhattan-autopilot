/**
 * Training Manager for Residual Policy RL Agent
 * 
 * The agent uses: final_action = base_action + correction
 * Where base_action = observation[0:3] (target direction)
 * 
 * We train the correction network:
 * - Positive reward: correction was helpful, reinforce it
 * - Negative reward: correction was harmful, target = zero (trust base)
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
      const policyLoss = await this.trainPolicyNetwork(observations, actions, rewards);
      
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
   * correction = action - base
   * 
   * Strategy:
   * - Good reward: reinforce the correction that worked
   * - Bad reward: target = zero correction (let base action work)
   * - Very close obstacle: learn to steer away
   */
  async trainPolicyNetwork(observations, actions, rewards) {
    const trainObs = [];
    const trainTargets = [];
    
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      const action = actions[i];
      const reward = rewards[i];
      
      // Base action = target direction (first 3 elements)
      const baseAction = [obs[0], obs[1], obs[2]];
      
      // Correction that was applied: action = base + correction
      const correction = [
        action[0] - baseAction[0],
        action[1] - baseAction[1],
        action[2] - baseAction[2],
      ];
      
      // Check if any obstacle is very close (< 0.2 normalized = 5m)
      const obsDists = obs.slice(3, 7);
      const minObsDist = Math.min(...obsDists);
      const nadir = obs[7];
      const zenith = obs[8];
      
      trainObs.push(obs);
      
      if (reward > 0.1) {
        // Good outcome - reinforce the correction
        trainTargets.push(correction);
      } else if (reward < -0.1 || minObsDist < 0.15 || nadir < 0.1 || zenith < 0.1) {
        // Bad outcome OR very close to obstacle
        // Target = zero correction (trust base action)
        // This teaches: when in doubt, go straight to target
        trainTargets.push([0, 0, 0]);
      } else {
        // Neutral - small decay towards zero
        trainTargets.push(correction.map(c => c * 0.5));
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
