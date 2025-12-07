/**
 * Training Manager for Hybrid RL Agent
 * 
 * The agent uses: final_action = base_action + correction
 * Where base_action = observation (go towards target)
 * 
 * We train the correction network to improve rewards:
 * - Positive reward: the correction was helpful (or at least not harmful)
 * - Negative reward: the correction made things worse
 * 
 * Training target: 
 * - Good outcome → reinforce current correction
 * - Bad outcome → reduce correction magnitude (let base action dominate)
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
   * The correction is: action - observation (since action = obs + correction)
   * 
   * Strategy:
   * - Good reward (>0): The correction was helpful, keep it
   * - Bad reward (<0): The correction was harmful, target = zero (let base action work)
   */
  async trainPolicyNetwork(observations, actions, rewards) {
    const trainObs = [];
    const trainTargets = [];
    
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      const action = actions[i];
      const reward = rewards[i];
      
      // Compute what correction was applied
      // action = 0.8 * obs + 0.2 * correction
      // So: correction = (action - 0.8 * obs) / 0.2
      const baseWeight = 0.8;
      const correction = obs.map((o, j) => (action[j] - baseWeight * o) / (1 - baseWeight));
      
      trainObs.push(obs);
      
      if (reward > 0.01) {
        // Good outcome - keep the correction that worked
        trainTargets.push(correction);
      } else if (reward < -0.01) {
        // Bad outcome - target zero correction (trust base action)
        trainTargets.push([0, 0, 0]);
      } else {
        // Neutral - small correction towards zero
        trainTargets.push(correction.map(c => c * 0.5));
      }
    }
    
    if (trainObs.length === 0) {
      return 0;
    }
    
    // Debug logging
    if (this.trainingStep % 10 === 0) {
      const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
      const posCount = rewards.filter(r => r > 0.01).length;
      const negCount = rewards.filter(r => r < -0.01).length;
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
