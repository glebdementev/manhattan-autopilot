/**
 * Reinforcement Learning Environment for Drone Navigation
 * 
 * Observation Space:
 * - Lidar distances (normalized 0-1): NUM_HORIZONTAL_RAYS * NUM_VERTICAL_RAYS values
 * - Velocity (normalized): vx, vy, vz
 * - Target direction (unit vector): dx, dy, dz
 * - Distance to target (normalized): 1 value
 * - Can see target: 1 value (binary)
 * 
 * Action Space:
 * - Continuous: [thrustX, thrustY, thrustZ] each in range [-1, 1]
 * 
 * Rewards:
 * - Positive reward for getting closer to target
 * - Large positive reward for reaching target
 * - Negative reward for collision
 * - Small negative reward for time (encourages efficiency)
 * - Bonus for maintaining good speed towards target
 */

import { LIDAR, DRONE, RL_CONFIG } from '../config.js';

export class RLEnvironment {
  constructor(drone, lidar, forestGenerator, sceneManager) {
    this.drone = drone;
    this.lidar = lidar;
    this.forest = forestGenerator;
    this.sceneManager = sceneManager;
    
    // Target
    this.targetX = 0;
    this.targetY = 5;
    this.targetZ = 0;
    this.targetRadius = 2.0;
    
    // Episode state
    this.episodeSteps = 0;
    this.maxEpisodeSteps = RL_CONFIG.MAX_EPISODE_STEPS;
    this.previousDistanceToTarget = 0;
    this.episodeReward = 0;
    this.episodeStartTime = 0;
    
    // Stats
    this.totalEpisodes = 0;
    this.successfulEpisodes = 0;
    this.totalReward = 0;
    this.recentRewards = [];
    
    // Observation space size
    this.numLidarRays = LIDAR.NUM_HORIZONTAL_RAYS * LIDAR.NUM_VERTICAL_RAYS;
    this.observationSize = this.numLidarRays + 3 + 3 + 1 + 1; // lidar + velocity + target_dir + dist + can_see
    
    // Action space size
    this.actionSize = 3; // thrustX, thrustY, thrustZ
    
    // Raycast targets for lidar
    this.raycastTargets = [];
  }
  
  /**
   * Set raycast targets for lidar scanning
   */
  setRaycastTargets(targets) {
    this.raycastTargets = targets;
  }
  
  /**
   * Set forest reference (for scene regeneration)
   */
  setForest(forest) {
    this.forest = forest;
    this.raycastTargets = forest.getRaycastTargets();
  }
  
  /**
   * Reset environment for new episode
   */
  reset() {
    // Reset drone to spawn position
    const spawnPos = this.forest.findSpawnPosition();
    this.drone.reset();
    this.drone.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
    
    // Generate new target
    this.generateTarget();
    
    // Reset episode state
    this.episodeSteps = 0;
    this.episodeReward = 0;
    this.episodeStartTime = performance.now();
    this.previousDistanceToTarget = this.getDistanceToTarget();
    
    // Initial lidar scan
    this.lidar.scan(this.raycastTargets);
    
    // Get initial observation
    return this.getObservation();
  }
  
  /**
   * Generate a new target position
   */
  generateTarget() {
    const state = this.drone.getState();
    const target = this.forest.generateTargetPosition(state.x, state.z);
    
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetZ = target.z;
    
    // Update scene marker
    if (this.sceneManager) {
      this.sceneManager.setTargetPosition(target.x, target.y, target.z);
    }
    
    this.previousDistanceToTarget = this.getDistanceToTarget();
  }
  
  /**
   * Get target position
   */
  getTarget() {
    return {
      x: this.targetX,
      y: this.targetY,
      z: this.targetZ,
    };
  }
  
