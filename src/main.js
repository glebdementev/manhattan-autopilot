/**
 * Main entry point - Forest Drone Navigation Simulation
 * A drone navigates through a procedurally generated forest
 */
import { SIMULATION, FOREST } from './config.js';

// Forest
import { ForestGenerator } from './forest/ForestGenerator.js';

// Vehicle
import { Drone } from './vehicle/Drone.js';
import { Lidar } from './vehicle/Lidar.js';
import { DroneController } from './vehicle/DroneController.js';

// Autopilot
import { AutopilotModel } from './autopilot/AutopilotModel.js';
import { DataRecorder } from './autopilot/DataRecorder.js';
import { Trainer } from './autopilot/Trainer.js';

// Scene & UI
import { SceneManager } from './scene/SceneManager.js';
import { UIManager } from './ui/UIManager.js';

class Simulation {
  constructor() {
    // Components
    this.sceneManager = null;
    this.forestGenerator = null;
    this.drone = null;
    this.lidar = null;
    this.controller = null;
    this.autopilot = null;
    this.dataRecorder = null;
    this.trainer = null;
    this.ui = null;
    
    // State
    this.driverMode = 'classic'; // 'classic', 'autopilot', 'manual'
    this.cameraMode = 'chase';   // 'chase', 'bird'
    this.isRunning = false;
    this.lastTime = 0;
    
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
    
    // Target reached flag
    this.isRegeneratingTarget = false;
  }

  /**
   * Initialize the simulation
   */
  async init() {
    console.log('Initializing Forest Drone Navigation...');
    
    // Create scene
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);
    
    // Generate forest
    console.log('Generating forest...');
    this.forestGenerator = new ForestGenerator(42);
    const forest = this.forestGenerator.generate();
    this.sceneManager.add(forest);
    
    // Create drone
    console.log('Creating drone...');
    this.drone = new Drone();
    this.sceneManager.add(this.drone.getMesh());
    
    // Create LiDAR
    this.lidar = new Lidar(this.drone);
    this.sceneManager.add(this.lidar.getVisualGroup());
    
    // Get raycast targets
    this.raycastTargets = this.forestGenerator.getRaycastTargets();
    
    // Create controller
    this.controller = new DroneController(this.drone, this.forestGenerator);
    
    // Create autopilot components
    console.log('Initializing autopilot...');
    this.autopilot = new AutopilotModel();
    this.dataRecorder = new DataRecorder();
    this.trainer = new Trainer(this.autopilot, this.dataRecorder);
    
    // Setup trainer callbacks
    this.trainer.setCallbacks({
      onTrainingStart: () => {
        this.ui.setTrainingStatus('Training...');
        this.ui.setModelStatus('Training...');
        this.ui.setInstantTrainEnabled(false);
      },
      onTrainingProgress: (epoch, total, loss) => {
        this.ui.setTrainingStatus(`Epoch ${epoch}/${total}`);
        this.ui.updateTrainingStats(this.dataRecorder.getDataSize(), loss);
      },
      onTrainingComplete: () => {
        this.ui.setTrainingStatus('Training complete!');
        this.ui.setInstantTrainEnabled(true);
        this.updateModelStatus();
      },
      onSyntheticDataGenerated: (count, timeMs) => {
        this.ui.setTrainingStatus(`Generated ${count} samples in ${timeMs.toFixed(0)}ms`);
        this.ui.updateTrainingStats(this.dataRecorder.getDataSize(), null);
      },
    });
    
    // Create UI
    this.ui = new UIManager();
    this.setupUICallbacks();
    
    // Set initial position and target
    this.resetDrone();
    this.generateNewTarget();
    
    // Start simulation
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
    
    console.log('Simulation initialized!');
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    this.ui.on('newTarget', () => this.generateNewTarget());
    this.ui.on('reset', () => this.resetSimulation());
    
    this.ui.on('driverModeChange', (mode) => {
      // Check if autopilot is available
      if (mode === 'autopilot' && !this.autopilot.isReady()) {
        console.warn('Autopilot not ready - falling back to classic');
        this.ui.setDriverMode('classic');
        this.ui.setTrainingStatus('Train a model first!');
        return;
      }
      
      this.driverMode = mode;
      this.drone.setMode(mode);
      console.log(`Pilot mode: ${mode}`);
    });
    
