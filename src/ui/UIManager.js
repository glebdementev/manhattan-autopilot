/**
 * UIManager - Coordinates all UI elements
 * Supports two navigation modes: Omniscient and Learned Model
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
    this.currentMode = 'omniscient';
    
    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    this.elements = createUIContainer();
    this.splashScreens = new SplashScreens();
  }

  setupEventListeners() {
    const el = this.elements;
    
    // Navigation mode selector
    el.navModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.currentMode = e.target.value;
        this.emit('modeChange', this.currentMode);
      });
    });
    
    // Buttons
    el.btnNewTarget.addEventListener('click', () => this.emit('newTarget'));
    el.btnReset.addEventListener('click', () => this.emit('reset'));
    
    // Toggles
    el.lidarToggle.addEventListener('change', (e) => {
      this.emit('lidarToggle', e.target.checked);
    });
    
    el.pathToggle.addEventListener('change', (e) => {
      this.emit('pathToggle', e.target.checked);
    });
    
    // Training buttons
    el.btnGenerate.addEventListener('click', () => {
      const episodes = parseInt(el.trainEpisodes.value, 10);
      this.emit('generateData', episodes);
    });
    
    el.btnTrain.addEventListener('click', () => {
      const epochs = parseInt(el.trainEpochs.value, 10);
      this.emit('trainModel', epochs);
    });
    
    el.btnSave.addEventListener('click', () => this.emit('saveModel'));
    el.btnLoad.addEventListener('click', () => this.emit('loadModel'));
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.emit('keydown', e.key.toLowerCase());
    });
    
    document.addEventListener('keyup', (e) => {
      this.emit('keyup', e.key.toLowerCase());
    });
  }

  // Mode
  getMode() {
    return this.currentMode;
  }
  
  setMode(mode) {
    this.currentMode = mode;
    this.elements.navModeRadios.forEach(radio => {
      radio.checked = radio.value === mode;
    });
  }

  // Splash screens
  showCollisionSplash(type) {
    this.splashScreens.showCollision(type);
  }

  showSuccessSplash() {
    this.splashScreens.showSuccess();
  }

  showTimeoutSplash() {
    this.splashScreens.showTimeout();
  }

  hideSplash() {
    this.splashScreens.hideAll();
  }

  // Stats updates
  updateDroneStats(speed, altitude, distToTarget) {
    StatsDisplay.updateDroneStats(this.elements, speed, altitude, distToTarget);
  }

  updateNavigationStatus(status, progress) {
    const el = this.elements;
    if (el.navStatus) {
      el.navStatus.textContent = status;
      el.navStatus.style.color = status.includes('Clear') ? '#4f4' : 
                                  status.includes('Avoiding') ? '#f44' : '#ff4';
    }
    if (el.navProgress) {
      el.navProgress.textContent = progress;
    }
  }

  updateObservationDisplay(obsData) {
    const el = this.elements;
    
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
    
    if (el.obsNadir) {
      const nadir = obsData.nadirDist;
      el.obsNadir.textContent = nadir < 100 ? nadir.toFixed(1) : '∞';
    }
    
    if (obsData.velocity) {
      if (el.obsVelForward) el.obsVelForward.textContent = obsData.velocity.vx?.toFixed(1) || '0.0';
      if (el.obsVelRight) el.obsVelRight.textContent = obsData.velocity.vy?.toFixed(1) || '0.0';
      if (el.obsVelUp) el.obsVelUp.textContent = obsData.velocity.vz?.toFixed(1) || '0.0';
    }
  }

  updateEpisodeStats(steps) {
    if (this.elements.episodeStepCount) {
      this.elements.episodeStepCount.textContent = steps;
    }
  }

  // Training UI
  updateTrainingStats(stats) {
    const el = this.elements;
    if (el.statSamples) el.statSamples.textContent = stats.totalSamples || 0;
    if (el.statLoss && stats.trainingLoss !== null) {
      el.statLoss.textContent = stats.trainingLoss.toFixed(6);
    }
  }

  showProgress(text, percent) {
    const el = this.elements;
    el.progressContainer.style.display = 'block';
    el.progressText.textContent = text;
    el.progressPercent.textContent = `${Math.round(percent * 100)}%`;
    el.progressBar.style.width = `${percent * 100}%`;
  }

  hideProgress() {
    this.elements.progressContainer.style.display = 'none';
  }

  setGenerating(isGenerating) {
    this.elements.btnGenerate.disabled = isGenerating;
    this.elements.btnGenerate.textContent = isGenerating ? 'Generating...' : 'Generate Data';
  }

  setTraining(isTraining) {
    this.elements.btnTrain.disabled = isTraining;
    this.elements.btnTrain.textContent = isTraining ? 'Training...' : 'Train';
  }

  enableTrain(enabled) {
    this.elements.btnTrain.disabled = !enabled;
  }

  enableSave(enabled) {
    this.elements.btnSave.disabled = !enabled;
  }
}
