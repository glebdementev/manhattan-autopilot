/**
 * Main entry point - Drone Navigation with Reactive Obstacle Avoidance
 * 
 * The drone uses LIDAR-based reactive navigation to reach targets
 * while avoiding obstacles in the forest.
 */
import {
  InputController,
  BoundsEnforcer,
  EpisodeManager,
  ComponentFactory
} from './simulation/index.js';
import { LIDAR } from './config.js';

class Simulation {
  constructor() {
    // Components (initialized in init())
    this.components = null;
    
    // Controllers
    this.inputController = null;
    this.boundsEnforcer = null;
    this.episodeManager = null;
    
    // State
    this.isRunning = false;
    this.lastTime = 0;
    this.currentSeed = 42;
    
    // Performance
    this.frameCounter = 0;
    this.uiUpdateInterval = 30;
    
    // Performance logging
    this.perfLog = {
      update: 0,
      render: 0,
      navStep: 0,
      camera: 0,
      ui: 0,
    };
    this.perfLogInterval = 60;
  }

  /**
   * Initialize the simulation
   */
  async init() {
    console.log('Initializing Drone Navigator with Pathfinding...');
    
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
    console.log('Drone will navigate reactively using LIDAR. Use WASD/QZ for manual override.');
  }

  /**
   * Setup controllers
   */
  setupControllers() {
    const { drone, navEnvironment, forestGenerator, ui } = this.components;
    
    // Input controller
    this.inputController = new InputController();
    this.inputController.setOnReset(() => this.episodeManager.reset());
    
    // Bounds enforcer
    this.boundsEnforcer = new BoundsEnforcer(forestGenerator);
    
    // Episode manager
    this.episodeManager = new EpisodeManager(navEnvironment, ui);
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    const { ui, lidar } = this.components;
    
    ui.on('newTarget', () => this.episodeManager.reset());
    ui.on('reset', () => this.episodeManager.reset());
    
    ui.on('lidarToggle', (enabled) => {
      lidar.setVisualizationEnabled(enabled);
    });
    
    // Keyboard input
    ui.on('keydown', (key) => this.inputController.handleKeyDown(key));
    ui.on('keyup', (key) => this.inputController.handleKeyUp(key));
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
      `(nav=${(this.perfLog.navStep / n).toFixed(2)}ms`,
      `cam=${(this.perfLog.camera / n).toFixed(2)}ms`,
      `ui=${(this.perfLog.ui / n).toFixed(2)}ms)`,
      `render=${(this.perfLog.render / n).toFixed(2)}ms`
    );
    // Reset counters
    this.perfLog.update = 0;
    this.perfLog.render = 0;
    this.perfLog.navStep = 0;
    this.perfLog.camera = 0;
    this.perfLog.ui = 0;
  }

  /**
   * Update simulation state
   */
  update(dt) {
    const { drone, navEnvironment } = this.components;
    
    let t0, t1;
    
    // Get manual input (can override autopilot)
    const manualAction = this.inputController.getAction();
    
    // Take step in navigation environment
    t0 = performance.now();
    const { observation, done, info } = navEnvironment.step(manualAction, dt);
    t1 = performance.now();
    this.perfLog.navStep += t1 - t0;
    
    this.episodeManager.setObservation(observation);
    
    // Handle episode end
    if (done) {
      // On success, regenerate the environment (new forest) before resetting,
      // which will also generate a fresh target via navEnvironment.reset().
      if (info && info.success) {
        this.currentSeed += 1;
        const { forestGenerator, raycastTargets } =
          ComponentFactory.regenerateForest(this.components, this.currentSeed);
        this.components.forestGenerator = forestGenerator;
        this.components.raycastTargets = raycastTargets;
      }
      
      this.episodeManager.handleEnd(info, drone);
    }
    
    // Keep drone in bounds
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
   * Update camera to follow drone
   */
  updateCamera() {
    const { drone, sceneManager } = this.components;
    const state = drone.getState();
    sceneManager.followTarget(state.x, state.y, state.z, state.yaw, 'chase');
  }

  /**
   * Update UI displays
   */
  updateUI() {
    const { drone, navEnvironment, ui } = this.components;
    
    const state = drone.getState();
    const distToTarget = navEnvironment.getDistanceToTarget();
    
    // Drone stats
    ui.updateDroneStats(state.speed, state.y, distToTarget);
    
    // Update navigation display
    this.updateNavigationDisplay();
  }
  
  /**
   * Update navigation display - shows reactive navigation status
   */
  updateNavigationDisplay() {
    const { drone, navEnvironment, ui, lidar } = this.components;
    
    const state = drone.getState();
    const targetDir = navEnvironment.getTargetDirection();
    const distToTarget = navEnvironment.getDistanceToTarget();
    const canSeeTarget = navEnvironment.canSeeTarget();
    
    const obsData = {
      // Target info
      distToTarget,
      targetDir,
      canSeeTarget,
      
      // Lidar
      minObstacleDist: lidar.getMinDistance(),
      maxRange: LIDAR.MAX_RANGE,
      
      // Vertical sensors
      nadirDist: lidar.getNadirDistance(),
      
      // World velocity (normalized)
      velocity: {
        vx: state.vx || 0,
        vy: state.vy || 0,
        vz: state.vz || 0,
      },
    };
    
    ui.updateObservationDisplay(obsData);
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  const sim = new Simulation();
  await sim.init();
  window.sim = sim;
});
