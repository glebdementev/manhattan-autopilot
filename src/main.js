/**
 * Main entry point - Drone Navigation
 * 
 * Two navigation modes:
 * 1. Omniscient (A*) - Perfect pathfinding with full environment knowledge
 * 2. Learned Model - Neural network trained on omniscient paths
 */
import {
  InputController,
  BoundsEnforcer,
  EpisodeManager,
  ComponentFactory
} from './simulation/index.js';
import {
  OmniscientPathGenerator,
  OmniscientController,
  PathFollowingController,
  TrainingOrchestrator
} from './omniscient/index.js';

class Simulation {
  constructor() {
    this.components = null;
    
    // Controllers
    this.inputController = null;
    this.boundsEnforcer = null;
    this.episodeManager = null;
    
    // Navigation controllers
    this.pathGenerator = null;
    this.omniscientController = null;
    this.learnedController = null;
    this.trainingOrchestrator = null;
    
    // Current mode: 'omniscient' or 'learned'
    this.navigationMode = 'omniscient';
    
    // State
    this.isRunning = false;
    this.lastTime = 0;
    this.currentSeed = 42;
    this.frameCounter = 0;
    this.uiUpdateInterval = 30;
  }

  async init() {
    console.log('Initializing Drone Navigator...');
    
    const container = document.getElementById('canvas-container');
    this.components = ComponentFactory.create(container, this.currentSeed);
    
    this.setupControllers();
    this.setupNavigation();
    this.setupUICallbacks();
    
    this.components.drone.setOnCollision((type) => {
      console.log(`Collision: ${type}`);
    });
    
    // Start with omniscient mode
    this.setNavigationMode('omniscient');
    this.episodeManager.reset();
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
    
    console.log('Ready! Use left panel to switch between Omniscient and Learned modes.');
  }

  setupControllers() {
    const { drone, navEnvironment, forestGenerator, ui } = this.components;
    
    this.inputController = new InputController();
    this.inputController.setOnReset(() => this.episodeManager.reset());
    
    this.boundsEnforcer = new BoundsEnforcer(forestGenerator);
    this.episodeManager = new EpisodeManager(navEnvironment, ui);
  }

  setupNavigation() {
    const { drone, lidar, forestGenerator, sceneManager, navEnvironment } = this.components;
    
    // Create path generator
    this.pathGenerator = new OmniscientPathGenerator(forestGenerator);
    // Share path generator with navigation environment for target validation
    if (navEnvironment && navEnvironment.setPathChecker) {
      navEnvironment.setPathChecker(this.pathGenerator);
    }
    
    // Create omniscient controller
    this.omniscientController = new OmniscientController(drone, this.pathGenerator);
    
    // Create training orchestrator (includes learned controller)
    this.trainingOrchestrator = new TrainingOrchestrator(
      drone, lidar, forestGenerator, sceneManager
    );
    
    // Try to load existing model
    this.trainingOrchestrator.load().then(loaded => {
      if (loaded) {
        console.log('Loaded trained model');
        this.createLearnedController();
        this.components.ui.enableSave(true);
        this.components.ui.enableDownload(true);
        this.components.ui.updateTrainingStats(this.trainingOrchestrator.getStats());
        this.components.ui.setModelReady(true);
      }
    });
  }

  createLearnedController() {
    const { drone } = this.components;
    const predictor = this.trainingOrchestrator.getPredictor();
    
    if (predictor.isReady()) {
      // Path-following controller: receives path waypoints, learns to follow them
      this.learnedController = new PathFollowingController(
        drone, predictor, this.pathGenerator
      );
    }
  }

