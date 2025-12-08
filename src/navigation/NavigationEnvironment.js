/**
 * NavigationEnvironment - Manages drone navigation with reactive obstacle avoidance
 * Uses LIDAR-based reactive controller for realistic sensor-derived navigation
 */
import { TARGET } from '../config.js';
import { ReactiveController } from '../pathfinding/index.js';

const FIXED_SPAWN_HEIGHT = 1.5;
const FIXED_TARGET_HEIGHT = 1.0;

export class NavigationEnvironment {
  constructor(drone, lidar, forestGenerator, sceneManager) {
    this.drone = drone;
    this.lidar = lidar;
    this.forest = forestGenerator;
    this.sceneManager = sceneManager;
    
    // Reactive controller (uses LIDAR, not omniscient pathfinding)
    this.controller = new ReactiveController(drone, lidar);
    
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
   * Set forest reference (for scene regeneration)
   */
  setForest(forest) {
    this.forest = forest;
    this.lidar.setObstacles(forest.getObstacles());
    this.lidar.setTerrainHeightFn((x, z) => forest.getTerrainHeight(x, z));
    this.lidar.setRaycastTargets(forest.getRaycastTargets());
  }
  
  /**
   * Set seed for target generation randomization
   */
  setSeed(seed) {
    this.targetSeed = seed;
  }
  
  /**
   * Reset environment for new episode
   */
  reset() {
    this.drone.reset();
    this.controller.clearTarget();
    this.episodeSteps = 0;
    
    // Spawn position
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
    
    // Set target for controller
    this.controller.setTarget(this.targetX, this.targetY, this.targetZ);
    
    // Update lidar
    this.lidar.setTargetPosition(this.targetX, this.targetY, this.targetZ);
    this.lidar.setTargetVisible(this.canSeeTarget());
    this.lidar.scan();
    
    return this.getObservation();
  }
  
  /**
   * Generate a new target position
   */
  generateTarget(
    minDist = TARGET.MIN_DISTANCE,
    maxDist = TARGET.MAX_DISTANCE
  ) {
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
    this.controller.setTarget(this.targetX, this.targetY, this.targetZ);
    
    // Update scene marker
    if (this.sceneManager) {
      this.sceneManager.setTargetPosition(this.targetX, this.targetY, this.targetZ);
    }
  }
  
  /**
   * Take a step in the environment
   * @param {Array} manualAction - Optional manual override [vx, vy, vz]
   * @param {number} dt - Delta time
   */
  step(manualAction, dt) {
    this.episodeSteps++;
    
    // Get action from reactive controller or manual input
    let action;
    if (manualAction && (manualAction[0] !== 0 || manualAction[1] !== 0 || manualAction[2] !== 0)) {
      // Manual input overrides autopilot
      action = manualAction;
    } else if (this.controller.hasActiveTarget()) {
      // Reactive navigation toward target
      action = this.controller.update();
    } else {
      // No target, hover in place
      action = [0, 0, 0];
    }
    
    // Apply velocity setpoint
    const vx = Math.max(-1, Math.min(1, action[0]));
    const vy = Math.max(-1, Math.min(1, action[1]));
    const vz = Math.max(-1, Math.min(1, action[2]));
    
    this.drone.setControls(vx, vy, vz);
    
    // Update physics
    this.drone.update(dt);
    
    // Update lidar
    this.lidar.setTargetPosition(this.targetX, this.targetY, this.targetZ);
    this.lidar.setTargetVisible(this.canSeeTarget());
    this.lidar.scan();
    
    // Check termination
    const { done, info } = this.checkTermination();
    
    // Get observation
    const observation = this.getObservation();
    
    return { observation, done, info };
  }
  
  /**
   * Check termination conditions
   */
  checkTermination() {
    const dist = this.getDistanceToTarget();
    const hadCollision = this.drone.hadCollision();
    
    // Success: reached target
    if (dist < this.targetRadius) {
      this.totalEpisodes++;
      this.successfulEpisodes++;
      return {
        done: true,
        info: {
          success: true,
          reason: 'target_reached',
          distance: dist,
        },
      };
    }
    
    // Failure: collision
    if (hadCollision) {
      this.totalEpisodes++;
      return {
        done: true,
        info: {
          success: false,
          reason: 'collision',
          collisionType: this.drone.getLastCollisionType(),
        },
      };
    }
    
    // Timeout
    if (this.episodeSteps > 2000) {
      this.totalEpisodes++;
      return {
        done: true,
        info: {
          success: false,
          reason: 'timeout',
        },
      };
    }
    
    return {
      done: false,
      info: {
        distance: dist,
      },
    };
  }
  
  /**
   * Get current observation (simplified, for UI display)
   */
  getObservation() {
    const state = this.drone.getState();
    return {
      x: state.x,
      y: state.y,
      z: state.z,
      vx: state.vx,
      vy: state.vy,
      vz: state.vz,
      targetX: this.targetX,
      targetY: this.targetY,
      targetZ: this.targetZ,
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
   * Get statistics
   */
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
