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
 */

import { LIDAR } from '../config.js';
import {
  ObservationBuilder,
  RewardCalculator,
  TargetManager,
  TerminationChecker,
  EpisodeStats,
} from './environment/index.js';

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
    
    // Observation and action space sizes
    this.observationSize = this.observationBuilder.getSize();
    this.actionSize = 3; // thrustX, thrustY, thrustZ
    
    // Raycast targets for lidar
    this.raycastTargets = [];
    
    // Previous distance for reward calculation
    this.previousDistanceToTarget = 0;
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
    const state = this.drone.getState();
    this.targetManager.generate(state.x, state.z);
    
    // Make drone face the target
    const target = this.targetManager.getPosition();
    this.drone.lookAt(target.x, target.z);
    
    // Reset episode state
    this.episodeStats.startEpisode();
    this.rewardCalculator.reset(); // Reset position history for stagnation detection
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
    this.targetManager.generate(state.x, state.z);
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
   * @param {Array} action - [thrustX, thrustY, thrustZ]
   * @param {number} dt - Delta time
   * @returns {Object} - { observation, reward, done, info }
   */
  step(action, dt) {
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
    const { reward, breakdown: rewardBreakdown } = this.calculateReward(prevDist);
    this.episodeStats.recordStep(reward);
    
    // Check termination conditions
    const { done, info } = this.checkTermination();
    info.rewardBreakdown = rewardBreakdown;
    info.episodeReward = this.episodeStats.getStats().currentEpisodeReward;
    info.episodeSteps = this.episodeStats.getStats().currentEpisodeSteps;
    
    // Get new observation
    const observation = this.getObservation();
    
    // Update stats on episode end
    if (done) {
      this.episodeStats.endEpisode(info.success);
    }
    
    return { observation, reward, done, info };
  }
  
  /**
   * Get current observation
   */
  getObservation() {
    const state = this.drone.getState();
    const lidarDistances = this.lidar.getDistances();
    const targetDir = this.getTargetDirection();
    const distToTarget = this.getDistanceToTarget();
    const canSee = this.canSeeTarget();
    
    return this.observationBuilder.build(
      state,
      lidarDistances,
      targetDir,
      distToTarget,
      canSee
    );
  }
  
  /**
   * Calculate reward for current step
   */
  calculateReward(prevDist) {
    const state = this.drone.getState();
    const currentDist = this.getDistanceToTarget();
    const minLidarDist = this.lidar.getMinDistance();
    const lidarDistances = this.lidar.getDistances(); // All lidar rays for comprehensive proximity check
    const nadirDistance = this.lidar.getNadirDistance();
    const targetDirWorld = this.getTargetDirectionWorld();
    const terrainHeight = this.forest.getTerrainHeight(state.x, state.z);
    
    return this.rewardCalculator.calculate({
      prevDistance: prevDist,
      currentDistance: currentDist,
      targetRadius: this.targetManager.getRadius(),
      hadCollision: this.drone.hadCollision(),
      minLidarDist,
      lidarDistances,
      nadirDistance,
      droneState: state,
      targetDirWorld,
      terrainHeight,
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
   * Get direction to target in drone-local coordinates (unit vector)
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
   * Get direction to target in world coordinates (unit vector)
   */
  getTargetDirectionWorld() {
    const state = this.drone.getState();
    return this.targetManager.getDirectionFrom(state.x, state.y, state.z);
  }
  
  /**
   * Check if drone can see the target (raycast)
   */
  canSeeTarget() {
    const state = this.drone.getState();
    const dist = this.getDistanceToTarget();
    
    // If very close, can definitely see it
    if (dist < 3) return true;
    
    // Simple heuristic: check if forward-ish rays have clear path to target distance
    const forwardMinDist = this.lidar.getForwardMinDistance();
    
    return forwardMinDist > dist * 0.8;
  }
  
  /**
   * Get training statistics
   */
  getStats() {
    return this.episodeStats.getStats();
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
