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
    
    // Performance logging
    this.perfLog = {
      update: 0,
      render: 0,
      envStep: 0,
      ghostUpdate: 0,
      camera: 0,
      ui: 0,
    };
    this.perfLogInterval = 60; // Log every N frames
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
    
    let t0, t1;
    
    if (!this.episodeManager.isInRegeneration()) {
      t0 = performance.now();
      this.update(deltaTime);
      t1 = performance.now();
      this.perfLog.update += t1 - t0;
    }
    
    t0 = performance.now();
    this.components.sceneManager.render();
    t1 = performance.now();
    this.perfLog.render += t1 - t0;
    
    // Log performance periodically
    if (this.frameCounter % this.perfLogInterval === 0) {
      this.logPerformance();
    }
  }
  
  /**
   * Log performance metrics
   */
  logPerformance() {
    const n = this.perfLogInterval;
    console.log(`[PERF] Avg over ${n} frames:`,
      `update=${(this.perfLog.update / n).toFixed(2)}ms`,
      `(env=${(this.perfLog.envStep / n).toFixed(2)}ms`,
      `ghost=${(this.perfLog.ghostUpdate / n).toFixed(2)}ms`,
      `cam=${(this.perfLog.camera / n).toFixed(2)}ms`,
      `ui=${(this.perfLog.ui / n).toFixed(2)}ms)`,
      `render=${(this.perfLog.render / n).toFixed(2)}ms`
    );
    // Reset counters
    this.perfLog.update = 0;
    this.perfLog.render = 0;
    this.perfLog.envStep = 0;
    this.perfLog.ghostUpdate = 0;
    this.perfLog.camera = 0;
    this.perfLog.ui = 0;
  }

  /**
   * Update simulation state
   */
  update(dt) {
    const { drone, ghostDrone, rlEnvironment } = this.components;
    
    let t0, t1;
    
    // Get manual action
    const action = this.inputController.getAction();
    
    // Take step in environment
    t0 = performance.now();
    const { observation, done, info } = rlEnvironment.step(action, dt);
    t1 = performance.now();
    this.perfLog.envStep += t1 - t0;
    
    this.episodeManager.setObservation(observation);
    
    // Update ghost drone if model loaded
    if (this.trainingController.hasLoadedModel && ghostDrone.isVisible()) {
      t0 = performance.now();
      this.ghostController.update(dt, drone);
      this.boundsEnforcer.enforce(ghostDrone);
      t1 = performance.now();
      this.perfLog.ghostUpdate += t1 - t0;
    }
    
    // Handle episode end
    if (done) {
      this.episodeManager.handleEnd(info, drone);
    }
    
    // Keep drones in bounds
    this.boundsEnforcer.enforce(drone);
    
    // Update camera
    t0 = performance.now();
    this.updateCamera();
    t1 = performance.now();
    this.perfLog.camera += t1 - t0;
    
    // Update UI periodically
    if (this.frameCounter % this.uiUpdateInterval === 0) {
      t0 = performance.now();
      this.updateUI();
      t1 = performance.now();
      this.perfLog.ui += t1 - t0;
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
