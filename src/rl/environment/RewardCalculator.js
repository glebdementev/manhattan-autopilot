/**
 * Reward Calculator for RL Environment
 * Computes rewards based on drone behavior and progress
 * 
 * Design Philosophy for Teaching Obstacle-Avoiding Navigation:
 * 
 * 1. COLLISION AVOIDANCE (HIGHEST PRIORITY - CRITICAL):
 *    - CATASTROPHIC penalty for collisions - agent must learn to NEVER collide
 *    - EXTREME graduated penalty for proximity - agent must HATE being near obstacles
 *    - Uses multiple lidar rays to create a "force field" of fear around obstacles
 *    - Exponential penalty scaling - the closer, the worse
 * 
 * 2. GOAL-SEEKING (Primary):
 *    - Strong reward for reducing distance to target
 *    - Large bonus for reaching target
 *    - Penalty for increasing distance from target
 * 
 * 3. ALTITUDE CONTROL (Important):
 *    - Bonus for flying low (more challenging, realistic)
 *    - STRONG penalty for flying too high
 *    - Uses nadir lidar for ground awareness
 * 
 * 4. SPEED & EFFICIENCY:
 *    - Reward high speed (encourages efficient navigation)
 *    - Penalize staying in one place (anti-stagnation)
 *    - Small time penalty to encourage fast completion
 * 
 * 5. VELOCITY ALIGNMENT:
 *    - Bonus for moving towards target
 *    - Helps guide exploration in the right direction
 */

import { DRONE, RL_CONFIG } from '../../config.js';

export class RewardCalculator {
  constructor() {
    // Store reward config for easy access
    // REBALANCED REWARDS: Prioritizing target seeking and obstacle avoidance
    this.config = {
      // Goal rewards (Primary Goal #1: Move to target)
      targetReached: 500,           // Massive bonus for success
      distanceProgress: 10.0,       // Strong reward for getting closer
      distanceRegress: 15.0,        // Strong penalty for moving away
      
      // Collision/safety penalties (Primary Goal #2: Safety)
      collision: -1000,             // Terminal penalty
      obstacleProximity: -5.0,      // Strong "force field"
      obstacleVeryClose: -30.0,     // Extreme proximity penalty
      obstacleDangerDistance: RL_CONFIG.OBSTACLE_DANGER_DISTANCE,
      obstacleCloseDistance: RL_CONFIG.OBSTACLE_CLOSE_DISTANCE,
      obstacleCriticalDistance: RL_CONFIG.OBSTACLE_CRITICAL_DISTANCE,
      
      // Secondary/Helper rewards
      velocityTowardsTarget: 5.0,   // Guidance to help find target
      stagnation: -5.0,             // Prevent getting stuck/hovering
      timePenalty: -0.5,            // Urgency
      
      // Disabled/Secondary rewards (per user request)
      highSpeed: 0,
      lowAltitude: 0,
      goodAltitude: 0,
      highAltitude: 0,
      veryHighAltitude: 0,
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
   * @param {Array<number>} params.lidarDistances - All lidar ray distances for comprehensive proximity check
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
      lidarDistances,
      nadirDistance,
      droneState,
      targetDirWorld,
      terrainHeight,
    } = params;
    
    let reward = 0;
    const breakdown = {};
    
    // =====================================================
    // 1. COLLISION PENALTY (CATASTROPHIC - must NEVER happen)
    // =====================================================
    if (hadCollision) {
      reward += this.config.collision;
      breakdown.collision = this.config.collision;
      // Return early - collision is terminal, other rewards don't matter
      return { reward, breakdown };
    }
    
    // =====================================================
    // 2. OBSTACLE PROXIMITY PENALTY (CRITICAL - must HATE being close)
    // =====================================================
    // Use ALL lidar rays to create comprehensive "force field" of fear
    const proximityPenalty = this.calculateProximityPenalty(lidarDistances, minLidarDist);
    if (proximityPenalty < 0) {
      reward += proximityPenalty;
      breakdown.proximity = proximityPenalty;
    }
    
    // =====================================================
    // 3. DISTANCE PROGRESS (Primary shaping reward)
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
    // 4. TARGET REACHED BONUS
    // =====================================================
    if (currentDistance < targetRadius) {
      reward += this.config.targetReached;
      breakdown.targetReached = this.config.targetReached;
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
    // 8. ALTITUDE REWARDS/PENALTIES (Using nadir lidar)
    // =====================================================
    // Reward flying low, PUNISH flying high
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
    } else if (effectiveAltitude >= 8 && effectiveAltitude < 15) {
      // Too high: 8-15 meters - PENALTY
      reward += this.config.highAltitude;
      breakdown.highAltitude = this.config.highAltitude;
    } else if (effectiveAltitude >= 15) {
      // Way too high: >15 meters - STRONG PENALTY
      // Scale penalty with altitude to really discourage going higher
      const altitudeFactor = Math.min(3, effectiveAltitude / 15); // Cap at 3x
      const veryHighPenalty = this.config.veryHighAltitude * altitudeFactor;
      reward += veryHighPenalty;
      breakdown.veryHighAltitude = veryHighPenalty;
    }
    
    // =====================================================
    // 9. TIME PENALTY (Encourages efficiency)
    // =====================================================
    reward += this.config.timePenalty;
    breakdown.time = this.config.timePenalty;
    
    return { reward, breakdown };
  }
  
