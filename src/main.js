/**
 * Main entry point - Drone RL Navigation Simulation
 * 
 * Modes:
 * - Simulation: Manual drone + optional ghost RL drone (when model loaded)
 * - Training: Offline RL training with progress UI
 */
import { SIMULATION, FOREST } from './config.js';

// Forest
import { ForestGenerator } from './forest/ForestGenerator.js';

// Vehicle
import { Drone } from './vehicle/Drone.js';
import { GhostDrone } from './vehicle/GhostDrone.js';
import { Lidar } from './vehicle/Lidar.js';

// Reinforcement Learning
import { RLEnvironment } from './rl/RLEnvironment.js';
import { RLAgent } from './rl/RLAgent.js';
import { OfflineTrainer } from './rl/OfflineTrainer.js';

// Scene & UI
import { SceneManager } from './scene/SceneManager.js';
import { UIManager } from './ui/UIManager.js';

class Simulation {
  constructor() {
    // Components
    this.sceneManager = null;
    this.forestGenerator = null;
    this.drone = null;
    this.ghostDrone = null;
    this.ghostLidar = null; // Separate lidar for ghost drone
    this.lidar = null;
    this.rlEnvironment = null;
    this.ghostEnvironment = null; // Separate environment for ghost
    this.rlAgent = null;
    this.offlineTrainer = null;
    this.ui = null;
    
    // State
    this.isRunning = false;
    this.isTraining = false;
    this.hasLoadedModel = false;
    this.lastTime = 0;
    this.currentSeed = 42;
    this.cameraTarget = 'manual';
    
    // Performance optimization
    this.frameCounter = 0;
    this.uiUpdateInterval = 30;
    
    // Manual control
    this.manualInput = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
    };
    
    // Raycast targets for LiDAR
    this.raycastTargets = [];
    
