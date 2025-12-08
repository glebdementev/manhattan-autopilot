/**
 * UI Manager - Main coordinator for all user interface elements
 * 
 * Handles drone navigation UI with reactive navigation status display
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
   * Update observation display - shows sensor data
   * @param {Object} obsData - Observation data object
   */
  updateObservationDisplay(obsData) {
    const el = this.elements;
    
    // Target info
    if (el.obsTargetDist) {
      el.obsTargetDist.textContent = obsData.distToTarget?.toFixed(1) || '∞';
    }
    
    if (el.obsTargetDir && obsData.targetDir) {
      const dir = obsData.targetDir;
      el.obsTargetDir.textContent = `(${dir.x?.toFixed(2) || 0}, ${dir.y?.toFixed(2) || 0}, ${dir.z?.toFixed(2) || 0})`;
    }
    
    if (el.obsTargetVisible) {
      el.obsTargetVisible.textContent = obsData.canSeeTarget ? 'Yes' : 'No';
      el.obsTargetVisible.style.color = obsData.canSeeTarget ? '#4f4' : '#f44';
    }
    
    // Obstacle detection
    if (el.obsMinObstacle) {
      const minDist = obsData.minObstacleDist;
      if (minDist !== undefined && minDist < obsData.maxRange) {
        el.obsMinObstacle.textContent = minDist.toFixed(1);
        el.obsMinObstacle.style.color = minDist < 3 ? '#f44' : (minDist < 6 ? '#ff4' : '#4f4');
      } else {
        el.obsMinObstacle.textContent = '∞';
        el.obsMinObstacle.style.color = '#4f4';
      }
    }
    
    // Vertical sensors
    if (el.obsNadir) {
      const nadir = obsData.nadirDist;
      if (nadir !== undefined && nadir < 100) {
        el.obsNadir.textContent = nadir.toFixed(1);
      } else {
        el.obsNadir.textContent = '∞';
      }
    }
    
    // Velocity
    if (obsData.velocity) {
      if (el.obsVelForward) el.obsVelForward.textContent = obsData.velocity.vx?.toFixed(1) || '0.0';
      if (el.obsVelRight) el.obsVelRight.textContent = obsData.velocity.vy?.toFixed(1) || '0.0';
      if (el.obsVelUp) el.obsVelUp.textContent = obsData.velocity.vz?.toFixed(1) || '0.0';
    }
    
    // Navigation status - reactive mode shows obstacle proximity
    if (el.navStatus) {
      const minDist = obsData.minObstacleDist;
      if (minDist < 3) {
        el.navStatus.textContent = 'Avoiding obstacle';
        el.navStatus.style.color = '#f44';
      } else if (minDist < 6) {
        el.navStatus.textContent = 'Obstacle nearby';
        el.navStatus.style.color = '#ff4';
      } else {
        el.navStatus.textContent = 'Clear path';
        el.navStatus.style.color = '#4f4';
      }
    }
    
    if (el.navProgress) {
      // Show distance to target instead of path progress
      const dist = obsData.distToTarget || 0;
      el.navProgress.textContent = `${dist.toFixed(1)}m`;
    }
  }

  /**
   * Update episode stats
   */
  updateEpisodeStats(steps) {
    if (this.elements.episodeStepCount) {
      this.elements.episodeStepCount.textContent = steps;
    }
  }
}
