/**
 * UI Manager - Main coordinator for all user interface elements
 * 
 * Modes:
 * - Simulation: Manual drone + optional ghost RL drone (when model loaded)
 * - Training: Offline training screen with progress stats
 */

import { createUIContainer } from './UIElements.js';
import { SplashScreens } from './SplashScreens.js';
import { TrainingScreen } from './TrainingScreen.js';
import { EventEmitter } from './EventEmitter.js';
import * as StatsDisplay from './StatsDisplay.js';

export class UIManager extends EventEmitter {
  constructor() {
    super();
    
    this.elements = {};
    this.splashScreens = null;
    this.trainingScreen = null;
    this.hasLoadedModel = false;
    
    this.createUI();
    this.setupEventListeners();
  }

  /**
   * Create all UI elements
   */
  createUI() {
    // Create main UI container and get element references
    this.elements = createUIContainer();
    
    // Create splash screens
    this.splashScreens = new SplashScreens();
    
    // Create training screen
    this.trainingScreen = new TrainingScreen();
    this.trainingScreen.onStop = () => this.emit('stopTraining');
    this.trainingScreen.onDownload = () => this.emit('downloadModel');
  }

  /**
   * Show collision splash screen
   */
  showCollisionSplash(type) {
    this.splashScreens.showCollision(type);
  }

  /**
   * Show success splash screen
   */
  showSuccessSplash() {
    this.splashScreens.showSuccess();
  }

  /**
   * Show timeout splash screen
   */
  showTimeoutSplash() {
    this.splashScreens.showTimeout();
  }

  /**
   * Hide all splash screens
   */
  hideSplash() {
    this.splashScreens.hideAll();
  }

  /**
   * Show reward indicator
   */
  showRewardIndicator(reward) {
    StatsDisplay.showRewardIndicator(this.elements, reward);
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Button clicks
    this.elements.btnNewTarget.addEventListener('click', () => {
      this.emit('newTarget');
    });
    
    this.elements.btnReset.addEventListener('click', () => {
      this.emit('reset');
    });
    
    this.elements.btnTrain.addEventListener('click', () => {
      this.emit('startTraining');
    });
    
    this.elements.btnImport.addEventListener('click', () => {
      this.elements.modelFileInput.click();
    });
    
    this.elements.modelFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.emit('importModel', file);
        e.target.value = ''; // Reset for next selection
      }
    });
    
    // Radio buttons - camera target
    document.querySelectorAll('input[name="camera-target"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.emit('cameraTargetChange', e.target.value);
      });
    });
    
    // Checkboxes
    this.elements.lidarToggle.addEventListener('change', (e) => {
      this.emit('lidarToggle', e.target.checked);
    });
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.emit('keydown', e.key.toLowerCase());
    });
    
    document.addEventListener('keyup', (e) => {
      this.emit('keyup', e.key.toLowerCase());
    });
  }

  /**
   * Update drone stats display
   */
  updateDroneStats(speed, altitude, distToTarget) {
    StatsDisplay.updateDroneStats(this.elements, speed, altitude, distToTarget);
  }

  /**
   * Update ghost drone stats
   */
  updateGhostStats(distToTarget, status = 'Active') {
    if (this.elements.ghostDistValue) {
      this.elements.ghostDistValue.textContent = distToTarget.toFixed(1);
    }
    if (this.elements.ghostStatus) {
      this.elements.ghostStatus.textContent = status;
    }
  }

  /**
   * Set model loaded state - shows ghost drone UI
   */
  setModelLoaded(loaded) {
    this.hasLoadedModel = loaded;
    
    // Show/hide ghost section
    if (this.elements.ghostSection) {
      this.elements.ghostSection.style.display = loaded ? 'block' : 'none';
    }
    
    // Show/hide camera section
    if (this.elements.cameraSection) {
      this.elements.cameraSection.style.display = loaded ? 'block' : 'none';
    }
    
    // Update model status
    if (this.elements.modelStatus) {
      this.elements.modelStatus.textContent = loaded ? 'Loaded' : 'No model';
    }
  }

  /**
   * Show training screen
   */
  showTrainingScreen() {
    this.trainingScreen.show();
    this.trainingScreen.clearLog();
    this.trainingScreen.log('Training initialized...', 'info');
  }

  /**
   * Hide training screen
   */
  hideTrainingScreen() {
    this.trainingScreen.hide();
  }

  /**
   * Update training screen stats
   */
  updateTrainingStats(stats) {
    this.trainingScreen.updateStats(stats);
  }

  /**
   * Add training log entry
   */
  logTraining(message, type = 'default') {
    this.trainingScreen.log(message, type);
  }

  /**
   * Get current camera target
   */
  getCameraTarget() {
    const radio = document.querySelector('input[name="camera-target"]:checked');
    return radio ? radio.value : 'manual';
  }
  
  /**
   * Set camera target programmatically
   */
  setCameraTarget(target) {
    const radio = document.querySelector(`input[name="camera-target"][value="${target}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  /**
   * Set model status display
   */
  setModelStatus(status) {
    if (this.elements.modelStatus) {
      this.elements.modelStatus.textContent = status;
    }
  }

  /**
   * Check if training screen is visible
   */
  isTrainingScreenVisible() {
    return this.trainingScreen.isVisible;
  }
}
