/**
 * NavigationEnvironment - Manages drone navigation
 * Supports two modes: Omniscient (A*) and Learned Model
 */
import { TARGET } from '../config.js';

const FIXED_SPAWN_HEIGHT = 1.5;
const FIXED_TARGET_HEIGHT = 1.0;

export class NavigationEnvironment {
  constructor(drone, lidar, forestGenerator, sceneManager) {
    this.drone = drone;
    this.lidar = lidar;
    this.forest = forestGenerator;
    this.sceneManager = sceneManager;
    
    // Controller (set externally - either OmniscientController or LearnedController)
    this.controller = null;
    
    // Target state
    this.targetX = 0;
    this.targetY = 5;
    this.targetZ = 0;
    this.targetRadius = 2.0;
    
    // Episode stats
    this.episodeSteps = 0;
    this.totalEpisodes = 0;
    this.successfulEpisodes = 0;
  }
  
  /**
   * Set the navigation controller
   */
  setController(controller) {
    this.controller = controller;
    
    // If we have a target, set it on the new controller
    if (this.controller) {
      this.controller.setTarget(this.targetX, this.targetY, this.targetZ);
    }
  }
  
  /**
   * Set forest reference (for scene regeneration)
   */
  setForest(forest) {
    this.forest = forest;
    this.lidar.setObstacles(forest.getObstacles());
    this.lidar.setTerrainHeightFn((x, z) => forest.getTerrainHeight(x, z));
    this.lidar.setRaycastTargets(forest.getRaycastTargets());
  }
  
  /**
   * Set seed for target generation
   */
  setSeed(seed) {
    this.targetSeed = seed;
  }
  
  /**
   * Reset environment for new episode
   * Drone always spawns at map center.
   */
  reset() {
    this.drone.reset();
    this.episodeSteps = 0;
    
    // Spawn position (center of map)
    const baseSpawn = this.forest.findSpawnPosition();
    const groundY = this.forest.getTerrainHeight(baseSpawn.x, baseSpawn.z);
    const spawnPos = {
      x: baseSpawn.x,
      y: groundY + FIXED_SPAWN_HEIGHT,
      z: baseSpawn.z,
    };
    
    this.drone.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
    
    // Generate target
    this.generateTarget();
    
    // Face the target (pro-grade direction)
    this.drone.lookAt(this.targetX, this.targetZ);
    
    // Set target for controller
    if (this.controller) {
      this.controller.setTarget(this.targetX, this.targetY, this.targetZ);
    }
    
    // Update lidar
    this.lidar.setTargetPosition(this.targetX, this.targetY, this.targetZ);
    this.lidar.setTargetVisible(this.canSeeTarget());
    this.lidar.scan();
    
    return this.getObservation();
  }
  
  /**
   * Generate a new target position
   */
  generateTarget(minDist = TARGET.MIN_DISTANCE, maxDist = TARGET.MAX_DISTANCE) {
    const state = this.drone.getState();
    const target = this.forest.generateTargetPosition(
      state.x, state.z,
      minDist, maxDist,
      this.targetSeed || Date.now()
    );
    
    const groundY = this.forest.getTerrainHeight(target.x, target.z);
    this.targetX = target.x;
    this.targetY = groundY + FIXED_TARGET_HEIGHT;
    this.targetZ = target.z;
    
    // Update controller target
    if (this.controller) {
      this.controller.setTarget(this.targetX, this.targetY, this.targetZ);
    }
    
    // Update scene marker
    if (this.sceneManager) {
      this.sceneManager.setTargetPosition(this.targetX, this.targetY, this.targetZ);
    }
  }
  
  /**
   * Take a step in the environment
   */
  step(manualAction, dt) {
    this.episodeSteps++;
    
    // Determine action
    let action = [0, 0, 0];
    
    const hasManualInput = manualAction && 
      (manualAction[0] !== 0 || manualAction[1] !== 0 || manualAction[2] !== 0);
    
    if (hasManualInput) {
      action = manualAction;
    } else if (this.controller && this.controller.hasActiveTarget()) {
      action = this.controller.update();
    }
    
    // Apply LOCAL velocity controls
    const forward = Math.max(-1, Math.min(1, action[0]));
    const vertical = Math.max(-1, Math.min(1, action[1]));
    const yawRate = Math.max(-1, Math.min(1, action[2]));
    
    this.drone.setControls(forward, vertical, yawRate);
    this.drone.update(dt);
    
    // Update lidar
    this.lidar.setTargetPosition(this.targetX, this.targetY, this.targetZ);
    this.lidar.setTargetVisible(this.canSeeTarget());
    this.lidar.scan();
    
    // Check termination
    const { done, info } = this.checkTermination();
    
    return { observation: this.getObservation(), done, info };
  }
  
  /**
   * Check termination conditions
   */
  checkTermination() {
    const dist = this.getDistanceToTarget();
    const hadCollision = this.drone.hadCollision();
    
    if (dist < this.targetRadius) {
      this.totalEpisodes++;
      this.successfulEpisodes++;
      return {
        done: true,
        info: { success: true, reason: 'target_reached', distance: dist },
      };
    }
    
    if (hadCollision) {
      this.totalEpisodes++;
      return {
        done: true,
        info: { success: false, reason: 'collision', collisionType: this.drone.getLastCollisionType() },
      };
    }
    
    if (this.episodeSteps > 2000) {
      this.totalEpisodes++;
      return {
        done: true,
        info: { success: false, reason: 'timeout' },
      };
    }
    
    return { done: false, info: { distance: dist } };
  }
  
  getObservation() {
    const state = this.drone.getState();
    return {
      x: state.x, y: state.y, z: state.z,
      vx: state.vx, vy: state.vy, vz: state.vz,
      targetX: this.targetX, targetY: this.targetY, targetZ: this.targetZ,
    };
  }
  
  getDistanceToTarget() {
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  canSeeTarget() {
    const dist = this.getDistanceToTarget();
    if (dist < 3) return true;
    return this.lidar.isPathToPointClear(this.targetX, this.targetY, this.targetZ, 0.5);
  }
  
  getTargetDirection() {
    const state = this.drone.getState();
    const dx = this.targetX - state.x;
    const dy = this.targetY - state.y;
    const dz = this.targetZ - state.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    return { x: dx / dist, y: dy / dist, z: dz / dist };
  }
  
  getTarget() {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }
  
  getStats() {
    return {
      currentEpisodeSteps: this.episodeSteps,
      totalEpisodes: this.totalEpisodes,
      successfulEpisodes: this.successfulEpisodes,
      successRate: this.totalEpisodes > 0 
        ? (this.successfulEpisodes / this.totalEpisodes * 100).toFixed(1) 
        : 0,
    };
  }
}
