/**
 * Reward Calculator for RL Environment
 * Computes rewards based on drone behavior and progress
 * 
 * Design Philosophy for Teaching Obstacle-Avoiding Navigation:
 * 
 * 1. GOAL-SEEKING (Primary):
 *    - Strong reward for reducing distance to target
 *    - Large bonus for reaching target
 *    - Penalty for increasing distance from target
 * 
 * 2. COLLISION AVOIDANCE (Critical):
 *    - Heavy penalty for collisions (terminal)
 *    - Graduated penalty for proximity to obstacles (smooth gradient)
 *    - Exponential penalty as obstacles get very close
 * 
 * 3. SPEED & EFFICIENCY:
 *    - Reward high speed (encourages efficient navigation)
 *    - Penalize staying in one place (anti-stagnation)
 *    - Small time penalty to encourage fast completion
 * 
 * 4. ALTITUDE REWARDS:
 *    - Bonus for flying low (more challenging, realistic)
 *    - Uses nadir lidar for ground awareness
 * 
 * 5. VELOCITY ALIGNMENT:
 *    - Bonus for moving towards target
 *    - Helps guide exploration in the right direction
 */

import { DRONE, RL_CONFIG } from '../../config.js';

export class RewardCalculator {
  constructor() {
    // Store reward config for easy access
    this.config = {
      // Goal rewards
      targetReached: RL_CONFIG.REWARD_TARGET_REACHED,
      distanceProgress: RL_CONFIG.REWARD_DISTANCE_PROGRESS,
      distanceRegress: RL_CONFIG.REWARD_DISTANCE_REGRESS,
      
      // Collision/safety penalties
      collision: RL_CONFIG.REWARD_COLLISION,
      obstacleProximity: RL_CONFIG.REWARD_OBSTACLE_PROXIMITY,
      obstacleDangerDistance: RL_CONFIG.OBSTACLE_DANGER_DISTANCE,
      obstacleCloseDistance: RL_CONFIG.OBSTACLE_CLOSE_DISTANCE,
      
      // Speed rewards
      highSpeed: RL_CONFIG.REWARD_HIGH_SPEED,
      stagnation: RL_CONFIG.REWARD_STAGNATION,
      velocityTowardsTarget: RL_CONFIG.REWARD_VELOCITY_TOWARDS_TARGET,
      
      // Altitude rewards
      lowAltitude: RL_CONFIG.REWARD_LOW_ALTITUDE,
      goodAltitude: RL_CONFIG.REWARD_GOOD_ALTITUDE,
      
      // Time penalty
      timePenalty: RL_CONFIG.REWARD_TIME_PENALTY,
    };
    
    // Track previous positions for stagnation detection
    this.positionHistory = [];
    this.historyMaxLength = 30; // Track last 30 steps (~0.5 seconds at 60fps)
  }
  
