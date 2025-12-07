/**
 * Reinforcement Learning Environment for Drone Navigation
 * 
 * ALL observations and actions are in LOCAL coordinates (relative to drone facing)
 * 
 * CURRICULUM LEARNING: Starts with easy targets, gradually increases difficulty.
 * Key: On failure, retry the SAME target (many retries allowed).
 * 
 * FIXED VALUES:
 * - Drone spawn height: 1.5m above ground
 * - Target height: 2m above ground
 * - Target size: 2m diameter (1m radius)
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

// Fixed spawn and target heights
const FIXED_SPAWN_HEIGHT = 1.5;  // Drone spawns 1.5m above ground
const FIXED_TARGET_HEIGHT = 1.0; // Target center is always 1m above ground

export class RLEnvironment {
  constructor(drone, lidar, forestGenerator, sceneManager) {
    this.drone = drone;
    this.lidar = lidar;
    this.forest = forestGenerator;
    this.sceneManager = sceneManager;
    
    // Initialize components
    this.observationBuilder = new ObservationBuilder();
    this.rewardCalculator = new RewardCalculator();
    this.targetManager = new TargetManager(forestGenerator, sceneManager);
    this.terminationChecker = new TerminationChecker();
    this.episodeStats = new EpisodeStats();
    this.curriculumManager = new CurriculumManager();
    
    // Observation and action space sizes
    this.observationSize = this.observationBuilder.getSize();
    this.actionSize = 3; // thrustX, thrustY, thrustZ
    
    // Raycast targets for lidar
    this.raycastTargets = [];
    
    // Previous distance for reward calculation
    this.previousDistanceToTarget = 0;
    
    // Store spawn position for retrying same scenario
    this.lastSpawnPosition = null;
    
    // Last episode result for curriculum updates
    this.lastEpisodeSuccess = false;
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
    this.targetManager.setForest(forest);
    this.lidar.setObstacles(forest.getObstacles());
    this.lidar.setTerrainHeightFn((x, z) => forest.getTerrainHeight(x, z));
    this.lidar.setRaycastTargets(forest.getRaycastTargets());
  }
  
  /**
   * Reset environment for new episode
   * Uses curriculum learning: keeps same target on failure (many retries)
   */
  reset() {
    // Reset drone state completely
    this.drone.reset();
    
    // Update curriculum based on last episode result
    const curriculumResult = this.curriculumManager.recordEpisodeResult(this.lastEpisodeSuccess);
    
    // Target radius is FIXED (from curriculum manager, always 1.0 = 2m diameter)
    this.targetManager.setRadius(this.curriculumManager.getTargetRadius());
    
    // Determine spawn position
    let spawnPos;
    if (this.curriculumManager.shouldKeepSameTarget() && this.lastSpawnPosition) {
      // Retry same scenario - use exact same spawn position
      spawnPos = this.lastSpawnPosition;
    } else {
      // New scenario - generate new spawn position
      const baseSpawn = this.forest.findSpawnPosition();
      const groundY = this.forest.getTerrainHeight(baseSpawn.x, baseSpawn.z);
      spawnPos = {
        x: baseSpawn.x,
        y: groundY + FIXED_SPAWN_HEIGHT, // FIXED: 1.5m above ground
        z: baseSpawn.z,
      };
      this.lastSpawnPosition = { ...spawnPos };
    }
    
    this.drone.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
    
    // Generate or reuse target
    if (this.curriculumManager.shouldKeepSameTarget()) {
      // Reuse stored target
      const storedTarget = this.curriculumManager.getCurrentTarget();
      if (storedTarget) {
        this.targetManager.setPosition(storedTarget.x, storedTarget.y, storedTarget.z);
      } else {
        this.generateCurriculumTarget();
      }
    } else {
      // Generate new target based on curriculum
      this.generateCurriculumTarget();
    }
    
    // Make drone face the target
    const target = this.targetManager.getPosition();
    this.drone.lookAt(target.x, target.z);
    this.drone.updateMesh();
    
    // Reset episode state
    this.episodeStats.startEpisode();
    this.rewardCalculator.reset();
    this.previousDistanceToTarget = this.getDistanceToTarget();
    this.lastEpisodeSuccess = false;
    
    // Update lidar target info
    this.lidar.setTargetPosition(target.x, target.y, target.z);
    this.lidar.setTargetVisible(this.canSeeTarget());
    
    // Initial lidar scan
    this.lidar.scan();
    
    return this.getObservation();
  }
  
  /**
   * Generate target based on curriculum difficulty
   * Target is always at FIXED_TARGET_HEIGHT (2m) above ground
   */
  generateCurriculumTarget() {
    const state = this.drone.getState();
    const range = this.curriculumManager.getTargetDistanceRange();
    
    // Generate target within curriculum distance range
    // Use forest's method but override the Y coordinate
    const target = this.forest.generateTargetPosition(
      state.x, state.z,
      range.min, range.max
    );
    
    // Override Y to be FIXED height above ground at target position
    const groundY = this.forest.getTerrainHeight(target.x, target.z);
    const fixedY = groundY + FIXED_TARGET_HEIGHT;
    
    this.targetManager.setPosition(target.x, fixedY, target.z);
    this.curriculumManager.setCurrentTarget(target.x, fixedY, target.z);
  }
  
  /**
   * Generate a new target position (legacy method)
   */
  generateTarget() {
    this.generateCurriculumTarget();
    this.previousDistanceToTarget = this.getDistanceToTarget();
  }
  
  /**
   * Get target position
   */
  getTarget() {
    return this.targetManager.getPosition();
  }
  
  /**
   * Take a step in the environment
   */
  step(action, dt) {
    // Apply action
    const thrustX = Math.max(-1, Math.min(1, action[0]));
    const thrustY = Math.max(-1, Math.min(1, action[1]));
    const thrustZ = Math.max(-1, Math.min(1, action[2]));
    
    this.drone.setControls(thrustX, thrustY, thrustZ);
    
    // Store pre-update state
    const prevDist = this.getDistanceToTarget();
    
    // Update drone physics
    this.drone.update(dt);
    
    // Update lidar target info
    const target = this.targetManager.getPosition();
    this.lidar.setTargetPosition(target.x, target.y, target.z);
    this.lidar.setTargetVisible(this.canSeeTarget());
    
    // Scan lidar
    this.lidar.scan();
    
    // Calculate reward (now includes proximity penalty)
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
    
    // Update stats on episode end
    if (done) {
      this.lastEpisodeSuccess = info.success === true;
      this.episodeStats.endEpisode(info.success);
    }
    
    return { observation, reward, done, info };
  }
  
  /**
   * Get current observation (all in LOCAL coordinates)
   */
  getObservation() {
    const state = this.drone.getState();
    const closestObstaclesFlat = this.lidar.getClosestObstaclesFlat();
    const nadirDist = this.lidar.getNadirDistance();
    const zenithDist = this.lidar.getZenithDistance();
    const targetDir = this.getTargetDirection();
    const distToTarget = this.getDistanceToTarget();
    const canSee = this.canSeeTarget();
    
    return this.observationBuilder.build(
      state,
      closestObstaclesFlat,
      nadirDist,
      zenithDist,
      targetDir,
      distToTarget,
      canSee
    );
  }
  
  /**
   * Calculate reward for current step
   * Includes proximity penalty from lidar distances
   */
  calculateReward(prevDist) {
    const currentDist = this.getDistanceToTarget();
    const minLidarDist = this.lidar.getMinDistance();
    const nadirDistance = this.lidar.getNadirDistance();
    const zenithDistance = this.lidar.getZenithDistance();
    
    return this.rewardCalculator.calculate({
      prevDistance: prevDist,
      currentDistance: currentDist,
      targetRadius: this.targetManager.getRadius(),
      hadCollision: this.drone.hadCollision(),
      minLidarDist,
      nadirDistance,
      zenithDistance,
    });
  }
  
  /**
   * Check if episode should terminate
   */
  checkTermination() {
    const state = this.drone.getState();
    const distToTarget = this.getDistanceToTarget();
    const stats = this.episodeStats.getStats();
    
    return this.terminationChecker.check({
      distToTarget,
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
   * Get direction to target in drone-local coordinates
   */
  getTargetDirection() {
    const target = this.targetManager.getPosition();
    const local = this.drone.worldToLocal(target.x, target.y, target.z);
    const dist = Math.sqrt(local.x * local.x + local.y * local.y + local.z * local.z);
    
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    
    return {
      x: local.x / dist,
      y: local.y / dist,
      z: local.z / dist,
    };
  }
  
  /**
   * Get direction to target in world coordinates
   */
  getTargetDirectionWorld() {
    const state = this.drone.getState();
    return this.targetManager.getDirectionFrom(state.x, state.y, state.z);
  }
  
  /**
   * Check if drone can see the target
   */
  canSeeTarget() {
    const dist = this.getDistanceToTarget();
    if (dist < 3) return true;
    
    const forwardMinDist = this.lidar.getForwardMinDistance();
    return forwardMinDist > dist * 0.8;
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
   * Get curriculum manager (for external access)
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
      names: ['thrustX', 'thrustY', 'thrustZ'],
    };
  }
  
  // Legacy getters for backwards compatibility
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
