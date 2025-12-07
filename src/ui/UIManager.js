/**
 * UI Manager - Main coordinator for all user interface elements
 * 
 * Modes:
 * - Simulation: Manual drone control or autopilot (when model loaded)
 * - Training: Offline training screen with progress stats
 */

import { createUIContainer } from './UIElements.js';
import { SplashScreens } from './SplashScreens.js';
import { TrainingScreen } from './TrainingScreen.js';
import { EventEmitter } from './EventEmitter.js';
import * as StatsDisplay from './StatsDisplay.js';
import * as RewardDisplay from './RewardDisplay.js';

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
   * Update reward display with current step breakdown
   * @param {Object} breakdown - Reward breakdown from RewardCalculator
   * @param {number} totalReward - Total reward for this step
   */
  updateRewardBreakdown(breakdown, totalReward) {
    RewardDisplay.updateRewardBreakdown(this.elements, breakdown, totalReward);
  }

  /**
   * Update episode cumulative stats in reward panel
   * @param {number} episodeReward - Total reward for current episode
   * @param {number} episodeSteps - Steps taken in current episode
   */
  updateEpisodeRewardStats(episodeReward, episodeSteps) {
    RewardDisplay.updateEpisodeStats(this.elements, episodeReward, episodeSteps);
  }

  /**
   * Update observation display - shows what the model sees
   * @param {Object} obsData - Observation data object
   */
  updateObservationDisplay(obsData) {
    RewardDisplay.updateObservationDisplay(this.elements, obsData);
  }

  /**
   * Update model action display
   * @param {Array} action - Action array [forward, right, up]
   * @param {boolean} visible - Whether model is active
   */
  updateModelAction(action, visible) {
    RewardDisplay.updateModelAction(this.elements, action, visible);
  }

  /**
   * Set model loaded state
   */
  setModelLoaded(loaded) {
    this.hasLoadedModel = loaded;
    
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