  setNavigationMode(mode) {
    this.navigationMode = mode;
    const { navEnvironment } = this.components;
    
    if (mode === 'omniscient') {
      navEnvironment.setController(this.omniscientController);
      console.log('Mode: Omniscient (A*)');
    } else if (mode === 'learned' && this.learnedController) {
      navEnvironment.setController(this.learnedController);
      console.log('Mode: Learned Model');
    } else {
      console.warn('Learned model not ready, staying in omniscient mode');
      this.navigationMode = 'omniscient';
      navEnvironment.setController(this.omniscientController);
      this.components.ui.setMode('omniscient');
    }

    // Keep path visualization in sync with active mode
    this.updatePathVisualization();
  }

  setupUICallbacks() {
    const { ui, lidar, pathVisualizer } = this.components;
    
    // Mode change
    ui.on('modeChange', (mode) => {
      this.setNavigationMode(mode);
      this.episodeManager.reset();
    });
    
    // Navigation
    ui.on('newTarget', () => this.episodeManager.reset());
    ui.on('reset', () => this.episodeManager.reset());
    
    // Display toggles
    ui.on('lidarToggle', (enabled) => lidar.setVisualizationEnabled(enabled));
    ui.on('pathToggle', (enabled) => {
      if (pathVisualizer) {
        pathVisualizer.setEnabled(enabled);
        // Immediately reflect current path state
        this.updatePathVisualization();
      }
    });
    
    // Modal open/close - pause/resume game
    ui.on('modalOpen', () => this.pauseGame());
    ui.on('modalClose', () => this.resumeGame());
    
    // Training
    ui.on('generateData', (episodes) => this.generateTrainingData(episodes));
    ui.on('trainModel', (epochs) => this.trainModel(epochs));
    ui.on('saveModel', () => this.saveModel());
    ui.on('uploadModel', (files) => this.loadModelFromFiles(files));
    ui.on('downloadModel', () => this.downloadModel());
    ui.on('lidarConfigChange', (config) => this.updateLidarConfig(config));
    
    // Keyboard
    ui.on('keydown', (key) => this.inputController.handleKeyDown(key));
    ui.on('keyup', (key) => this.inputController.handleKeyUp(key));
  }

  pauseGame() {
    this.isRunning = false;
  }

