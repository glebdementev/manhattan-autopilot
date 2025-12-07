/**
 * Main entry point - Drone RL Navigation Simulation
 * Train a drone to navigate through a forest using reinforcement learning
 */
import { SIMULATION, FOREST, RL_CONFIG } from './config.js';

// Forest
import { ForestGenerator } from './forest/ForestGenerator.js';

// Vehicle
import { Drone } from './vehicle/Drone.js';
import { GhostDrone } from './vehicle/GhostDrone.js';
import { Lidar } from './vehicle/Lidar.js';

// Reinforcement Learning
import { RLEnvironment } from './rl/RLEnvironment.js';
import { RLAgent } from './rl/RLAgent.js';

// Scene & UI
import { SceneManager } from './scene/SceneManager.js';
import { UIManager } from './ui/UIManager.js';

class Simulation {
  constructor() {
    // Components
    this.sceneManager = null;
    this.forestGenerator = null;
    this.drone = null;
    this.ghostDrone = null; // Ghost RL drone for visualization
    this.lidar = null;
    this.rlEnvironment = null;
    this.rlAgent = null;
    this.ui = null;
    
    // State
    this.driverMode = 'manual'; // 'rl', 'manual' - default to manual so user teaches the RL
    this.cameraTarget = 'manual'; // 'manual', 'ghost' - which drone camera follows
    this.isRunning = false;
    this.lastTime = 0;
    this.currentSeed = 42;
    
    // Training state
    this.trainingEnabled = true;
    this.learnFromManual = true; // Enable by default so RL learns from user demonstrations
    this.stepsSinceLastTrain = 0;
    this.episodesSinceSceneChange = 0;
    
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
  }

  /**
   * Initialize the simulation
   */
  async init() {
    console.log('Initializing Drone RL Navigation...');
    
    // Create scene
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);
    
    // Generate initial forest
    this.generateForest();
    
    // Create drone
    console.log('Creating drone...');
    this.drone = new Drone();
    this.drone.setCollisionChecker(this.forestGenerator);
    this.sceneManager.add(this.drone.getMesh());
    
    // Create LiDAR
    this.lidar = new Lidar(this.drone);
    this.sceneManager.add(this.lidar.getVisualGroup());
    
    // Create Ghost Drone (shows what RL would do)
    console.log('Creating ghost drone...');
    this.ghostDrone = new GhostDrone();
    this.ghostDrone.setCollisionChecker(this.forestGenerator);
    this.sceneManager.add(this.ghostDrone.getMesh());
    
    // Create RL Environment
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
    
    // Sync ghost drone to main drone position after reset
    this.ghostDrone.syncFrom(this.drone);
    
    // Start simulation
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
    
    console.log('Simulation initialized!');
    console.log('Training will start automatically. Use manual mode to test the agent.');
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
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    this.ui.on('newTarget', () => this.resetEpisode());
    this.ui.on('reset', () => this.resetEpisode());
    
    this.ui.on('driverModeChange', (mode) => {
      this.driverMode = mode;
      this.drone.setMode(mode === 'manual' ? 'manual' : 'autopilot');
      // Show/hide ghost drone and camera section based on mode
      this.ghostDrone.setVisible(mode === 'manual');
      this.ui.setCameraSectionVisible(mode === 'manual');
      // Reset camera to manual drone when switching to RL mode
      if (mode === 'rl') {
        this.cameraTarget = 'manual';
        this.ui.setCameraTarget('manual');
      }
      console.log(`Pilot mode: ${mode}`);
    });
    
    this.ui.on('cameraTargetChange', (target) => {
      this.cameraTarget = target;
      console.log(`Camera following: ${target}`);
    });
    
    this.ui.on('trainingToggle', (enabled) => {
      this.trainingEnabled = enabled;
      console.log(`Training ${enabled ? 'enabled' : 'disabled'}`);
    });
    
    this.ui.on('learnFromManualToggle', (enabled) => {
      this.learnFromManual = enabled;
      console.log(`Learn from manual ${enabled ? 'enabled' : 'disabled'}`);
    });
    
    this.ui.on('lidarToggle', (enabled) => {
      this.lidar.setVisualizationEnabled(enabled);
    });
    