  /**
   * Calculate proximity penalty based on ALL lidar rays
   * Creates a comprehensive "force field" of fear around obstacles
   * 
   * The agent should HATE being close to obstacles. This penalty:
   * - Considers ALL lidar rays, not just the minimum
   * - Uses exponential scaling for very close obstacles
   * - Accumulates penalties from multiple close rays
   * 
   * @param {Array<number>} lidarDistances - All lidar ray distances
   * @param {number} minLidarDist - Minimum distance (fallback)
   * @returns {number} - Total proximity penalty (negative)
   */
  calculateProximityPenalty(lidarDistances, minLidarDist) {
    let totalPenalty = 0;
    
    // Use the distances array if available, otherwise fall back to minLidarDist
    const distances = lidarDistances && lidarDistances.length > 0 
      ? lidarDistances 
      : [minLidarDist];
    
    // Count rays in different danger zones
    let criticalRays = 0;  // < CRITICAL_DISTANCE (2m)
    let closeRays = 0;     // < CLOSE_DISTANCE (4m)
    let dangerRays = 0;    // < DANGER_DISTANCE (8m)
    
    for (const dist of distances) {
      if (dist < this.config.obstacleCriticalDistance) {
        // CRITICAL ZONE: Exponential penalty - agent should be TERRIFIED
        const criticalFactor = 1 - (dist / this.config.obstacleCriticalDistance);
        // Exponential: penalty grows rapidly as distance approaches 0
        const exponentialPenalty = this.config.obstacleVeryClose * (1 + criticalFactor * criticalFactor * 5);
        totalPenalty += exponentialPenalty;
        criticalRays++;
      } else if (dist < this.config.obstacleCloseDistance) {
        // CLOSE ZONE: Strong linear penalty
        const closeFactor = 1 - (dist / this.config.obstacleCloseDistance);
        totalPenalty += this.config.obstacleVeryClose * closeFactor;
        closeRays++;
      } else if (dist < this.config.obstacleDangerDistance) {
        // DANGER ZONE: Moderate penalty
        const dangerFactor = 1 - (dist / this.config.obstacleDangerDistance);
        totalPenalty += this.config.obstacleProximity * dangerFactor;
        dangerRays++;
      }
    }
    
    // Additional penalty for having MULTIPLE rays in danger zones
    // This teaches the agent to avoid being surrounded
    if (criticalRays > 1) {
      totalPenalty += this.config.obstacleVeryClose * (criticalRays - 1) * 0.5;
    }
    if (closeRays > 2) {
      totalPenalty += this.config.obstacleProximity * (closeRays - 2) * 0.3;
    }
    
    return totalPenalty;
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

