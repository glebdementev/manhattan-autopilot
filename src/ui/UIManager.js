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
    this.modelReady = false;
    
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
        if (e.target.value === 'learned' && !this.modelReady) {
          // Prevent switching to learned mode if model not ready
          e.preventDefault();
          el.navModeRadios.forEach(r => {
            r.checked = r.value === 'omniscient';
          });
          return;
        }
        this.currentMode = e.target.value;
        this.emit('modeChange', this.currentMode);
      });
    });
    
    // Buttons
    el.btnNewTarget.addEventListener('click', () => this.emit('newTarget'));
    el.btnReset.addEventListener('click', () => this.emit('reset'));
    
    // Model buttons
    el.btnLoadModel.addEventListener('click', () => this.emit('loadModel'));
    el.btnTrainModel.addEventListener('click', () => this.showTrainingModal());
    
    // Toggles
    el.lidarToggle.addEventListener('change', (e) => {
      this.emit('lidarToggle', e.target.checked);
    });
    
    el.pathToggle.addEventListener('change', (e) => {
      this.emit('pathToggle', e.target.checked);
    });
    
    // Modal buttons
    el.btnCloseModal.addEventListener('click', () => this.hideTrainingModal());
    
    // Training buttons (in modal)
    el.btnGenerate.addEventListener('click', () => {
      const episodes = parseInt(el.trainEpisodes.value, 10);
      this.emit('generateData', episodes);
    });
    
    el.btnTrain.addEventListener('click', () => {
      const epochs = parseInt(el.trainEpochs.value, 10);
      this.emit('trainModel', epochs);
    });
    
    el.btnSave.addEventListener('click', () => this.emit('saveModel'));
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      // Don't handle keys when modal is open
      if (this.isModalOpen()) return;
      this.emit('keydown', e.key.toLowerCase());
    });
    
    document.addEventListener('keyup', (e) => {
      if (this.isModalOpen()) return;
      this.emit('keyup', e.key.toLowerCase());
    });
    
    // Close modal on overlay click
    el.trainingModal.addEventListener('click', (e) => {
      if (e.target === el.trainingModal) {
        this.hideTrainingModal();
      }
    });
  }

  // Modal management
  isModalOpen() {
    return this.elements.trainingModal.classList.contains('visible');
  }

  showTrainingModal() {
    this.elements.trainingModal.classList.add('visible');
    this.emit('modalOpen');
  }

  hideTrainingModal() {
    this.elements.trainingModal.classList.remove('visible');
    this.emit('modalClose');
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

  // Model ready state
  setModelReady(ready) {
    this.modelReady = ready;
    const el = this.elements;
    
    // Enable/disable learned mode radio
    if (el.learnedModeRadio) {
      el.learnedModeRadio.disabled = !ready;
    }
    
    // Update model status
    if (el.modelStatus) {
      el.modelStatus.textContent = ready ? 'Ready' : 'Not loaded';
      el.modelStatus.style.color = ready ? '#60ff90' : 'rgba(180, 200, 220, 0.6)';
    }
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

  updateEpisodeStats(steps) {
    // No longer displayed
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