    this.ui.on('resetTraining', () => this.resetTraining());
    this.ui.on('exportModel', () => this.exportModel());
    this.ui.on('importModel', (file) => this.importModel(file));
    
    // Keyboard input
    this.ui.on('keydown', (key) => this.handleKeyDown(key));
    this.ui.on('keyup', (key) => this.handleKeyUp(key));
    
    // Set initial drone color to match default manual mode
    this.drone.setMode('manual');
    
    // Ghost drone is visible by default (manual mode)
    this.ghostDrone.setVisible(true);
    // Camera section is visible by default (manual mode)
    this.ui.setCameraSectionVisible(true);
  }

  /**
   * Reset current episode
   */
  resetEpisode() {
    if (this.isRegenerating) return;
    
    this.currentObservation = this.rlEnvironment.reset();
    
    // Sync ghost drone to main drone position
    this.ghostDrone.syncFrom(this.drone);
    
    console.log('Episode reset');
  }

  /**
   * Reset all training
   */
  resetTraining() {
    this.rlAgent.clearBuffer();
    this.rlAgent.trainingStep = 0;
    this.rlAgent.trainingHistory = {
      policyLoss: [],
      valueLoss: [],
      avgReward: [],
      successRate: [],
    };
    this.rlAgent.explorationRate = RL_CONFIG.INITIAL_EXPLORATION;
    
    // Rebuild networks
    this.rlAgent.build();
    
    // Reset environment stats
    this.rlEnvironment.totalEpisodes = 0;
    this.rlEnvironment.successfulEpisodes = 0;
    this.rlEnvironment.totalReward = 0;
    this.rlEnvironment.recentRewards = [];
    
    // Reset episode
    this.resetEpisode();
    
    console.log('Training reset');
    this.ui.setTrainingStatus('Training reset');
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
      // Get the specific collision type from the drone
      const collisionType = this.drone.getLastCollisionType() || 'obstacle';
      this.ui.showCollisionSplash(collisionType);
    } else if (info.reason === 'timeout') {
      this.ui.showTimeoutSplash();
    }
    
    // Track episodes since scene change
    this.episodesSinceSceneChange++;
    
    // Regenerate scene periodically
    const shouldRegenerate = this.episodesSinceSceneChange >= RL_CONFIG.EPISODES_PER_SCENE;
    
    setTimeout(() => {
      if (shouldRegenerate) {
        this.regenerateScene();
        this.episodesSinceSceneChange = 0;
      }
      
      // Reset for new episode
      this.currentObservation = this.rlEnvironment.reset();
      
      // Sync ghost drone
      this.ghostDrone.syncFrom(this.drone);
      
      this.isRegenerating = false;
    }, 600);
  }

  /**
   * Handle drone collision
   */
  handleCollision(type) {
    // Collision is handled in the step function through episode termination
    console.log(`Collision detected: ${type}`);
  }

  /**
   * Export model to file
   */
  async exportModel() {
    const success = await this.rlAgent.exportToFile();
    if (success) {
      this.ui.setTrainingStatus('Model exported!');
    } else {
      this.ui.setTrainingStatus('Export failed');
    }
  }

  /**
   * Import model from file
   */
  async importModel(file) {
    this.ui.setTrainingStatus('Importing model...');
    
    const success = await this.rlAgent.importFromFile(file);
    if (success) {
      this.ui.setTrainingStatus('Model imported!');
      this.ui.setModelStatus('Imported');
    } else {
      this.ui.setTrainingStatus('Import failed');
    }
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
      case 'shift':
        this.manualInput.up = true;
        break;
      case 'control':
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
      case 'shift':
        this.manualInput.up = false;
        break;
      case 'control':
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
   * Get RL agent action
   */
  getRLAction() {
    return this.rlAgent.selectAction(this.currentObservation, this.trainingEnabled);
  }
  
  /**
   * Get action from current mode
   */
  getAction() {
    if (this.driverMode === 'manual') {
      return this.getManualAction();
    } else {
      return this.getRLAction();
    }
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
    
    if (!this.isRegenerating) {
      this.update(deltaTime);
    }
    
    // Render (only once per frame)
    this.sceneManager.render();
  }

  /**
   * Update simulation state
   */
  update(dt) {
    // Get action for main drone
    const action = this.getAction();
    
    // In manual mode, also update ghost drone with RL action
    if (this.driverMode === 'manual') {
      // Keep ghost drone yaw synced with main drone (neither rotates)
      this.ghostDrone.setYaw(this.drone.yaw);
      
      const rlAction = this.getRLAction();
      this.ghostDrone.setControls(rlAction[0], rlAction[1], rlAction[2]);
      this.ghostDrone.update(dt);
      this.enforceGhostBounds();
    }
    
    // Take step in environment
    const { observation, reward, done, info } = this.rlEnvironment.step(action, dt);
    
    // Store experience for training
    // In RL mode: always store if training enabled
    // In manual mode: store if learnFromManual is enabled (to teach from demonstrations)
    const shouldStoreExperience = 
      (this.driverMode === 'rl' && this.trainingEnabled) ||
      (this.driverMode === 'manual' && this.learnFromManual);
    
    if (shouldStoreExperience) {
      this.rlAgent.storeExperience(
        this.currentObservation,
        action,
        reward,
        observation,
        done
      );
      
      // Train periodically
      this.stepsSinceLastTrain++;
      if (this.stepsSinceLastTrain >= RL_CONFIG.TRAIN_INTERVAL && this.trainingEnabled) {
        this.rlAgent.train();
        this.stepsSinceLastTrain = 0;
      }
    }
    
    // Update observation
    this.currentObservation = observation;
    
    // Handle episode end
    if (done) {
      this.handleEpisodeEnd(info);
    }
    
    // Keep drone in bounds
    this.enforceBounds();
    
    // Update camera based on selected target
    const cameraState = this.cameraTarget === 'ghost' && this.driverMode === 'manual'
      ? this.ghostDrone.getState()
      : this.drone.getState();
    
    this.sceneManager.followTarget(
      cameraState.x,
      cameraState.y,
      cameraState.z,
      cameraState.yaw,
      'chase'
    );
    
    // Update UI
    this.updateUI();
  }

  /**
   * Update UI displays
   */
  updateUI() {
    const state = this.drone.getState();
    const envStats = this.rlEnvironment.getStats();
    const agentStats = this.rlAgent.getStats();
    const distToTarget = this.rlEnvironment.getDistanceToTarget();
    
    // Drone stats
    this.ui.updateDroneStats(state.speed, state.y, distToTarget);
    
    // RL stats
    this.ui.updateRLStats(envStats);
    this.ui.updateAgentStats(agentStats);
    
    // Navigation status
    const modeLabel = this.driverMode === 'manual' ? 'Manual' : 'RL Agent';
    this.ui.updateNavigation(distToTarget, modeLabel);
    
    // Model status
    if (this.trainingEnabled && agentStats.trainingStep > 0) {
      this.ui.setModelStatus(`Training (${agentStats.trainingStep} steps)`);
    } else if (agentStats.trainingStep > 0) {
      this.ui.setModelStatus('Trained');
    }
  }

  /**
   * Keep drone within forest bounds
   * NOTE: Only enforces horizontal bounds and minimum height.
   * There is NO ceiling - the drone can fly as high as it wants.
   * Collision detection handles terrain and obstacle collisions.
   */
  enforceBounds() {
    const state = this.drone.getState();
    const margin = 5;
    const halfSize = FOREST.SIZE / 2 - margin;
    
    let x = state.x;
    let y = state.y;
    let z = state.z;
    let changed = false;
    
    // Horizontal bounds only
    if (x < -halfSize) { x = -halfSize; changed = true; }
    if (x > halfSize) { x = halfSize; changed = true; }
    if (z < -halfSize) { z = -halfSize; changed = true; }
    if (z > halfSize) { z = halfSize; changed = true; }
    
    // Minimum height only (no ceiling!)
    // The collision system handles terrain collision properly,
    // but we add a safety minimum to prevent going underground
    const groundY = this.forestGenerator.getTerrainHeight(x, z);
    const minY = groundY + 0.5; // Small margin above ground
    
    if (y < minY) { 
      y = minY; 
      changed = true; 
    }
    
    // NO CEILING - drone can fly freely upward
    // The RL reward system penalizes high altitude flying instead
    
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
