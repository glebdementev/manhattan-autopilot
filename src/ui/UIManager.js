/**
 * UI Manager - Main coordinator for all user interface elements
 * Delegates to specialized modules for specific functionality
 */

import { createUIContainer } from './UIElements.js';
import { SplashScreens } from './SplashScreens.js';
import { EventEmitter } from './EventEmitter.js';
import * as StatsDisplay from './StatsDisplay.js';

export class UIManager extends EventEmitter {
  constructor() {
    super();
    
    this.elements = {};
    this.splashScreens = null;
    
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
  }

  /**
   * Show collision splash screen
   * @param {string} type - Type of collision
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
   * @param {number} reward - Reward value
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
    
    this.elements.btnResetTraining.addEventListener('click', () => {
      if (confirm('Reset all training progress? This cannot be undone.')) {
        this.emit('resetTraining');
      }
    });
    
    this.elements.btnExport.addEventListener('click', () => {
      this.emit('exportModel');
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
    
    // Radio buttons
    document.querySelectorAll('input[name="driver-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.emit('driverModeChange', e.target.value);
      });
    });
    
    // Checkboxes
    this.elements.trainingToggle.addEventListener('change', (e) => {
      this.emit('trainingToggle', e.target.checked);
    });
    
    this.elements.fastModeToggle.addEventListener('change', (e) => {
      this.emit('fastModeToggle', e.target.checked);
    });
    
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
   * @param {number} speed - Current speed
   * @param {number} altitude - Current altitude
   * @param {number} distToTarget - Distance to target
   */
  updateDroneStats(speed, altitude, distToTarget) {
    StatsDisplay.updateDroneStats(this.elements, speed, altitude, distToTarget);
  }

  /**
   * Update RL training stats
   * @param {Object} stats - RL stats object
   */
  updateRLStats(stats) {
    StatsDisplay.updateRLStats(this.elements, stats);
  }

  /**
   * Update agent stats
   * @param {Object} stats - Agent stats object
   */
  updateAgentStats(stats) {
    StatsDisplay.updateAgentStats(this.elements, stats);
  }

  /**
   * Update navigation status
   * @param {number} distToTarget - Distance to target
   * @param {string} status - Navigation status text
   */
  updateNavigation(distToTarget, status) {
    StatsDisplay.updateNavigation(this.elements, distToTarget, status);
  }

  /**
   * Set training status message
   * @param {string} message - Status message
   */
  setTrainingStatus(message) {
    StatsDisplay.setTrainingStatus(this.elements, message);
  }

  /**
   * Update model status display
   * @param {string} status - Model status text
   */
  setModelStatus(status) {
    StatsDisplay.setModelStatus(this.elements, status);
  }

  /**
   * Set driver mode programmatically
   * @param {string} mode - Mode to set ('rl' or 'manual')
   */
  setDriverMode(mode) {
    const radio = document.querySelector(`input[name="driver-mode"][value="${mode}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  /**
   * Get current driver mode
   * @returns {string} Current mode ('rl' or 'manual')
   */
  getDriverMode() {
    const radio = document.querySelector('input[name="driver-mode"]:checked');
    return radio ? radio.value : 'rl';
  }

  /**
   * Check if training is enabled
   * @returns {boolean}
   */
  isTrainingEnabled() {
    return this.elements.trainingToggle.checked;
  }

  /**
   * Check if fast mode is enabled
   * @returns {boolean}
   */
  isFastModeEnabled() {
    return this.elements.fastModeToggle.checked;
  }
}
