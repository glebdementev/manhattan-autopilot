/**
 * Stats Display - Updates UI statistics displays
 */

/**
 * Update drone stats in the UI
 * @param {Object} elements - UI element references
 * @param {number} speed - Current speed
 * @param {number} altitude - Current altitude
 * @param {number} distToTarget - Distance to target
 */
export function updateDroneStats(elements, speed, altitude, distToTarget) {
  elements.speedValue.textContent = speed.toFixed(1);
  elements.altitudeValue.textContent = altitude.toFixed(1);
  elements.targetDistValue.textContent = Math.round(distToTarget);
}

/**
 * Update RL training stats in the UI
 * @param {Object} elements - UI element references
 * @param {Object} stats - RL stats object
 */
export function updateRLStats(elements, stats) {
  elements.episodeCount.textContent = stats.totalEpisodes;
  elements.successRate.textContent = `${(stats.successRate * 100).toFixed(1)}%`;
  elements.avgReward.textContent = stats.avgRecentReward.toFixed(1);
  elements.episodeStep.textContent = stats.currentEpisodeSteps;
  elements.episodeReward.textContent = stats.currentEpisodeReward.toFixed(1);
  
  // Color success rate based on performance
  const successEl = elements.successRate;
  if (stats.successRate > 0.7) {
    successEl.style.color = '#00ff88';
  } else if (stats.successRate > 0.3) {
    successEl.style.color = '#ffaa00';
  } else {
    successEl.style.color = '#ff4444';
  }
}

/**
 * Update agent stats in the UI
 * @param {Object} elements - UI element references
 * @param {Object} stats - Agent stats object
 */
export function updateAgentStats(elements, stats) {
  elements.explorationRate.textContent = `${(stats.explorationRate * 100).toFixed(1)}%`;
  elements.bufferSize.textContent = stats.bufferSize;
}

/**
 * Update navigation status in the UI
 * @param {Object} elements - UI element references
 * @param {number} distToTarget - Distance to target
 * @param {string} status - Navigation status text
 */
export function updateNavigation(elements, distToTarget, status) {
  elements.targetDistValue.textContent = Math.round(distToTarget);
  elements.navStatus.textContent = status;
}

/**
 * Set training status message
 * @param {Object} elements - UI element references
 * @param {string} message - Status message
 */
export function setTrainingStatus(elements, message) {
  elements.trainingStatus.textContent = message;
}

/**
 * Update model status display
 * @param {Object} elements - UI element references
 * @param {string} status - Model status text
 */
export function setModelStatus(elements, status) {
  if (elements.modelStatus) {
    elements.modelStatus.textContent = status;
    // Color based on status
    if (status === 'Ready' || status === 'Trained') {
      elements.modelStatus.style.color = '#00ff88';
    } else if (status === 'Training...') {
      elements.modelStatus.style.color = '#ffaa00';
    } else {
      elements.modelStatus.style.color = '#888';
    }
  }
}

/**
 * Show reward indicator popup
 * @param {Object} elements - UI element references
 * @param {number} reward - Reward value to display
 */
export function showRewardIndicator(elements, reward) {
  const indicator = elements.rewardIndicator;
  indicator.textContent = reward >= 0 ? `+${reward.toFixed(1)}` : reward.toFixed(1);
  indicator.className = reward >= 0 ? 'positive' : 'negative';
  indicator.classList.add('visible');
  
  setTimeout(() => {
    indicator.classList.remove('visible');
  }, 500);
}

