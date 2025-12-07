/**
 * Reinforcement Learning Environment for Drone Navigation
 * 
 * Action space: Velocity setpoints [-1, 1] → [-MAX_SPEED, MAX_SPEED]
 * The drone's internal PD controller handles inertia compensation.
 * 
 * Observation space (25 values):
 * - [0-2] Target direction (normalized)
 * - [3-5] Current velocity (normalized)
 * - [6-21] 16 lidar ray distances
 * - [22] Nadir distance
 * - [23] Zenith distance
 * - [24] Target distance
 */

import { LIDAR } from '../config.js';
import {
  ObservationBuilder,
  RewardCalculator,
  TargetManager,
  TerminationChecker,
  EpisodeStats,
  CurriculumManager,
} from './environment/index.js';

const FIXED_SPAWN_HEIGHT = 1.5;
const FIXED_TARGET_HEIGHT = 1.0;

export class RLEnvironment {
  constructor(drone, lidar, forestGenerator, sceneManager) {
    this.drone = drone;
    this.lidar = lidar;
    this.forest = forestGenerator;
    this.sceneManager = sceneManager;
    
    // Components
    this.observationBuilder = new ObservationBuilder();
    this.rewardCalculator = new RewardCalculator();
    this.targetManager = new TargetManager(forestGenerator, sceneManager);
    this.terminationChecker = new TerminationChecker();
    this.episodeStats = new EpisodeStats();
    this.curriculumManager = new CurriculumManager();
    
    // Space sizes
    this.observationSize = this.observationBuilder.getSize();
    this.actionSize = 3; // velocity setpoints [vx, vy, vz]
    
    // State
    this.lastSpawnPosition = null;
    this.lastEpisodeSuccess = false;
  }
  
  /**
   * Set forest reference (for scene regeneration)
   */
  setForest(forest) {
    this.forest = forest;
    this.targetManager.setForest(forest);
    this.lidar.setObstacles(forest.getObstacles());
    this.lidar.setTerrainHeightFn((x, z) => forest.getTerrainHeight(x, z));
    this.lidar.setRaycastTargets(forest.getRaycastTargets());
  }
  
  /**
   * Reset environment for new episode
   */
  reset() {
    this.drone.reset();
    
    // Update curriculum
    this.curriculumManager.recordEpisodeResult(this.lastEpisodeSuccess);
    this.targetManager.setRadius(this.curriculumManager.getTargetRadius());
    
    // Spawn position
    let spawnPos;
    if (this.curriculumManager.shouldKeepSameTarget() && this.lastSpawnPosition) {
      spawnPos = this.lastSpawnPosition;
    } else {
      const baseSpawn = this.forest.findSpawnPosition();
      const groundY = this.forest.getTerrainHeight(baseSpawn.x, baseSpawn.z);
      spawnPos = {
        x: baseSpawn.x,
        y: groundY + FIXED_SPAWN_HEIGHT,
        z: baseSpawn.z,
      };
      this.lastSpawnPosition = { ...spawnPos };
    }
    
    this.drone.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
    
    // Target
    if (this.curriculumManager.shouldKeepSameTarget()) {
      const storedTarget = this.curriculumManager.getCurrentTarget();
      if (storedTarget) {
        this.targetManager.setPosition(storedTarget.x, storedTarget.y, storedTarget.z);
      } else {
        this.generateCurriculumTarget();
      }
    } else {
      this.generateCurriculumTarget();
    }
    
    const target = this.targetManager.getPosition();
    this.drone.setYaw(0);
    this.drone.updateMesh();
    
    // Reset episode state
    this.episodeStats.startEpisode();
    this.rewardCalculator.reset();
    this.lastEpisodeSuccess = false;
    
    // Update lidar
    this.lidar.setTargetPosition(target.x, target.y, target.z);
    this.lidar.setTargetVisible(this.canSeeTarget());
    this.lidar.scan();
    
    return this.getObservation();
  }
  
  /**
   * Generate target based on curriculum
   */
  generateCurriculumTarget() {
    const state = this.drone.getState();
    const range = this.curriculumManager.getTargetDistanceRange();
    
    const target = this.forest.generateTargetPosition(
      state.x, state.z,
      range.min, range.max
    );
    
    const groundY = this.forest.getTerrainHeight(target.x, target.z);
    const fixedY = groundY + FIXED_TARGET_HEIGHT;
    
    this.targetManager.setPosition(target.x, fixedY, target.z);
    this.curriculumManager.setCurrentTarget(target.x, fixedY, target.z);
  }
  
  /**
   * Get target position
   */
  getTarget() {
    return this.targetManager.getPosition();
  }
  