    // Episode state
    this.isRegenerating = false;
    this.currentObservation = null;
    this.ghostObservation = null;
  }

  /**
   * Initialize the simulation
   */
  async init() {
    console.log('Initializing Drone Navigator...');
    
    // Create scene
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);
    
    // Generate initial forest
    this.generateForest();
    
    // Create manual drone
    console.log('Creating manual drone...');
    this.drone = new Drone();
    this.drone.setCollisionChecker(this.forestGenerator);
    this.drone.setScene(this.sceneManager.getScene());
    this.drone.setMode('manual');
    this.sceneManager.add(this.drone.getMesh());
    
    // Create LiDAR for manual drone
    this.lidar = new Lidar(this.drone);
    this.lidar.setRaycastTargets(this.raycastTargets);
    this.sceneManager.add(this.lidar.getVisualGroup());
    
    // Create Ghost Drone (hidden until model loaded)
    console.log('Creating ghost drone...');
    this.ghostDrone = new GhostDrone();
    this.ghostDrone.setCollisionChecker(this.forestGenerator);
    this.ghostDrone.setVisible(false);
    this.sceneManager.add(this.ghostDrone.getMesh());
    
    // Create RL Environment for manual drone (used for target management)
    console.log('Creating RL Environment...');
    this.rlEnvironment = new RLEnvironment(
      this.drone,
      this.lidar,
      this.forestGenerator,
      this.sceneManager
    );
    this.rlEnvironment.setRaycastTargets(this.raycastTargets);
    
    // Create RL Agent
    const obsInfo = this.rlEnvironment.getObservationSpaceInfo();
    const actInfo = this.rlEnvironment.getActionSpaceInfo();
    console.log(`Observation space: ${obsInfo.size}, Action space: ${actInfo.size}`);
    
    this.rlAgent = new RLAgent(obsInfo.size, actInfo.size);
    
    // Create UI
    this.ui = new UIManager();
    this.setupUICallbacks();
    
    // Set collision callback
    this.drone.setOnCollision((type) => this.handleCollision(type));
    
    // Reset environment for first episode
    this.currentObservation = this.rlEnvironment.reset();
    
    // Start simulation
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
    
    console.log('Simulation initialized!');
    console.log('Use WASD/QZ to fly. Load a model or train one to see the RL ghost drone.');
  }

  /**
   * Generate forest with current seed
   */
  generateForest() {
    console.log(`Generating forest (seed: ${this.currentSeed})...`);
    this.forestGenerator = new ForestGenerator(this.currentSeed);
    const forest = this.forestGenerator.generate();
    this.sceneManager.add(forest);
    this.raycastTargets = this.forestGenerator.getRaycastTargets();
  }

  /**
   * Regenerate scene with new seed
   */
  regenerateScene() {
    // Remove old forest
    if (this.forestGenerator) {
      const oldForest = this.forestGenerator.getForestGroup();
      this.sceneManager.remove(oldForest);
    }
    
    // New seed
    this.currentSeed = Date.now();
    
    // Generate new forest
    this.generateForest();
    
    // Update RL environment
    if (this.rlEnvironment) {
      this.rlEnvironment.setForest(this.forestGenerator);
    }
    
    // Update drone collision checker
    if (this.drone) {
      this.drone.setCollisionChecker(this.forestGenerator);
    }
    
    // Update ghost drone collision checker
    if (this.ghostDrone) {
      this.ghostDrone.setCollisionChecker(this.forestGenerator);
    }
    
    // Update LiDAR raycast targets
    if (this.lidar) {
      this.lidar.setRaycastTargets(this.raycastTargets);
    }
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    this.ui.on('newTarget', () => this.resetEpisode());
    this.ui.on('reset', () => this.resetEpisode());
    
    this.ui.on('cameraTargetChange', (target) => {
      this.cameraTarget = target;
      console.log(`Camera following: ${target}`);
    });
    
    this.ui.on('lidarToggle', (enabled) => {
      this.lidar.setVisualizationEnabled(enabled);
    });
    
    this.ui.on('startTraining', () => this.startTraining());
    this.ui.on('stopTraining', () => this.stopTraining());
    this.ui.on('downloadModel', () => this.downloadModel());
    this.ui.on('importModel', (file) => this.importModel(file));
    
    // Keyboard input
    this.ui.on('keydown', (key) => this.handleKeyDown(key));
    this.ui.on('keyup', (key) => this.handleKeyUp(key));
  }

  /**
   * Start offline training
   */
  async startTraining() {
    if (this.isTraining) return;
    
    console.log('Starting offline training...');
    this.isTraining = true;
    this.isRunning = false; // Pause simulation
    
    // Show training screen
    this.ui.showTrainingScreen();
    
    // Create offline trainer
    this.offlineTrainer = new OfflineTrainer(
      this.rlAgent,
      this.rlEnvironment,
      this.forestGenerator
    );
    
    // Setup callbacks
    this.offlineTrainer.onProgress = (stats) => {
      this.ui.updateTrainingStats(stats);
    };
    
    this.offlineTrainer.onEpisodeEnd = (info) => {
      const msg = info.success 
        ? `Episode ${info.episode}: SUCCESS (reward: ${info.reward.toFixed(1)})`
        : `Episode ${info.episode}: ${info.reward.toFixed(1)} reward, ${info.steps} steps`;
      this.ui.logTraining(msg, info.success ? 'success' : 'default');
    };
    
    this.offlineTrainer.onComplete = (stats) => {
      this.ui.logTraining(`Training complete! ${stats.episodes} episodes, ${(stats.successRate * 100).toFixed(1)}% success rate`, 'info');
    };
    
    // Start training
    await this.offlineTrainer.start(1000);
    
    // Training finished - model is now ready
    this.hasLoadedModel = true;
    this.ui.setModelLoaded(true);
    this.ui.logTraining('Model ready! Click "Download Model" to save, or "Stop Training" to return.', 'info');
  }

  /**
   * Stop training and return to simulation
   */
  stopTraining() {
    if (!this.isTraining) return;
    
    console.log('Stopping training...');
    
    if (this.offlineTrainer) {
      this.offlineTrainer.stop();
    }
    
    this.isTraining = false;
    this.ui.hideTrainingScreen();
    
    // Resume simulation
    this.isRunning = true;
    this.lastTime = performance.now();
    
    // Reset episode with new target
    this.resetEpisode();
    
    // If we trained, show ghost drone
    if (this.hasLoadedModel) {
      this.ghostDrone.setVisible(true);
      this.ghostDrone.syncFrom(this.drone);
    }
    
    this.animate();
  }

  /**
   * Download trained model
   */
  async downloadModel() {
    const success = await this.rlAgent.exportToFile();
    if (success) {
      this.ui.logTraining('Model downloaded!', 'success');
    } else {
      this.ui.logTraining('Download failed', 'failure');
    }
  }

  /**
   * Import model from file
   */
  async importModel(file) {
    console.log('Importing model...');
    this.ui.setModelStatus('Loading...');
    
    const success = await this.rlAgent.importFromFile(file);
    
    if (success) {
      this.hasLoadedModel = true;
      this.ui.setModelLoaded(true);
      this.ui.setModelStatus('Loaded');
      
      // Show ghost drone
      this.ghostDrone.setVisible(true);
      this.ghostDrone.syncFrom(this.drone);
      
      console.log('Model imported successfully!');
    } else {
      this.ui.setModelStatus('Load failed');
      console.error('Failed to import model');
    }
  }

  /**
   * Reset current episode
   */
  resetEpisode() {
    if (this.isRegenerating) return;
    
    this.currentObservation = this.rlEnvironment.reset();
    
    // Sync ghost drone to main drone position
    if (this.hasLoadedModel) {
      this.ghostDrone.syncFrom(this.drone);
      this.ghostDrone.reset();
    }
    
    console.log('Episode reset');
  }

  /**
   * Handle episode end
   */
  handleEpisodeEnd(info) {
    if (this.isRegenerating) return;
    this.isRegenerating = true;
    
    // Show appropriate splash
    if (info.success) {
      this.ui.showSuccessSplash();
    } else if (info.reason === 'collision') {
      const collisionType = this.drone.getLastCollisionType() || 'obstacle';
      this.ui.showCollisionSplash(collisionType);
    } else if (info.reason === 'timeout') {
      this.ui.showTimeoutSplash();
    }
    
    setTimeout(() => {
      this.currentObservation = this.rlEnvironment.reset();
      
      // Sync ghost drone
      if (this.hasLoadedModel) {
        this.ghostDrone.syncFrom(this.drone);
        this.ghostDrone.reset();
      }
      
      this.isRegenerating = false;
    }, 600);
  }

  /**
   * Handle drone collision
   */
  handleCollision(type) {
    console.log(`Collision detected: ${type}`);
  }

  /**
   * Handle key down
   */
  handleKeyDown(key) {
    switch (key) {
      case 'w': case 'arrowup':
        this.manualInput.forward = true;
        break;
      case 's': case 'arrowdown':
        this.manualInput.backward = true;
        break;
      case 'a': case 'arrowleft':
        this.manualInput.left = true;
        break;
      case 'd': case 'arrowright':
        this.manualInput.right = true;
        break;
      case 'q':
        this.manualInput.up = true;
        break;
      case 'z':
        this.manualInput.down = true;
        break;
      case 'r':
        this.resetEpisode();
        break;
    }
  }

  /**
   * Handle key up
   */
  handleKeyUp(key) {
    switch (key) {
      case 'w': case 'arrowup':
        this.manualInput.forward = false;
        break;
      case 's': case 'arrowdown':
        this.manualInput.backward = false;
        break;
      case 'a': case 'arrowleft':
        this.manualInput.left = false;
        break;
      case 'd': case 'arrowright':
        this.manualInput.right = false;
        break;
      case 'q':
        this.manualInput.up = false;
        break;
      case 'z':
        this.manualInput.down = false;
        break;
    }
  }

  /**
   * Get manual control action
   */
  getManualAction() {
    let thrustX = 0;
    let thrustY = 0;
    let thrustZ = 0;
    
    if (this.manualInput.forward) thrustX = 0.8;
    if (this.manualInput.backward) thrustX = -0.8;
    if (this.manualInput.left) thrustY = 0.8;
    if (this.manualInput.right) thrustY = -0.8;
    if (this.manualInput.up) thrustZ = 0.8;
    if (this.manualInput.down) thrustZ = -0.5;
    
    return [thrustX, thrustY, thrustZ];
  }

  /**
   * Main animation loop
   */
  animate() {
    if (!this.isRunning) return;
    
    requestAnimationFrame(() => this.animate());
    
    // Calculate delta time
    const currentTime = performance.now();
    let deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    this.frameCounter++;
    
    if (!this.isRegenerating) {
      this.update(deltaTime);
    }
    
    this.sceneManager.render();
  }

  /**
   * Update simulation state
   */
  update(dt) {
    // Get manual action for main drone
    const action = this.getManualAction();
    
    // Take step in environment
    const { observation, reward, done, info } = this.rlEnvironment.step(action, dt);
    this.currentObservation = observation;
    
    // Update ghost drone if model is loaded
    if (this.hasLoadedModel && this.ghostDrone.isVisible()) {
      this.updateGhostDrone(dt);
    }
    
    // Handle episode end
    if (done) {
      this.handleEpisodeEnd(info);
    }
    
    // Keep drone in bounds
    this.enforceBounds();
    
    // Update camera to follow selected drone
    this.updateCamera();
    
    // Update UI
    if (this.frameCounter % this.uiUpdateInterval === 0) {
      this.updateUI();
    }
  }

  /**
   * Update ghost drone with RL agent
   */
  updateGhostDrone(dt) {
    // Get ghost drone state and create observation
    const ghostState = this.ghostDrone.getState();
    const target = this.rlEnvironment.getTarget();
    
    // Calculate direction to target (simplified observation for ghost)
    const dx = target.x - ghostState.x;
    const dy = target.y - ghostState.y;
    const dz = target.z - ghostState.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Create a simplified observation for the ghost
    // Note: In a full implementation, ghost would have its own lidar
    // For now, we use a simplified approach
    const ghostObs = this.createGhostObservation(ghostState, target, dist);
    
    // Get RL action
    const action = this.rlAgent.selectAction(ghostObs, false);
    
    // Apply action to ghost drone
    this.ghostDrone.setControls(action[0], action[1], action[2]);
    this.ghostDrone.update(dt);
    
    // Check ghost collision
    if (this.ghostDrone.hadCollision()) {
      // Reset ghost to drone position on collision
      this.ghostDrone.syncFrom(this.drone);
      this.ghostDrone.reset();
    }
    
    // Enforce bounds on ghost
    this.enforceGhostBounds();
  }

  /**
   * Create observation for ghost drone
   */
  createGhostObservation(state, target, dist) {
    // This is a simplified observation - ideally ghost would have its own lidar
    // For now, create a basic observation with target direction
    const obsSize = this.rlEnvironment.observationSize;
    const obs = new Array(obsSize).fill(0);
    
    // Target direction (normalized, in local coords)
    const yaw = state.yaw || 0;
    const cosYaw = Math.cos(-yaw);
    const sinYaw = Math.sin(-yaw);
    
    const worldDx = (target.x - state.x) / Math.max(dist, 0.1);
    const worldDy = (target.y - state.y) / Math.max(dist, 0.1);
    const worldDz = (target.z - state.z) / Math.max(dist, 0.1);
    
    // Transform to local coords
    const localX = worldDx * cosYaw - worldDz * sinYaw;
    const localZ = worldDx * sinYaw + worldDz * cosYaw;
    
    // Fill observation (matching ObservationBuilder layout)
    // Lidar data (first 14 values) - set to "clear" (1.0)
    for (let i = 0; i < 14; i++) {
      obs[i] = 1.0;
    }
    
    // Velocity (normalized)
    obs[14] = state.vx / 8;
    obs[15] = state.vy / 8;
    obs[16] = state.vz / 8;
    
    // Target direction
    obs[17] = localX;
    obs[18] = worldDy;
    obs[19] = localZ;
    
    // Distance (normalized)
    obs[20] = Math.min(dist / 100, 1);
    
    // Can see target
    obs[21] = 1;
    
    return obs;
  }

  /**
   * Update camera to follow selected target
   */
  updateCamera() {
    let targetDrone = this.drone;
    
    if (this.cameraTarget === 'ghost' && this.hasLoadedModel) {
      targetDrone = this.ghostDrone;
    }
    
    const state = targetDrone.getState();
    this.sceneManager.followTarget(state.x, state.y, state.z, state.yaw, 'chase');
  }

  /**
   * Update UI displays
   */
  updateUI() {
    const state = this.drone.getState();
    const distToTarget = this.rlEnvironment.getDistanceToTarget();
    
    // Drone stats
    this.ui.updateDroneStats(state.speed, state.y, distToTarget);
    
    // Ghost drone stats
    if (this.hasLoadedModel) {
      const ghostState = this.ghostDrone.getState();
      const target = this.rlEnvironment.getTarget();
      const ghostDist = Math.sqrt(
        (target.x - ghostState.x) ** 2 +
        (target.y - ghostState.y) ** 2 +
        (target.z - ghostState.z) ** 2
      );
      this.ui.updateGhostStats(ghostDist, 'Active');
    }
  }

  /**
   * Keep drone within forest bounds
   */
  enforceBounds() {
    const state = this.drone.getState();
    const margin = 5;
    const halfSize = FOREST.SIZE / 2 - margin;
    
    let x = state.x;
    let y = state.y;
    let z = state.z;
    let changed = false;
    
    if (x < -halfSize) { x = -halfSize; changed = true; }
    if (x > halfSize) { x = halfSize; changed = true; }
    if (z < -halfSize) { z = -halfSize; changed = true; }
    if (z > halfSize) { z = halfSize; changed = true; }
    
    const groundY = this.forestGenerator.getTerrainHeight(x, z);
    const minY = groundY + 0.5;
    
    if (y < minY) { 
      y = minY; 
      changed = true; 
    }
    
    if (changed) {
      this.drone.setPosition(x, y, z);
    }
  }
  
  /**
   * Keep ghost drone within forest bounds
   */
  enforceGhostBounds() {
    const state = this.ghostDrone.getState();
    const margin = 5;
    const halfSize = FOREST.SIZE / 2 - margin;
    
    let x = state.x;
    let y = state.y;
    let z = state.z;
    let changed = false;
    
    if (x < -halfSize) { x = -halfSize; changed = true; }
    if (x > halfSize) { x = halfSize; changed = true; }
    if (z < -halfSize) { z = -halfSize; changed = true; }
    if (z > halfSize) { z = halfSize; changed = true; }
    
    const groundY = this.forestGenerator.getTerrainHeight(x, z);
    const minY = groundY + 0.5;
    
    if (y < minY) { 
      y = minY; 
      changed = true; 
    }
    
    if (changed) {
      this.ghostDrone.setPosition(x, y, z);
    }
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  const sim = new Simulation();
  await sim.init();
  
  // Expose for debugging
  window.sim = sim;
  
  // Debug helper functions
  window.enableCollisionDebug = () => {
    const collisionSystem = sim.drone.getCollisionSystem();
    collisionSystem.setDebugEnabled(true);
    collisionSystem.createDebugHelpers(sim.sceneManager.scene);
    console.log('Collision debug visualization enabled');
  };
  
  window.disableCollisionDebug = () => {
    const collisionSystem = sim.drone.getCollisionSystem();
    collisionSystem.setDebugEnabled(false);
    collisionSystem.clearDebugHelpers();
    console.log('Collision debug visualization disabled');
  };
  
  console.log('Debug helpers available: enableCollisionDebug(), disableCollisionDebug()');
});
