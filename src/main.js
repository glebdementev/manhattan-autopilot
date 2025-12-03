/**
 * Main entry point - orchestrates all simulation components
 */
import { SIMULATION, CITY } from './config.js';

// City
import { CityGenerator } from './city/CityGenerator.js';
import { RoadNetwork } from './city/RoadNetwork.js';

// Routing
import { PathFinder } from './routing/PathFinder.js';
import { RouteManager } from './routing/RouteManager.js';

// Vehicle
import { Car } from './vehicle/Car.js';
import { Lidar } from './vehicle/Lidar.js';
import { CarController } from './vehicle/CarController.js';

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
    this.cityGenerator = null;
    this.roadNetwork = null;
    this.pathFinder = null;
    this.routeManager = null;
    this.car = null;
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
      left: false,
      right: false,
      brake: false,
    };
    
    // Raycast targets for LiDAR
    this.raycastTargets = [];
    
    // Route completion flag to prevent multiple auto-regenerations
    this.isRegeneratingRoute = false;
  }

  /**
   * Initialize the simulation
   */
  async init() {
    console.log('Initializing Manhattan Autopilot Simulation...');
    
    // Create scene
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);
    
    // Generate city
    console.log('Generating city...');
    this.cityGenerator = new CityGenerator();
    const city = this.cityGenerator.generate();
    this.sceneManager.add(city);
    
    // Build road network
    console.log('Building road network...');
    this.roadNetwork = new RoadNetwork();
    this.roadNetwork.buildFromIntersections(this.cityGenerator.getIntersections());
    
    // Create pathfinder and route manager
    this.pathFinder = new PathFinder(this.roadNetwork);
    this.routeManager = new RouteManager(this.roadNetwork, this.pathFinder);
    
    // Create car
    console.log('Creating vehicle...');
    this.car = new Car();
    this.sceneManager.add(this.car.getMesh());
    
    // Create LiDAR
    this.lidar = new Lidar(this.car);
    this.sceneManager.add(this.lidar.getVisualGroup());
    
    // Get raycast targets (buildings and sidewalks)
    this.raycastTargets = this.cityGenerator.getRaycastTargets();
    
    // Create classical controller
    this.controller = new CarController(this.car, this.routeManager);
    
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
    
    // Generate initial route
    this.generateNewRoute();
    
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
    this.ui.on('newRoute', () => this.generateNewRoute());
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
      this.car.setMode(mode);
      console.log(`Driver mode: ${mode}`);
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
    
    // Set initial car color
    this.car.setMode('classic');
  }

  /**
   * Generate a new route
   */
  generateNewRoute() {
    // Generate route
    const result = this.routeManager.generateRandomRoute(6);
    
    if (result.path.length > 0) {
      // Get waypoints
      const waypoints = this.routeManager.getAllWaypoints();
      
      if (waypoints.length >= 2) {
        // Position car at the first waypoint (on the road)
        const startWp = waypoints[0];
        
        // Calculate initial heading based on first two waypoints
        const dx = waypoints[1].x - waypoints[0].x;
        const dz = waypoints[1].z - waypoints[0].z;
        const heading = Math.atan2(dz, dx);
        
        // Reset car stats first, THEN set position (reset() resets position to 0,0)
        this.car.reset();
        this.car.setPosition(startWp.x, startWp.z, heading);
        this.routeManager.reset();
        
        // Visualize route
        this.sceneManager.visualizeRoute(waypoints);
        
        console.log(`New route: ${result.path.length} nodes, ${waypoints.length} waypoints`);
        
        // If collecting data, start new episode
        if (this.trainer.isCollecting()) {
          this.trainer.onEpisodeStart();
        }
      }
    }
  }

  /**
   * Reset simulation
   */
  resetSimulation() {
    this.car.reset();
    this.routeManager.reset();
    
    const waypoints = this.routeManager.getAllWaypoints();
    if (waypoints.length > 0) {
      const startWp = waypoints[0];
      let heading = 0;
      
      if (waypoints.length >= 2) {
        const dx = waypoints[1].x - waypoints[0].x;
        const dz = waypoints[1].z - waypoints[0].z;
        heading = Math.atan2(dz, dx);
      }
      
      this.car.setPosition(startWp.x, startWp.z, heading);
    }
  }

  /**
   * Train the autopilot model
   */
  async trainModel() {
    await this.trainer.train(20);
  }

  /**
   * Instant train: generate synthetic data and train immediately
   */
  async instantTrain() {
    this.ui.setInstantTrainEnabled(false);
    this.ui.setTrainingStatus('Generating data & training...');
    
    // Generate data first
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
    link.download = `training-data-${dataSize}-samples.json`;
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
        this.manualInput.brake = true;
        break;
      case 'a': case 'arrowleft':
        this.manualInput.left = true;
        break;
      case 'd': case 'arrowright':
        this.manualInput.right = true;
        break;
      case 'r':
        this.generateNewRoute();
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
        this.manualInput.brake = false;
        break;
      case 'a': case 'arrowleft':
        this.manualInput.left = false;
        break;
      case 'd': case 'arrowright':
        this.manualInput.right = false;
        break;
    }
  }

  /**
   * Get control commands based on current driver mode
   * Returns { steering, throttle, actualMode }
   */
  getControlCommands() {
    if (this.driverMode === 'manual') {
      // Manual control: W = forward, S = brake, A/D = steering
      let steering = 0;
      let throttle = 0;
      
      if (this.manualInput.left) steering = -0.5;
      if (this.manualInput.right) steering = 0.5;
      if (this.manualInput.forward) throttle = 0.8;
      if (this.manualInput.brake) throttle = -1;
      
      return { steering, throttle, actualMode: 'manual' };
    } else if (this.driverMode === 'autopilot') {
      // Neural network autopilot - MUST have a ready model
      if (!this.autopilot.isReady()) {
        // This shouldn't happen if UI is working correctly
        console.error('Autopilot selected but model not ready!');
        return { steering: 0, throttle: 0, actualMode: 'stopped' };
      }
      
      const lidarDistances = this.lidar.getDistances();
      const vehicleState = this.car.getState();
      const routeState = {
        headingError: this.controller.getHeadingError(),
        lateralOffset: this.controller.getLateralOffset(),
        targetDirection: this.controller.getTargetDirection(),
      };
      
      const prediction = this.autopilot.predict(lidarDistances, vehicleState, routeState);
      return { ...prediction, actualMode: 'autopilot' };
    } else {
      // Classical controller
      const control = this.controller.computeControl();
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
    // Handle route completion - auto-generate new route
    if (this.routeManager.isComplete()) {
      if (this.trainer.isCollecting()) {
        this.trainer.onEpisodeEnd(true);
      }
      this.ui.updateRouteProgress(1, 'Complete!');
      // Auto-generate a new route after a short delay (prevent multiple triggers)
      if (!this.isRegeneratingRoute) {
        this.isRegeneratingRoute = true;
        setTimeout(() => {
          this.generateNewRoute();
          this.isRegeneratingRoute = false;
        }, 500);
      }
      return;
    }
    
    // LiDAR scan
    this.lidar.scan(this.raycastTargets);
    
    // Get control commands
    const control = this.getControlCommands();
    this.car.setControls(control.steering, control.throttle);
    
    // Record data if collecting
    if (this.trainer.isCollecting() && this.driverMode === 'classic') {
      const lidarDistances = this.lidar.getDistances();
      const vehicleState = this.car.getState();
      const routeState = {
        headingError: this.controller.getHeadingError(),
        lateralOffset: this.controller.getLateralOffset(),
        targetDirection: this.controller.getTargetDirection(),
      };
      
      this.dataRecorder.record(lidarDistances, vehicleState, routeState, control);
    }
    
    // Update car physics
    this.car.update(dt);
    
    // Update camera
    this.sceneManager.followTarget(
      this.car.x,
      this.car.z,
      this.car.heading,
      this.cameraMode
    );
    
    // Update UI
    const carState = this.car.getState();
    this.ui.updateVehicleStats(
      carState.speed,
      carState.steering,
      this.car.distanceTraveled
    );
    
    // Show actual mode being used
    const modeLabels = {
      'autopilot': '🤖 Autopilot',
      'manual': '🎮 Manual',
      'classic': '🚗 Classic',
      'stopped': '⚠️ Stopped',
    };
    
    this.ui.updateRouteProgress(
      this.routeManager.getProgress(),
      modeLabels[control.actualMode] || control.actualMode
    );
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  const sim = new Simulation();
  await sim.init();
  
  // Expose for debugging
  window.sim = sim;
});

