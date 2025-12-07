/**
 * Termination Checker for RL Environment
 * Determines when episodes should end
 */

import { RL_CONFIG } from '../../config.js';

export class TerminationChecker {
  constructor(maxEpisodeSteps = RL_CONFIG.MAX_EPISODE_STEPS) {
    this.maxEpisodeSteps = maxEpisodeSteps;
  }
  
  /**
   * Check if episode should terminate
   * @param {Object} params - Termination check parameters
   * @param {number} params.distToTarget - Distance to target
   * @param {number} params.targetRadius - Target reach radius
   * @param {boolean} params.hadCollision - Whether collision occurred
   * @param {string} [params.collisionType] - Type of collision (trunk, canopy, ground, etc.)
   * @param {number} params.episodeSteps - Current episode step count
   * @param {Object} params.droneState - Drone state { x, y, z }
   * @param {number} params.worldHalfSize - Half of world size (for bounds check)
   * @returns {Object} - { done, info }
   */
  check(params) {
    const {
      distToTarget,
      targetRadius,
      hadCollision,
      collisionType,
      episodeSteps,
      droneState,
      worldHalfSize,
    } = params;
    
    // Success: reached target
    if (distToTarget < targetRadius) {
      return {
        done: true,
        info: { success: true, reason: 'target_reached' },
      };
    }
    
    // Failure: collision
    if (hadCollision) {
      return {
        done: true,
        info: { success: false, reason: 'collision', collisionType },
      };
    }
    
    // Failure: max steps exceeded
    if (episodeSteps >= this.maxEpisodeSteps) {
      return {
        done: true,
        info: { success: false, reason: 'timeout' },
      };
    }
    
    // Failure: out of bounds
    if (Math.abs(droneState.x) > worldHalfSize || Math.abs(droneState.z) > worldHalfSize) {
      return {
        done: true,
        info: { success: false, reason: 'out_of_bounds' },
      };
    }
    
    // Continue episode
    return {
      done: false,
      info: {},
    };
  }
  
  /**
   * Set max episode steps
   * @param {number} steps
   */
  setMaxSteps(steps) {
    this.maxEpisodeSteps = steps;
  }
  
  /**
   * Get max episode steps
   * @returns {number}
   */
  getMaxSteps() {
    return this.maxEpisodeSteps;
  }
}