  /**
   * Take a step in the environment
   * Action: [vx, vy, vz] velocity setpoints in [-1, 1]
   */
  step(action, dt) {
    // Apply velocity setpoint
    const vx = Math.max(-1, Math.min(1, action[0]));
    const vy = Math.max(-1, Math.min(1, action[1]));
    const vz = Math.max(-1, Math.min(1, action[2]));
    
    this.drone.setControls(vx, vy, vz);
    
    // Store pre-update distance
    const prevDist = this.getDistanceToTarget();
    
    // Update physics
    this.drone.update(dt);
    
    // Update lidar
    const target = this.targetManager.getPosition();
    this.lidar.setTargetPosition(target.x, target.y, target.z);
    this.lidar.setTargetVisible(this.canSeeTarget());
    this.lidar.scan();
    
    // Calculate reward
    const { reward, breakdown: rewardBreakdown } = this.calculateReward(prevDist);
    this.episodeStats.recordStep(reward);
    
    // Check termination
    const { done, info } = this.checkTermination();
    info.rewardBreakdown = rewardBreakdown;
    info.episodeReward = this.episodeStats.getStats().currentEpisodeReward;
    info.episodeSteps = this.episodeStats.getStats().currentEpisodeSteps;
    info.curriculumLevel = this.curriculumManager.getLevel();
    info.curriculumStage = this.curriculumManager.getCurrentStage().name;
    
    // Get new observation
    const observation = this.getObservation();
    
    // Update on episode end
    if (done) {
      this.lastEpisodeSuccess = info.success === true;
      this.episodeStats.endEpisode(info.success);
    }
    
    return { observation, reward, done, info };
  }
  
  /**
   * Get current observation
   */
  getObservation() {
    const state = this.drone.getState();
    const target = this.targetManager.getPosition();
    return this.observationBuilder.build(state, this.lidar, target);
  }
  
  /**
   * Calculate reward
   */
  calculateReward(prevDist) {
    return this.rewardCalculator.calculate({
      prevDistance: prevDist,
      currentDistance: this.getDistanceToTarget(),
      targetRadius: this.targetManager.getRadius(),
      hadCollision: this.drone.hadCollision(),
      minLidarDist: this.lidar.getMinDistance(),
      nadirDistance: this.lidar.getNadirDistance(),
    });
  }
  
  /**
   * Check termination
   */
  checkTermination() {
    const state = this.drone.getState();
    const stats = this.episodeStats.getStats();
    
    return this.terminationChecker.check({
      distToTarget: this.getDistanceToTarget(),
      targetRadius: this.targetManager.getRadius(),
      hadCollision: this.drone.hadCollision(),
      collisionType: this.drone.getLastCollisionType(),
      episodeSteps: stats.currentEpisodeSteps,
      droneState: state,
      worldHalfSize: this.forest.size / 2,
    });
  }
  
  /**
   * Get distance to target
   */
  getDistanceToTarget() {
    const state = this.drone.getState();
    return this.targetManager.getDistanceFrom(state.x, state.y, state.z);
  }
  
  /**
   * Check if drone can see target
   */
  canSeeTarget() {
    const dist = this.getDistanceToTarget();
    if (dist < 3) return true;
    return this.lidar.getForwardMinDistance() > dist * 0.8;
  }
  
  /**
   * Get direction to target in world coordinates (normalized)
   */
  getTargetDirection() {
    const state = this.drone.getState();
    const target = this.targetManager.getPosition();
    
    const dx = target.x - state.x;
    const dy = target.y - state.y;
    const dz = target.z - state.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    
    return {
      x: dx / dist,
      y: dy / dist,
      z: dz / dist,
    };
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    return {
      ...this.episodeStats.getStats(),
      curriculum: this.curriculumManager.getStats(),
    };
  }
  
  /**
   * Get curriculum manager
   */
  getCurriculumManager() {
    return this.curriculumManager;
  }
  
  /**
   * Get observation space info
   */
  getObservationSpaceInfo() {
    return this.observationBuilder.getSpaceInfo();
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
      names: ['velocityX', 'velocityY', 'velocityZ'],
    };
  }
  
  // Getters for compatibility
  get targetX() { return this.targetManager.getPosition().x; }
  get targetY() { return this.targetManager.getPosition().y; }
  get targetZ() { return this.targetManager.getPosition().z; }
  get targetRadius() { return this.targetManager.getRadius(); }
  get episodeSteps() { return this.episodeStats.getStats().currentEpisodeSteps; }
  get episodeReward() { return this.episodeStats.getStats().currentEpisodeReward; }
  get maxEpisodeSteps() { return this.terminationChecker.getMaxSteps(); }
  get totalEpisodes() { return this.episodeStats.getStats().totalEpisodes; }
  get successfulEpisodes() { return this.episodeStats.getStats().successfulEpisodes; }
}
