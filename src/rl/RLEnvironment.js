/**
 * Reinforcement Learning Environment for Drone Navigation
 * 
 * ALL observations and actions are in LOCAL coordinates (relative to drone facing)
 * 
 * Observation Space:
 * - Lidar distances (normalized 0-1): in LOCAL coords (forward = +X)
 * - Velocity (normalized, LOCAL coords): vx (forward), vy (right), vz (up)
 * - Target direction (unit vector, LOCAL coords): dx (forward), dy (right), dz (up)
 * - Distance to target (normalized): 1 value
 * - Can see target: 1 value (binary)
 * 
 * Action Space (LOCAL coords):
 * - thrustX: backward (-1) / forward (+1)
 * - thrustY: strafe left (-1) / right (+1)
 * - thrustZ: down (-1) / up (+1)
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
    // Update lidar raycast targets
    this.lidar.setRaycastTargets(forest.getRaycastTargets());
  }
  
  /**
   * Reset environment for new episode
   */
  reset() {
    // Reset drone state completely
    this.drone.reset();
    
    // Set drone to spawn position
    const spawnPos = this.forest.findSpawnPosition();
    this.drone.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
    
    // Generate new target BEFORE setting drone orientation
    const state = this.drone.getState();
    this.targetManager.generate(state.x, state.z);
    
    // Make drone face the target (AFTER target is generated)
    const target = this.targetManager.getPosition();
    this.drone.lookAt(target.x, target.z);
    
    // Force mesh update to ensure visual matches state
    this.drone.updateMesh();
    
    // Reset episode state
    this.episodeStats.startEpisode();
    this.rewardCalculator.reset(); // Reset position history for stagnation detection
    this.previousDistanceToTarget = this.getDistanceToTarget();
    
    // Update lidar target info for visualization (reuse target from above)
    this.lidar.setTargetPosition(target.x, target.y, target.z);
    this.lidar.setTargetVisible(this.canSeeTarget());
    
    // Initial lidar scan (AFTER drone orientation is set)
    this.lidar.scan();
    
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
    
    // Update lidar target info for visualization
    const target = this.targetManager.getPosition();
    this.lidar.setTargetPosition(target.x, target.y, target.z);
    this.lidar.setTargetVisible(this.canSeeTarget());
    
    // Scan lidar
    this.lidar.scan();
    
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
   * Get current observation (all in LOCAL coordinates)
   */
  getObservation() {
    const state = this.drone.getState();
    // Get closest obstacles data (flat array: [dirX1, dirZ1, dist1, ...])
    const closestObstaclesFlat = this.lidar.getClosestObstaclesFlat();
    const nadirDist = this.lidar.getNadirDistance();
    const zenithDist = this.lidar.getZenithDistance();
    // Use LOCAL coordinates for target direction (matches local thrust controls)
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
   */
  calculateReward(prevDist) {
    const state = this.drone.getState();
    const currentDist = this.getDistanceToTarget();
    const minLidarDist = this.lidar.getMinDistance();
    const lidarDistances = this.lidar.getDistances(); // All scan rays
    const numScanRays = this.lidar.getNumScanRays(); // Horizontal rays only (excludes nadir/zenith)
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
      numScanRays,
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