  resumeGame() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.animate();
    }
  }

  async generateTrainingData(numEpisodes) {
    const { ui } = this.components;
    
    ui.setGenerating(true);
    
    this.trainingOrchestrator.onProgress = (progress) => {
      ui.showProgress(
        `Generating paths (${progress.stats.successfulPaths}/${progress.episode})`,
        progress.progress
      );
      ui.updateTrainingStats(progress.stats);
    };
    
    try {
      const stats = await this.trainingOrchestrator.generateTrainingData(numEpisodes);
      console.log(`Generated ${stats.totalSamples} samples`);
      ui.enableTrain(stats.totalSamples > 0);
    } catch (e) {
      console.error('Generation failed:', e);
    }
    
    ui.hideProgress();
    ui.setGenerating(false);
  }

  async trainModel(epochs) {
    const { ui } = this.components;
    
    ui.setTraining(true);
    
    try {
      await this.trainingOrchestrator.trainModel({
        epochs,
        batchSize: 64,
        validationSplit: 0.1,
        onEpochEnd: (epoch, logs) => {
          ui.showProgress(`Training epoch ${epoch + 1}/${epochs}`, (epoch + 1) / epochs);
          ui.updateTrainingStats({
            ...this.trainingOrchestrator.getStats(),
            trainingLoss: logs.loss,
          });
        },
      });
      
      console.log('Training complete');
      this.createLearnedController();
      ui.enableSave(true);
      ui.enableDownload(true);
      ui.setModelReady(true);
    } catch (e) {
      console.error('Training failed:', e);
    }
    
    ui.hideProgress();
    ui.setTraining(false);
  }

  async saveModel() {
    try {
      await this.trainingOrchestrator.save();
      await this.trainingOrchestrator.saveToFiles();
      console.log('Model saved to browser and downloaded');
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  async loadModel() {
    const loaded = await this.trainingOrchestrator.load();
    if (loaded) {
      console.log('Model loaded');
      this.createLearnedController();
      this.components.ui.enableSave(true);
      this.components.ui.enableDownload(true);
      this.components.ui.updateTrainingStats(this.trainingOrchestrator.getStats());
      this.components.ui.setModelReady(true);
    }
  }

  async downloadModel() {
    try {
      await this.trainingOrchestrator.saveToFiles();
      this.components.ui.enableDownload(true);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }

  async loadModelFromFiles(files) {
    const loaded = await this.trainingOrchestrator.loadFromFiles(files);
    if (loaded) {
      console.log('Model loaded from files');
      this.createLearnedController();
      this.components.ui.enableSave(true);
      this.components.ui.enableDownload(true);
      this.components.ui.updateTrainingStats(this.trainingOrchestrator.getStats());
      this.components.ui.setModelReady(true);
    }
  }

  updateLidarConfig(config) {
    const applied = this.components.lidar.updateConfig(config);
    this.components.ui.setLidarConfig(applied);
    this.components.lidar.scan();
  }

  animate() {
    if (!this.isRunning) return;
    
    requestAnimationFrame(() => this.animate());
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    this.frameCounter++;
    
    if (!this.episodeManager.isInRegeneration()) {
      this.update(deltaTime);
    }
    
    this.components.sceneManager.render();
  }

  update(dt) {
    const { drone, navEnvironment } = this.components;
    
    const manualAction = this.inputController.getAction();
    const { observation, done, info } = navEnvironment.step(manualAction, dt);

    // Update omniscient path visualization (if enabled)
    this.updatePathVisualization();
    
    this.episodeManager.setObservation(observation);
    
    if (done) {
      if (info && info.success) {
        this.currentSeed += 1;
        const { forestGenerator, raycastTargets } =
          ComponentFactory.regenerateForest(this.components, this.currentSeed);
        this.components.forestGenerator = forestGenerator;
        this.components.raycastTargets = raycastTargets;
        
        // Update path generator and training orchestrator
        this.pathGenerator = new OmniscientPathGenerator(forestGenerator);
        this.omniscientController = new OmniscientController(drone, this.pathGenerator);
        this.trainingOrchestrator.setForest(forestGenerator);
        
        // Keep navigation environment using the same path generator for target validation
        if (navEnvironment && navEnvironment.setPathChecker) {
          navEnvironment.setPathChecker(this.pathGenerator);
        }
        
        // Recreate learned controller with new path generator
        this.createLearnedController();
        
        // Re-set controller
        this.setNavigationMode(this.navigationMode);
      }
      
      this.episodeManager.handleEnd(info, drone);
    }
    
    this.boundsEnforcer.enforce(drone);
    this.updateCamera();
    
    if (this.frameCounter % this.uiUpdateInterval === 0) {
      this.updateUI();
    }
  }

  updatePathVisualization() {
    const { pathVisualizer } = this.components;
    if (!pathVisualizer) return;

    if (this.navigationMode === 'omniscient' && this.omniscientController) {
      const path = this.omniscientController.getPath();
      pathVisualizer.updatePath(path);
    } else if (this.navigationMode === 'learned' && this.learnedController) {
      // Path-following controller also has the path
      const path = this.learnedController.getPath();
      pathVisualizer.updatePath(path);
    } else {
      pathVisualizer.updatePath(null);
    }
  }

  updateCamera() {
    const { drone, sceneManager } = this.components;
    const state = drone.getState();
    sceneManager.followTarget(state.x, state.y, state.z, state.yaw, 'chase');
  }

  updateUI() {
    const { drone, navEnvironment, ui } = this.components;
    
    const state = drone.getState();
    const distToTarget = navEnvironment.getDistanceToTarget();
    
    ui.updateDroneStats(state.speed, state.y, distToTarget);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const sim = new Simulation();
  await sim.init();
  window.sim = sim;
});
