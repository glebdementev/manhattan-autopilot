/**
 * Reward Display - Shows live reward breakdown and observation values
 * 
 * Displays the same rewards/penalties and observations that an RL model sees
 */

/**
 * Update reward breakdown display
 * @param {Object} elements - UI element references
 * @param {Object} breakdown - Reward breakdown from RewardCalculator
 * @param {number} totalReward - Total reward for this step
 */
export function updateRewardBreakdown(elements, breakdown, totalReward) {
  if (!elements.rewardSection) return;
  
  // Progress reward
  if (elements.rewardProgress) {
    const progress = breakdown.progress || 0;
    elements.rewardProgress.textContent = formatReward(progress);
    elements.rewardProgress.className = getRewardClass(progress);
  }
  
  // Proximity penalty
  if (elements.rewardProximity) {
    const proximity = breakdown.proximity || 0;
    elements.rewardProximity.textContent = formatReward(proximity);
    elements.rewardProximity.className = getRewardClass(proximity);
  }
  
  // Time penalty
  if (elements.rewardTime) {
    const time = breakdown.time || 0;
    elements.rewardTime.textContent = formatReward(time);
    elements.rewardTime.className = getRewardClass(time);
  }
  
  // Total reward
  if (elements.rewardTotal) {
    elements.rewardTotal.textContent = formatReward(totalReward);
    elements.rewardTotal.className = getRewardClass(totalReward);
  }
  
  // Terminal rewards (collision/success) - show if present
  if (elements.rewardTerminal) {
    if (breakdown.collision !== undefined) {
      elements.rewardTerminal.textContent = formatReward(breakdown.collision);
      elements.rewardTerminal.className = 'reward-negative';
      elements.rewardTerminalRow.style.display = 'flex';
      elements.rewardTerminalLabel.textContent = 'Collision:';
    } else if (breakdown.targetReached !== undefined) {
      elements.rewardTerminal.textContent = formatReward(breakdown.targetReached);
      elements.rewardTerminal.className = 'reward-positive';
      elements.rewardTerminalRow.style.display = 'flex';
      elements.rewardTerminalLabel.textContent = 'Target:';
    } else {
      elements.rewardTerminalRow.style.display = 'none';
    }
  }
}

/**
 * Update episode cumulative stats
 * @param {Object} elements - UI element references
 * @param {number} episodeReward - Total reward for current episode
 * @param {number} episodeSteps - Steps taken in current episode
 */
export function updateEpisodeStats(elements, episodeReward, episodeSteps) {
  if (elements.episodeTotalReward) {
    elements.episodeTotalReward.textContent = episodeReward.toFixed(1);
    elements.episodeTotalReward.className = getRewardClass(episodeReward);
  }
  
  if (elements.episodeStepCount) {
    elements.episodeStepCount.textContent = episodeSteps;
  }
}

/**
 * Update observation display - shows what the model sees
 * @param {Object} elements - UI element references
 * @param {Object} obsData - Observation data
 */
export function updateObservationDisplay(elements, obsData) {
  // Target info
  if (elements.obsTargetDist) {
    elements.obsTargetDist.textContent = obsData.distToTarget.toFixed(1);
  }
  
  if (elements.obsTargetDir) {
    const dir = obsData.targetDir;
    elements.obsTargetDir.textContent = `(${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)})`;
  }
  
  if (elements.obsTargetVisible) {
    elements.obsTargetVisible.textContent = obsData.canSeeTarget ? 'Yes' : 'No';
    elements.obsTargetVisible.className = obsData.canSeeTarget ? 'obs-value obs-good' : 'obs-value obs-bad';
  }
  
  // Min obstacle distance (from 64 rays)
  if (elements.obsObstacle1) {
    const minDist = obsData.minObstacleDist;
    if (minDist < obsData.maxRange) {
      elements.obsObstacle1.textContent = `${minDist.toFixed(1)}m`;
      elements.obsObstacle1.className = getDistanceClass(minDist);
    } else {
      elements.obsObstacle1.textContent = '∞ (clear)';
      elements.obsObstacle1.className = 'obs-value obs-good';
    }
  }
  
  // Hide unused obstacle slots
  if (elements.obsObstacle2) elements.obsObstacle2.parentElement.style.display = 'none';
  if (elements.obsObstacle3) elements.obsObstacle3.parentElement.style.display = 'none';
  if (elements.obsObstacle4) elements.obsObstacle4.parentElement.style.display = 'none';
  
  // Nadir
  if (elements.obsNadir) {
    const nadir = obsData.nadirDist;
    elements.obsNadir.textContent = nadir < obsData.maxRange ? nadir.toFixed(1) : '∞';
    elements.obsNadir.className = getDistanceClass(nadir);
  }
  
  // Hide zenith (not used anymore)
  if (elements.obsZenith) {
    elements.obsZenith.parentElement.style.display = 'none';
  }
  
  // Velocity (world)
  if (elements.obsVelForward && obsData.velocity) {
    elements.obsVelForward.textContent = obsData.velocity.vx.toFixed(1);
  }
  if (elements.obsVelRight && obsData.velocity) {
    elements.obsVelRight.textContent = obsData.velocity.vy.toFixed(1);
  }
  if (elements.obsVelUp && obsData.velocity) {
    elements.obsVelUp.textContent = obsData.velocity.vz.toFixed(1);
  }
}

/**
 * Get CSS class based on distance (for danger coloring)
 */
function getDistanceClass(distance) {
  if (distance < 1.0) return 'obs-value obs-danger';
  if (distance < 2.0) return 'obs-value obs-warning';
  if (distance < 5.0) return 'obs-value obs-caution';
  return 'obs-value obs-good';
}

/**
 * Format reward value with sign
 */
function formatReward(value) {
  if (value >= 0) {
    return `+${value.toFixed(3)}`;
  }
  return value.toFixed(3);
}

/**
 * Get CSS class based on reward value
 */
function getRewardClass(value) {
  if (value > 0.001) return 'reward-positive';
  if (value < -0.001) return 'reward-negative';
  return 'reward-neutral';
}

/**
 * Update model action display
 * @param {Object} elements - UI element references
 * @param {Array} action - Action array [forward, right, up]
 * @param {boolean} visible - Whether to show the action section
 */
export function updateModelAction(elements, action, visible) {
  if (elements.actionSection) {
    elements.actionSection.style.display = visible ? 'block' : 'none';
  }
  
  if (!visible || !action) return;
  
  if (elements.actionForward) {
    elements.actionForward.textContent = action[0].toFixed(2);
    elements.actionForward.className = getActionClass(action[0]);
  }
  if (elements.actionRight) {
    elements.actionRight.textContent = action[1].toFixed(2);
    elements.actionRight.className = getActionClass(action[1]);
  }
  if (elements.actionUp) {
    elements.actionUp.textContent = action[2].toFixed(2);
    elements.actionUp.className = getActionClass(action[2]);
  }
}

/**
 * Get CSS class for action value
 */
function getActionClass(value) {
  if (value > 0.3) return 'obs-value action-positive';
  if (value < -0.3) return 'obs-value action-negative';
  return 'obs-value';
}
