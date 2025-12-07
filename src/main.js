/**
 * Main entry point - Drone RL Navigation Simulation
 * 
 * Modes:
 * - Simulation: Manual drone + optional ghost RL drone (when model loaded)
 * - Training: Offline RL training with progress UI
 */
import {
  InputController,
  GhostDroneController,
  BoundsEnforcer,
  TrainingController,
  EpisodeManager,
  ComponentFactory
} from './simulation/index.js';

class Simulation {
  constructor() {
    // Components (initialized in init())
    this.components = null;
    
    // Controllers
    this.inputController = null;
    this.ghostController = null;
    this.boundsEnforcer = null;
    this.trainingController = null;
    this.episodeManager = null;
    
    // State
    this.isRunning = false;
    this.lastTime = 0;
    this.currentSeed = 42;
    this.cameraTarget = 'manual';
    
    // Performance
    this.frameCounter = 0;
    this.uiUpdateInterval = 30;
  }

  /**
   * Initialize the simulation
   */
  async init() {
    console.log('Initializing Drone Navigator...');
    
    // Create all components
    const container = document.getElementById('canvas-container');
    this.components = ComponentFactory.create(container, this.currentSeed);
    
    // Create controllers
    this.setupControllers();
    this.setupUICallbacks();
    
    // Set collision callback
    this.components.drone.setOnCollision((type) => {
      console.log(`Collision detected: ${type}`);
    });
    
    // Reset environment for first episode
    this.episodeManager.reset();
    
    // Start simulation
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
    
    console.log('Simulation initialized!');
    console.log('Use WASD/QZ to fly. Load a model or train one to see the RL ghost drone.');
  }

  /**
   * Setup controllers
   */
  setupControllers() {
    const { drone, ghostDrone, rlAgent, rlEnvironment, forestGenerator, ui } = this.components;
    
    // Input controller
    this.inputController = new InputController();
    this.inputController.setOnReset(() => this.episodeManager.reset());
    
    // Bounds enforcer
    this.boundsEnforcer = new BoundsEnforcer(forestGenerator);
    
    // Episode manager
    this.episodeManager = new EpisodeManager(rlEnvironment, ui);
    this.episodeManager.onReset = () => {
      if (this.trainingController?.hasLoadedModel) {
        this.ghostController.syncToMainDrone(drone);
      }
    };
    
    // Ghost drone controller
    this.ghostController = new GhostDroneController(ghostDrone, rlAgent, rlEnvironment);
    
    // Training controller
    this.trainingController = new TrainingController(rlAgent, rlEnvironment, forestGenerator);
    this.trainingController.onTrainingStart = () => {
      this.isRunning = false;
      ui.showTrainingScreen();
    };
    this.trainingController.onTrainingStop = () => {
      ui.hideTrainingScreen();
      this.resumeSimulation();
    };
    this.trainingController.onModelLoaded = () => {
      ghostDrone.setVisible(true);
      this.ghostController.syncToMainDrone(drone);
    };
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    const { ui, lidar } = this.components;
    
    ui.on('newTarget', () => this.episodeManager.reset());
    ui.on('reset', () => this.episodeManager.reset());
    
    ui.on('cameraTargetChange', (target) => {
      this.cameraTarget = target;
      console.log(`Camera following: ${target}`);
    });
    
    ui.on('lidarToggle', (enabled) => {
      lidar.setVisualizationEnabled(enabled);
    });
    
    ui.on('startTraining', () => this.trainingController.start(ui));
    ui.on('stopTraining', () => this.trainingController.stop());
    ui.on('downloadModel', () => this.trainingController.downloadModel(ui));
    ui.on('importModel', (file) => this.trainingController.importModel(file, ui));
    
    // Keyboard input
    ui.on('keydown', (key) => this.inputController.handleKeyDown(key));
    ui.on('keyup', (key) => this.inputController.handleKeyUp(key));
  }

  /**
   * Resume simulation after training
   */
  resumeSimulation() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.episodeManager.reset();
    this.animate();
  }

  /**
   * Main animation loop
   */
  animate() {
    if (!this.isRunning) return;
    
    requestAnimationFrame(() => this.animate());
    
    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    this.frameCounter++;
    
    if (!this.episodeManager.isInRegeneration()) {
      this.update(deltaTime);
    }
    
    this.components.sceneManager.render();
  }

  /**
   * Update simulation state
   */
  update(dt) {
    const { drone, ghostDrone, rlEnvironment } = this.components;
    
    // Get manual action
    const action = this.inputController.getAction();
    
    // Take step in environment
    const { observation, done, info } = rlEnvironment.step(action, dt);
    this.episodeManager.setObservation(observation);
    
    // Update ghost drone if model loaded
    if (this.trainingController.hasLoadedModel && ghostDrone.isVisible()) {
      this.ghostController.update(dt, drone);
      this.boundsEnforcer.enforce(ghostDrone);
    }
    
    // Handle episode end
    if (done) {
      this.episodeManager.handleEnd(info, drone);
    }
    
    // Keep drones in bounds
    this.boundsEnforcer.enforce(drone);
    
    // Update camera
    this.updateCamera();
    
    // Update UI periodically
    if (this.frameCounter % this.uiUpdateInterval === 0) {
      this.updateUI();
    }
  }

  /**
   * Update camera to follow selected target
   */
  updateCamera() {
    const { drone, ghostDrone, sceneManager } = this.components;
    
    let targetDrone = drone;
    if (this.cameraTarget === 'ghost' && this.trainingController.hasLoadedModel) {
      targetDrone = ghostDrone;
    }
    
    const state = targetDrone.getState();
    sceneManager.followTarget(state.x, state.y, state.z, state.yaw, 'chase');
  }

  /**
   * Update UI displays
   */
  updateUI() {
    const { drone, rlEnvironment, ui } = this.components;
    
    const state = drone.getState();
    const distToTarget = rlEnvironment.getDistanceToTarget();
    
    // Drone stats
    ui.updateDroneStats(state.speed, state.y, distToTarget);
    
    // Ghost drone stats
    if (this.trainingController.hasLoadedModel) {
      const ghostDist = this.ghostController.getDistanceToTarget();
      ui.updateGhostStats(ghostDist, 'Active');
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
    const collisionSystem = sim.components.drone.getCollisionSystem();
    collisionSystem.setDebugEnabled(true);
    collisionSystem.createDebugHelpers(sim.components.sceneManager.scene);
    console.log('Collision debug visualization enabled');
  };
  
  window.disableCollisionDebug = () => {
    const collisionSystem = sim.components.drone.getCollisionSystem();
    collisionSystem.setDebugEnabled(false);
    collisionSystem.clearDebugHelpers();
    console.log('Collision debug visualization disabled');
  };
  
  console.log('Debug helpers available: enableCollisionDebug(), disableCollisionDebug()');
});