  /**
   * Take a step in the environment
   * @param {Array} action - [thrustX, thrustY, thrustZ]
   * @param {number} dt - Delta time
   * @returns {Object} - { observation, reward, done, info }
   */
  step(action, dt) {
    this.episodeSteps++;
    
    // Apply action
    const thrustX = Math.max(-1, Math.min(1, action[0]));
    const thrustY = Math.max(-1, Math.min(1, action[1]));
    const thrustZ = Math.max(-1, Math.min(1, action[2]));
    
    this.drone.setControls(thrustX, thrustY, thrustZ);
    
    // Store pre-update state for reward calculation
    const prevDist = this.getDistanceToTarget();
    
    // Update drone physics
    this.drone.update(dt);
    
    // Scan lidar
    this.lidar.scan(this.raycastTargets);
    
    // Calculate reward
    const { reward, rewardBreakdown } = this.calculateReward(prevDist);
    this.episodeReward += reward;
    
    // Check termination conditions
    const { done, info } = this.checkTermination();
    info.rewardBreakdown = rewardBreakdown;
    info.episodeReward = this.episodeReward;
    info.episodeSteps = this.episodeSteps;
    
    // Get new observation
    const observation = this.getObservation();
    
    // Update stats on episode end
    if (done) {
      this.totalEpisodes++;
      this.totalReward += this.episodeReward;
      this.recentRewards.push(this.episodeReward);
      if (this.recentRewards.length > 100) {
        this.recentRewards.shift();
      }
      if (info.success) {
        this.successfulEpisodes++;
      }
    }
    
    return { observation, reward, done, info };
  }
  
  /**
   * Get current observation
   */
  getObservation() {
    const state = this.drone.getState();
    const lidarDistances = this.lidar.getDistances();
    
    // Normalize lidar distances
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    // Normalize velocity
    const normalizedVel = [
      state.vx / DRONE.MAX_SPEED,
      state.vy / DRONE.MAX_SPEED,
      state.vz / DRONE.MAX_SPEED,
    ];
    
    // Target direction (unit vector in drone-local space)
    const targetDir = this.getTargetDirection();
    
    // Normalized distance to target
    const distToTarget = this.getDistanceToTarget();
    const normalizedDist = Math.min(distToTarget / RL_CONFIG.MAX_TARGET_DISTANCE, 1.0);
    
    // Can see target (raycast check)
    const canSeeTarget = this.canSeeTarget() ? 1.0 : 0.0;
    
    // Combine all observations
    const observation = [
      ...normalizedLidar,
      ...normalizedVel,
      targetDir.x,
      targetDir.y,
      targetDir.z,
      normalizedDist,
      canSeeTarget,
    ];
    
    return observation;
  }
  
  /**
   * Calculate reward for current step
   */
  calculateReward(prevDist) {
    const state = this.drone.getState();
    const currentDist = this.getDistanceToTarget();
    const minLidarDist = this.lidar.getMinDistance();
    
    let reward = 0;
    const breakdown = {};
    
    // 1. Distance progress reward (most important)
    const distanceProgress = prevDist - currentDist;
    const progressReward = distanceProgress * RL_CONFIG.REWARD_DISTANCE_PROGRESS;
    reward += progressReward;
    breakdown.progress = progressReward;
    
    // 2. Target reached bonus
    if (currentDist < this.targetRadius) {
      reward += RL_CONFIG.REWARD_TARGET_REACHED;
      breakdown.targetReached = RL_CONFIG.REWARD_TARGET_REACHED;
    }
    
    // 3. Collision penalty (checked in drone update)
    if (this.drone.hadCollision()) {
      reward += RL_CONFIG.REWARD_COLLISION;
      breakdown.collision = RL_CONFIG.REWARD_COLLISION;
    }
    
    // 4. Time penalty (encourages efficiency)
    reward += RL_CONFIG.REWARD_TIME_PENALTY;
    breakdown.time = RL_CONFIG.REWARD_TIME_PENALTY;
    
    // 5. Obstacle proximity penalty (smooth gradient)
    if (minLidarDist < RL_CONFIG.OBSTACLE_DANGER_DISTANCE) {
      const proximityPenalty = (1 - minLidarDist / RL_CONFIG.OBSTACLE_DANGER_DISTANCE) * RL_CONFIG.REWARD_OBSTACLE_PROXIMITY;
      reward += proximityPenalty;
      breakdown.proximity = proximityPenalty;
    }
    
    // 6. Velocity towards target bonus
    const targetDir = this.getTargetDirectionWorld();
    const velTowardsTarget = state.vx * targetDir.x + state.vy * targetDir.y + state.vz * targetDir.z;
    const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy + state.vz * state.vz);
    