    this.ui.on('cameraModeChange', (mode) => {
      this.cameraMode = mode;
    });
    
    this.ui.on('lidarToggle', (enabled) => {
      this.lidar.setVisualizationEnabled(enabled);
    });
    
    this.ui.on('instantTrain', () => this.instantTrain());
    this.ui.on('exportModel', () => this.exportModel());
    this.ui.on('importModel', (file) => this.importModel(file));
    this.ui.on('downloadTrainingData', () => this.downloadTrainingData());
    
    // Keyboard input
    this.ui.on('keydown', (key) => this.handleKeyDown(key));
    this.ui.on('keyup', (key) => this.handleKeyUp(key));
    
    // Set initial drone color
    this.drone.setMode('classic');
  }

  /**
   * Reset drone to spawn position
   */
  resetDrone() {
    const spawnPos = this.forestGenerator.findSpawnPosition();
    this.drone.reset();
    this.drone.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
  }

  /**
   * Generate a new target
   */
  generateNewTarget() {
    const state = this.drone.getState();
    const target = this.forestGenerator.generateTargetPosition(state.x, state.z);
    
    this.controller.setTarget(target.x, target.y, target.z);
    this.sceneManager.setTargetPosition(target.x, target.y, target.z);
    
    console.log(`New target: (${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`);
    
    // If collecting data, start new episode
    if (this.trainer.isCollecting()) {
      this.trainer.onEpisodeStart();
    }
  }

  /**
   * Reset simulation
   */
  resetSimulation() {
    this.resetDrone();
    this.generateNewTarget();
  }

  /**
   * Instant train: generate synthetic data and train immediately
   */
  async instantTrain() {
    this.ui.setInstantTrainEnabled(false);
    this.ui.setTrainingStatus('Generating data & training...');
    
    setTimeout(async () => {
      this.trainer.generateSyntheticData(10000);
      await this.trainer.train(20);
    }, 10);
  }

  /**
   * Export model to downloadable file
   */
  async exportModel() {
    if (!this.autopilot.isReady()) {
      this.ui.setTrainingStatus('No model to export!');
      return;
    }
    
    const success = await this.autopilot.exportToFile();
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
    
    const success = await this.autopilot.importFromFile(file);
    if (success) {
      this.ui.setTrainingStatus('Model imported!');
      this.updateModelStatus();
    } else {
      this.ui.setTrainingStatus('Import failed');
    }
  }

  /**
   * Download training data as JSON file
   */
  downloadTrainingData() {
    const dataSize = this.dataRecorder.getDataSize();
    if (dataSize === 0) {
      this.ui.setTrainingStatus('No training data to download!');
      return;
    }
    
    const jsonData = this.dataRecorder.exportJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `drone-training-data-${dataSize}-samples.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    this.ui.setTrainingStatus(`Downloaded ${dataSize} samples`);
  }

  /**
   * Update model status in UI
   */
  updateModelStatus() {
    if (this.autopilot.isReady()) {
      this.ui.setModelStatus('Ready');
      this.ui.setAutopilotEnabled(true);
    } else {
      this.ui.setModelStatus('Not trained');
      this.ui.setAutopilotEnabled(false);
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
      case 'q':
        this.manualInput.up = true;
        break;
      case 'e':
        this.manualInput.down = true;
        break;
      case 'r':
        this.generateNewTarget();
        break;
      case 'c':
        this.cameraMode = this.cameraMode === 'chase' ? 'bird' : 'chase';
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
      case 'e':
        this.manualInput.down = false;
        break;
    }
  }

  /**
   * Get control commands based on current driver mode
   */
  getControlCommands() {
    if (this.driverMode === 'manual') {
      // Manual control: WASD for horizontal, QE for vertical
      let thrustX = 0;
      let thrustY = 0;
      let thrustZ = 0;
      
      if (this.manualInput.left) thrustX = -0.8;
      if (this.manualInput.right) thrustX = 0.8;
      if (this.manualInput.forward) thrustZ = 0.8;
      if (this.manualInput.backward) thrustZ = -0.8;
      if (this.manualInput.up) thrustY = 0.8;
      if (this.manualInput.down) thrustY = -0.5;
      
      return { thrustX, thrustY, thrustZ, actualMode: 'manual' };
    } else if (this.driverMode === 'autopilot') {
      // Neural network autopilot
      if (!this.autopilot.isReady()) {
        console.error('Autopilot selected but model not ready!');
        return { thrustX: 0, thrustY: 0, thrustZ: 0, actualMode: 'stopped' };
      }
      
      const lidarDistances = this.lidar.getDistances();
      const droneState = this.drone.getState();
      const targetDirection = this.controller.getTargetDirection();
      
      const prediction = this.autopilot.predict(lidarDistances, droneState, targetDirection);
      return { ...prediction, actualMode: 'autopilot' };
    } else {
      // Classical controller
      const lidarDistances = this.lidar.getDistances();
      const control = this.controller.computeControl(lidarDistances);
      return { ...control, actualMode: 'classic' };
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
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    // Update simulation
    this.update(deltaTime);
    
    // Render
    this.sceneManager.render();
  }

  /**
   * Update simulation state
   */
  update(dt) {
    // Check if target reached
    if (this.controller.isTargetReached()) {
      if (this.trainer.isCollecting()) {
        this.trainer.onEpisodeEnd(true);
      }
      this.ui.updateNavigation(0, '🎯 Target Reached!');
      
      // Auto-generate new target
      if (!this.isRegeneratingTarget) {
        this.isRegeneratingTarget = true;
        setTimeout(() => {
          this.generateNewTarget();
          this.isRegeneratingTarget = false;
        }, 500);
      }
      return;
    }
    
    // LiDAR scan
    this.lidar.scan(this.raycastTargets);
    
    // Get control commands
    const control = this.getControlCommands();
    this.drone.setControls(control.thrustX, control.thrustY, control.thrustZ);
    
    // Record data if collecting and using classic controller
    if (this.trainer.isCollecting() && this.driverMode === 'classic') {
      const lidarDistances = this.lidar.getDistances();
      const droneState = this.drone.getState();
      const targetDirection = this.controller.getTargetDirection();
      
      this.dataRecorder.record(lidarDistances, droneState, targetDirection, control);
    }
    
    // Update drone physics
    this.drone.update(dt);
    
    // Keep drone in bounds
    this.enforceBounds();
    
    // Update camera
    const state = this.drone.getState();
    this.sceneManager.followTarget(
      state.x,
      state.y,
      state.z,
      state.yaw,
      this.cameraMode
    );
    
    // Update UI
    this.ui.updateDroneStats(
      state.speed,
      state.y,
      this.drone.distanceTraveled
    );
    
    // Show actual mode being used
    const modeLabels = {
      'autopilot': '🤖 Autopilot',
      'manual': '🎮 Manual',
      'classic': '🚁 Classic',
      'stopped': '⚠️ Stopped',
    };
    
    this.ui.updateNavigation(
      this.controller.getDistanceToTarget(),
      modeLabels[control.actualMode] || control.actualMode
    );
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
    
    // Horizontal bounds
    if (x < -halfSize) { x = -halfSize; changed = true; }
    if (x > halfSize) { x = halfSize; changed = true; }
    if (z < -halfSize) { z = -halfSize; changed = true; }
    if (z > halfSize) { z = halfSize; changed = true; }
    
    // Vertical bounds
    const groundY = this.forestGenerator.getTerrainHeight(x, z);
    const minY = groundY + FOREST.FLYING_HEIGHT_MIN;
    const maxY = groundY + FOREST.FLYING_HEIGHT_MAX + 5;
    
    if (y < minY) { y = minY; changed = true; }
    if (y > maxY) { y = maxY; changed = true; }
    
    if (changed) {
      this.drone.setPosition(x, y, z);
    }
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  const sim = new Simulation();
  await sim.init();
  
  // Expose for debugging
  window.sim = sim;
});
