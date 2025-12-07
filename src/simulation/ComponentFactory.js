import { ForestGenerator } from '../forest/ForestGenerator.js';
import { Drone } from '../vehicle/Drone.js';
import { GhostDrone } from '../vehicle/GhostDrone.js';
import { Lidar } from '../vehicle/Lidar.js';
import { RLEnvironment } from '../rl/RLEnvironment.js';
import { RLAgent } from '../rl/RLAgent.js';
import { SceneManager } from '../scene/SceneManager.js';
import { UIManager } from '../ui/UIManager.js';

/**
 * ComponentFactory - Creates and wires up simulation components
 */
export class ComponentFactory {
  /**
   * Create all simulation components
   */
  static create(container, seed = 42) {
    const components = {};
    
    // Scene
    components.sceneManager = new SceneManager(container);
    
    // Forest
    const { forestGenerator, raycastTargets } = this.createForest(
      seed, 
      components.sceneManager
    );
    components.forestGenerator = forestGenerator;
    components.raycastTargets = raycastTargets;
    
    // Manual drone
    components.drone = this.createDrone(
      forestGenerator, 
      components.sceneManager
    );
    
    // LiDAR
    components.lidar = this.createLidar(
      components.drone, 
      forestGenerator, 
      components.sceneManager
    );
    
    // Ghost drone
    components.ghostDrone = this.createGhostDrone(
      forestGenerator, 
      components.sceneManager
    );
    
    // RL Environment
    components.rlEnvironment = new RLEnvironment(
      components.drone,
      components.lidar,
      forestGenerator,
      components.sceneManager
    );
    components.rlEnvironment.setRaycastTargets(raycastTargets);
    
    // RL Agent
    const obsInfo = components.rlEnvironment.getObservationSpaceInfo();
    const actInfo = components.rlEnvironment.getActionSpaceInfo();
    console.log(`Observation space: ${obsInfo.size}, Action space: ${actInfo.size}`);
    components.rlAgent = new RLAgent(obsInfo.size, actInfo.size);
    
    // UI
    components.ui = new UIManager();
    
    return components;
  }

  /**
   * Create forest
   */
  static createForest(seed, sceneManager) {
    console.log(`Generating forest (seed: ${seed})...`);
    const forestGenerator = new ForestGenerator(seed);
    const forest = forestGenerator.generate();
    sceneManager.add(forest);
    const raycastTargets = forestGenerator.getRaycastTargets();
    return { forestGenerator, raycastTargets };
  }

  /**
   * Create manual drone
   */
  static createDrone(forestGenerator, sceneManager) {
    console.log('Creating manual drone...');
    const drone = new Drone();
    drone.setCollisionChecker(forestGenerator);
    drone.setScene(sceneManager.getScene());
    drone.setMode('manual');
    sceneManager.add(drone.getMesh());
    return drone;
  }

  /**
   * Create LiDAR
   */
  static createLidar(drone, forestGenerator, sceneManager) {
    const lidar = new Lidar(drone);
    // Set fast raycaster data
    lidar.setObstacles(forestGenerator.getObstacles());
    lidar.setTerrainHeightFn((x, z) => forestGenerator.getTerrainHeight(x, z));
    // Legacy Three.js raycast targets (kept for compatibility)
    lidar.setRaycastTargets(forestGenerator.getRaycastTargets());
    sceneManager.add(lidar.getVisualGroup());
    return lidar;
  }

  /**
   * Create ghost drone
   */
  static createGhostDrone(forestGenerator, sceneManager) {
    console.log('Creating ghost drone...');
    const ghostDrone = new GhostDrone();
    ghostDrone.setCollisionChecker(forestGenerator);
    ghostDrone.setVisible(false);
    sceneManager.add(ghostDrone.getMesh());
    return ghostDrone;
  }

  /**
   * Regenerate forest with new seed
   */
  static regenerateForest(components, newSeed) {
    const { sceneManager, forestGenerator: oldForest, drone, ghostDrone, lidar, rlEnvironment } = components;
    
    // Remove old forest
    if (oldForest) {
      const oldForestGroup = oldForest.getForestGroup();
      sceneManager.remove(oldForestGroup);
    }
    
    // Generate new forest
    const { forestGenerator, raycastTargets } = this.createForest(newSeed, sceneManager);
    
    // Update references
    rlEnvironment.setForest(forestGenerator);
    drone.setCollisionChecker(forestGenerator);
    ghostDrone.setCollisionChecker(forestGenerator);
    // Update lidar with new obstacles and terrain
    lidar.setObstacles(forestGenerator.getObstacles());
    lidar.setTerrainHeightFn((x, z) => forestGenerator.getTerrainHeight(x, z));
    lidar.setRaycastTargets(raycastTargets);
    
    return { forestGenerator, raycastTargets };
  }
}