    if (speed > 0.5 && velTowardsTarget > 0) {
      const velocityBonus = (velTowardsTarget / DRONE.MAX_SPEED) * RL_CONFIG.REWARD_VELOCITY_TOWARDS_TARGET;
      reward += velocityBonus;
      breakdown.velocity = velocityBonus;
    }
    
    // 7. Altitude maintenance bonus (stay at reasonable height)
    const terrainY = this.forest.getTerrainHeight(state.x, state.z);
    const altitude = state.y - terrainY;
    if (altitude > 2 && altitude < 15) {
      reward += RL_CONFIG.REWARD_GOOD_ALTITUDE;
      breakdown.altitude = RL_CONFIG.REWARD_GOOD_ALTITUDE;
    }
    
    return { reward, rewardBreakdown: breakdown };
  }
  
  /**
   * Check if episode should terminate
   */
  checkTermination() {
    const state = this.drone.getState();
    const distToTarget = this.getDistanceToTarget();
    
    // Success: reached target
    if (distToTarget < this.targetRadius) {
      return {
        done: true,
        info: { success: true, reason: 'target_reached' },
      };
    }
    
    // Failure: collision
    if (this.drone.hadCollision()) {
      return {
        done: true,
        info: { success: false, reason: 'collision' },
      };
    }
    
    // Failure: max steps exceeded
    if (this.episodeSteps >= this.maxEpisodeSteps) {
      return {
        done: true,
        info: { success: false, reason: 'timeout' },
      };
    }
    
    // Failure: out of bounds
    const halfSize = this.forest.size / 2;
    if (Math.abs(state.x) > halfSize || Math.abs(state.z) > halfSize) {
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
   * Get distance to target
   */
  getDistanceToTarget() {
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Get direction to target in drone-local coordinates (unit vector)
   */
  getTargetDirection() {
    const local = this.drone.worldToLocal(this.targetX, this.targetY, this.targetZ);
    const dist = Math.sqrt(local.x * local.x + local.y * local.y + local.z * local.z);
    
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    
    return {
      x: local.x / dist,
      y: local.y / dist,
      z: local.z / dist,
    };
  }
  
  /**
   * Get direction to target in world coordinates (unit vector)
   */
  getTargetDirectionWorld() {
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    
    return {
      x: dx / dist,
      y: dy / dist,
      z: dz / dist,
    };
  }
  
  /**
   * Check if drone can see the target (raycast)
   */
  canSeeTarget() {
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // If very close, can definitely see it
    if (dist < 3) return true;
    
    // Check if any lidar ray is pointing roughly towards target and doesn't hit obstacle before target
    const targetDir = this.getTargetDirection();
    const lidarDistances = this.lidar.getDistances();
    
    // Simple heuristic: check if forward-ish rays have clear path to target distance
    const forwardMinDist = this.lidar.getForwardMinDistance();
    
    return forwardMinDist > dist * 0.8;
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    const avgReward = this.recentRewards.length > 0 
      ? this.recentRewards.reduce((a, b) => a + b, 0) / this.recentRewards.length 
      : 0;
    
    return {
      totalEpisodes: this.totalEpisodes,
      successfulEpisodes: this.successfulEpisodes,
      successRate: this.totalEpisodes > 0 ? this.successfulEpisodes / this.totalEpisodes : 0,
      totalReward: this.totalReward,
      avgRecentReward: avgReward,
      currentEpisodeReward: this.episodeReward,
      currentEpisodeSteps: this.episodeSteps,
    };
  }
  
  /**
   * Get observation space info
   */
  getObservationSpaceInfo() {
    return {
      size: this.observationSize,
      breakdown: {
        lidar: this.numLidarRays,
        velocity: 3,
        targetDirection: 3,
        targetDistance: 1,
        canSeeTarget: 1,
      },
    };
  }
  
  /**
   * Get action space info
   */
  getActionSpaceInfo() {
    return {
      size: this.actionSize,
      continuous: true,
      low: [-1, -1, -1],
      high: [1, 1, 1],
      names: ['thrustX', 'thrustY', 'thrustZ'],
    };
  }
}