  /**
   * Calculate reward for current step
   * @param {Object} params - Reward calculation parameters
   * @param {number} params.prevDistance - Previous distance to target
   * @param {number} params.currentDistance - Current distance to target
   * @param {number} params.targetRadius - Radius to consider target reached
   * @param {boolean} params.hadCollision - Whether collision occurred
   * @param {number} params.minLidarDist - Minimum lidar distance (obstacle proximity)
   * @param {number} params.nadirDistance - Distance to ground (nadir lidar ray)
   * @param {Object} params.droneState - Drone state { x, y, z, vx, vy, vz }
   * @param {Object} params.targetDirWorld - Target direction in world coords { x, y, z }
   * @param {number} params.terrainHeight - Terrain height at drone position
   * @returns {Object} - { reward, breakdown }
   */
  calculate(params) {
    const {
      prevDistance,
      currentDistance,
      targetRadius,
      hadCollision,
      minLidarDist,
      nadirDistance,
      droneState,
      targetDirWorld,
      terrainHeight,
    } = params;
    
    let reward = 0;
    const breakdown = {};
    
    // =====================================================
    // 1. COLLISION PENALTY (Highest priority - terminal)
    // =====================================================
    if (hadCollision) {
      reward += this.config.collision;
      breakdown.collision = this.config.collision;
      // Return early - collision is terminal, other rewards don't matter
      return { reward, breakdown };
    }
    
    // =====================================================
    // 2. DISTANCE PROGRESS (Primary shaping reward)
    // =====================================================
    const distanceProgress = prevDistance - currentDistance;
    
    if (distanceProgress > 0) {
      // Reward for getting closer to target
      const progressReward = distanceProgress * this.config.distanceProgress;
      reward += progressReward;
      breakdown.progress = progressReward;
    } else if (distanceProgress < 0) {
      // Penalty for moving away from target (stronger than progress reward)
      const regressPenalty = distanceProgress * this.config.distanceRegress;
      reward += regressPenalty;
      breakdown.regress = regressPenalty;
    }
    
    // =====================================================
    // 3. TARGET REACHED BONUS
    // =====================================================
    if (currentDistance < targetRadius) {
      reward += this.config.targetReached;
      breakdown.targetReached = this.config.targetReached;
    }
    
    // =====================================================
    // 4. OBSTACLE PROXIMITY PENALTY (Graduated)
    // =====================================================
    // Use exponential penalty that increases dramatically as obstacles get closer
    if (minLidarDist < this.config.obstacleDangerDistance) {
      // Normalized proximity (1 = touching, 0 = at danger distance)
      const normalizedProximity = 1 - (minLidarDist / this.config.obstacleDangerDistance);
      
      // Exponential scaling for closer obstacles
      let proximityPenalty;
      if (minLidarDist < this.config.obstacleCloseDistance) {
        // Very close - exponential penalty
        const closeProximity = 1 - (minLidarDist / this.config.obstacleCloseDistance);
        proximityPenalty = this.config.obstacleProximity * (1 + closeProximity * closeProximity * 3);
      } else {
        // Moderate distance - linear penalty
        proximityPenalty = normalizedProximity * this.config.obstacleProximity;
      }
      
      reward += proximityPenalty;
      breakdown.proximity = proximityPenalty;
    }
    
    // =====================================================
    // 5. SPEED REWARDS
    // =====================================================
    const speed = Math.sqrt(
      droneState.vx ** 2 + droneState.vy ** 2 + droneState.vz ** 2
    );
    const normalizedSpeed = speed / DRONE.MAX_SPEED;
    
    // Reward for high speed (encourages efficient navigation)
    if (normalizedSpeed > 0.3) {
      const speedBonus = normalizedSpeed * this.config.highSpeed;
      reward += speedBonus;
      breakdown.speed = speedBonus;
    }
    
    // =====================================================
    // 6. STAGNATION PENALTY (Anti-hovering)
    // =====================================================
    // Track position history
    this.positionHistory.push({
      x: droneState.x,
      y: droneState.y,
      z: droneState.z,
    });
    
    if (this.positionHistory.length > this.historyMaxLength) {
      this.positionHistory.shift();
    }
    
    // Check if drone has moved significantly over recent history
    if (this.positionHistory.length >= this.historyMaxLength) {
      const oldPos = this.positionHistory[0];
      const displacement = Math.sqrt(
        (droneState.x - oldPos.x) ** 2 +
        (droneState.y - oldPos.y) ** 2 +
        (droneState.z - oldPos.z) ** 2
      );
      
      // If displacement over 30 frames is less than 1 meter, penalize
      const minExpectedDisplacement = 1.0;
      if (displacement < minExpectedDisplacement) {
        const stagnationFactor = 1 - (displacement / minExpectedDisplacement);
        const stagnationPenalty = stagnationFactor * this.config.stagnation;
        reward += stagnationPenalty;
        breakdown.stagnation = stagnationPenalty;
      }
    }
    
    // =====================================================
    // 7. VELOCITY TOWARDS TARGET BONUS
    // =====================================================
    const velTowardsTarget = 
      droneState.vx * targetDirWorld.x + 
      droneState.vy * targetDirWorld.y + 
      droneState.vz * targetDirWorld.z;
    
    if (velTowardsTarget > 0.5) {
      const velocityBonus = (velTowardsTarget / DRONE.MAX_SPEED) * this.config.velocityTowardsTarget;
      reward += velocityBonus;
      breakdown.velocity = velocityBonus;
    } else if (velTowardsTarget < -0.5) {
      // Penalty for moving away from target
      const velocityPenalty = (velTowardsTarget / DRONE.MAX_SPEED) * this.config.velocityTowardsTarget * 0.5;
      reward += velocityPenalty;
      breakdown.velocity = velocityPenalty;
    }
    
    // =====================================================
    // 8. LOW ALTITUDE BONUS (Using nadir lidar)
    // =====================================================
    // Reward flying low to the ground (more challenging, realistic)
    // nadirDistance is the distance to ground from lidar
    const effectiveAltitude = nadirDistance !== undefined ? nadirDistance : (droneState.y - terrainHeight);
    
    if (effectiveAltitude > 1.5 && effectiveAltitude < 4) {
      // Sweet spot: 1.5-4 meters above ground - maximum bonus
      reward += this.config.lowAltitude;
      breakdown.lowAltitude = this.config.lowAltitude;
    } else if (effectiveAltitude >= 4 && effectiveAltitude < 8) {
      // Good altitude: 4-8 meters - smaller bonus
      reward += this.config.goodAltitude;
      breakdown.altitude = this.config.goodAltitude;
    }
    // No bonus for flying too high (>8m) or too low (<1.5m)
    
    // =====================================================
    // 9. TIME PENALTY (Encourages efficiency)
    // =====================================================
    reward += this.config.timePenalty;
    breakdown.time = this.config.timePenalty;
    
    return { reward, breakdown };
  }
  
  /**
   * Reset position history (call on episode reset)
   */
  reset() {
    this.positionHistory = [];
  }
  
  /**
   * Get reward configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }
}

