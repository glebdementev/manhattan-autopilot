/**
 * UI Manager - handles all user interface elements and controls
 * Updated for Reinforcement Learning drone navigation
 */

export class UIManager {
  constructor() {
    this.elements = {};
    this.callbacks = {};
    this.splashTimeout = null;
    
    this.createUI();
    this.createSplashScreens();
    this.setupEventListeners();
  }

  /**
   * Create all UI elements
   */
  createUI() {
    // Main container
    const container = document.createElement('div');
    container.id = 'ui-container';
    container.innerHTML = `
      <div id="info-panel">
        <h2>🚁 Drone RL Navigator</h2>
        
        <div class="section">
          <h3>Drone Status</h3>
          <div class="stat">
            <span class="label">Speed:</span>
            <span id="speed-value">0.0</span> m/s
          </div>
          <div class="stat">
            <span class="label">Altitude:</span>
            <span id="altitude-value">0.0</span> m
          </div>
          <div class="stat">
            <span class="label">To Target:</span>
            <span id="target-dist-value">0</span> m
          </div>
        </div>
        
        <div class="section">
          <h3>Pilot Mode</h3>
          <div class="radio-group">
            <label>
              <input type="radio" name="driver-mode" value="rl" checked>
              🤖 RL Agent
            </label>
            <label>
              <input type="radio" name="driver-mode" value="manual">
              🎮 Manual (WASD/QE)
            </label>
          </div>
        </div>
        
        <div class="section rl-section">
          <h3>🧠 RL Training</h3>
          <div class="stat">
            <span class="label">Episodes:</span>
            <span id="episode-count">0</span>
          </div>
          <div class="stat">
            <span class="label">Success Rate:</span>
            <span id="success-rate">0%</span>
          </div>
          <div class="stat">
            <span class="label">Avg Reward:</span>
            <span id="avg-reward">0</span>
          </div>
          <div class="stat">
            <span class="label">Exploration:</span>
            <span id="exploration-rate">50%</span>
          </div>
          <div class="stat">
            <span class="label">Buffer:</span>
            <span id="buffer-size">0</span>
          </div>
          
          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" id="training-toggle" checked>
              Enable Training
            </label>
          </div>
          
          <div class="control-group">
            <label class="checkbox-label">
              <input type="checkbox" id="fast-mode-toggle">
              Fast Training (10x)
            </label>
          </div>
          
          <div class="control-group">
            <button id="btn-reset-training" class="danger">Reset Training</button>
          </div>
        </div>
        
        <div class="section">
          <h3>Model</h3>
          <div class="stat">
            <span class="label">Status:</span>
            <span id="model-status">Training...</span>
          </div>
          <div class="control-group">
            <button id="btn-export">Export Model</button>
            <button id="btn-import">Import Model</button>
          </div>
          <input type="file" id="model-file-input" accept=".json" style="display: none;">
          <div id="training-status"></div>
        </div>
        
        <div class="section">
          <h3>Episode Info</h3>
          <div class="stat">
            <span class="label">Step:</span>
            <span id="episode-step">0</span>
          </div>
          <div class="stat">
            <span class="label">Reward:</span>
            <span id="episode-reward">0</span>
          </div>
          <div class="stat">
            <span class="label">Mode:</span>
            <span id="nav-status">RL Agent</span>
          </div>
        </div>
        
        <div class="section">
          <h3>Controls</h3>
          <div class="control-group">
            <button id="btn-new-target">New Target</button>
            <button id="btn-reset">Reset Episode</button>
          </div>
        </div>
        
        <div class="section">
          <h3>Display</h3>
          <label class="checkbox-label">
            <input type="checkbox" id="lidar-toggle">
            Show LiDAR Rays
          </label>
        </div>
      </div>
      
      <div id="help-panel">
        <p><strong>Manual Controls:</strong></p>
        <p><strong>W/S</strong> - Forward/Back</p>
        <p><strong>A/D</strong> - Left/Right</p>
        <p><strong>Q/E</strong> - Up/Down</p>
        <p><strong>R</strong> - New target</p>
      </div>
      
      <div id="reward-indicator"></div>
    `;
    
    document.body.appendChild(container);
    
    // Store references to elements
    this.elements = {
      speedValue: document.getElementById('speed-value'),
      altitudeValue: document.getElementById('altitude-value'),
      targetDistValue: document.getElementById('target-dist-value'),
      navStatus: document.getElementById('nav-status'),
      
      // RL stats
      episodeCount: document.getElementById('episode-count'),
      successRate: document.getElementById('success-rate'),
      avgReward: document.getElementById('avg-reward'),
      explorationRate: document.getElementById('exploration-rate'),
      bufferSize: document.getElementById('buffer-size'),
      episodeStep: document.getElementById('episode-step'),
      episodeReward: document.getElementById('episode-reward'),
      
      // Model
      modelStatus: document.getElementById('model-status'),
      trainingStatus: document.getElementById('training-status'),
      
      // Buttons
      btnNewTarget: document.getElementById('btn-new-target'),
      btnReset: document.getElementById('btn-reset'),
      btnResetTraining: document.getElementById('btn-reset-training'),
      btnExport: document.getElementById('btn-export'),
      btnImport: document.getElementById('btn-import'),
      modelFileInput: document.getElementById('model-file-input'),
      
      // Toggles
      trainingToggle: document.getElementById('training-toggle'),
      fastModeToggle: document.getElementById('fast-mode-toggle'),
      lidarToggle: document.getElementById('lidar-toggle'),
      
      // Reward indicator
      rewardIndicator: document.getElementById('reward-indicator'),
    };
  }

  /**
   * Create splash screen overlays
   */
  createSplashScreens() {
    // Collision splash
    const collisionSplash = document.createElement('div');
    collisionSplash.id = 'collision-splash';
    collisionSplash.className = 'splash-screen splash-fail';
    collisionSplash.innerHTML = `
      <div class="splash-content">
        <div class="splash-icon">💥</div>
        <h1 class="splash-title">COLLISION</h1>
        <p class="splash-message"></p>
      </div>
    `;
    document.body.appendChild(collisionSplash);
    
    this.elements.collisionSplash = collisionSplash;
    this.elements.collisionMessage = collisionSplash.querySelector('.splash-message');
    
    // Success splash
    const successSplash = document.createElement('div');
    successSplash.id = 'success-splash';
    successSplash.className = 'splash-screen splash-success';
    successSplash.innerHTML = `
      <div class="splash-content">
        <div class="splash-icon">🎯</div>
        <h1 class="splash-title">TARGET REACHED!</h1>
        <p class="splash-message">+100 reward</p>
      </div>
    `;
    document.body.appendChild(successSplash);
    
    this.elements.successSplash = successSplash;
    
    // Timeout splash
    const timeoutSplash = document.createElement('div');
    timeoutSplash.id = 'timeout-splash';
    timeoutSplash.className = 'splash-screen splash-timeout';
    timeoutSplash.innerHTML = `
      <div class="splash-content">
        <div class="splash-icon">⏱️</div>
        <h1 class="splash-title">TIMEOUT</h1>
        <p class="splash-message">Episode limit reached</p>
      </div>
    `;
    document.body.appendChild(timeoutSplash);
    
    this.elements.timeoutSplash = timeoutSplash;
  }

  /**
   * Show collision splash screen
   */
  showCollisionSplash(type) {
    const typeLabels = {
      'terrain': 'Ground collision (-50)',
      'tree': 'Tree collision (-50)',
      'bush': 'Bush collision (-50)',
    };
    
    this.elements.collisionMessage.textContent = typeLabels[type] || type;
    this.showSplash(this.elements.collisionSplash);
  }

  /**
   * Show success splash screen
   */
  showSuccessSplash() {
    this.showSplash(this.elements.successSplash);
  }

  /**
   * Show timeout splash screen
   */
  showTimeoutSplash() {
    this.showSplash(this.elements.timeoutSplash);
  }

  /**
   * Show a splash screen
   */
  showSplash(splash) {
    // Hide all splashes first
    this.hideSplash();
    
    splash.classList.add('visible');
    
    if (this.splashTimeout) {
      clearTimeout(this.splashTimeout);
    }
    
    this.splashTimeout = setTimeout(() => {
      this.hideSplash();
    }, 800);
  }

  /**
   * Hide all splash screens
   */
  hideSplash() {
    this.elements.collisionSplash.classList.remove('visible');
    this.elements.successSplash.classList.remove('visible');
    this.elements.timeoutSplash.classList.remove('visible');
  }

  /**
   * Show reward indicator
   */
  showRewardIndicator(reward) {
    const indicator = this.elements.rewardIndicator;
    indicator.textContent = reward >= 0 ? `+${reward.toFixed(1)}` : reward.toFixed(1);
    indicator.className = reward >= 0 ? 'positive' : 'negative';
    indicator.classList.add('visible');
    
    setTimeout(() => {
      indicator.classList.remove('visible');
    }, 500);
  }

  /**
   * Setup event listeners
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
   * Register callback
   */
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  /**
   * Update drone stats display
   */
  updateDroneStats(speed, altitude, distToTarget) {
    this.elements.speedValue.textContent = speed.toFixed(1);
    this.elements.altitudeValue.textContent = altitude.toFixed(1);
    this.elements.targetDistValue.textContent = Math.round(distToTarget);
  }

  /**
   * Update RL training stats
   */
  updateRLStats(stats) {
    this.elements.episodeCount.textContent = stats.totalEpisodes;
    this.elements.successRate.textContent = `${(stats.successRate * 100).toFixed(1)}%`;
    this.elements.avgReward.textContent = stats.avgRecentReward.toFixed(1);
    this.elements.episodeStep.textContent = stats.currentEpisodeSteps;
    this.elements.episodeReward.textContent = stats.currentEpisodeReward.toFixed(1);
    
    // Color success rate based on performance
    const successEl = this.elements.successRate;
    if (stats.successRate > 0.7) {
      successEl.style.color = '#00ff88';
    } else if (stats.successRate > 0.3) {
      successEl.style.color = '#ffaa00';
    } else {
      successEl.style.color = '#ff4444';
    }
  }

  /**
   * Update agent stats
   */
  updateAgentStats(stats) {
    this.elements.explorationRate.textContent = `${(stats.explorationRate * 100).toFixed(1)}%`;
    this.elements.bufferSize.textContent = stats.bufferSize;
  }

  /**
   * Update navigation status
   */
  updateNavigation(distToTarget, status) {
    this.elements.targetDistValue.textContent = Math.round(distToTarget);
    this.elements.navStatus.textContent = status;
  }

  /**
   * Set training status message
   */
  setTrainingStatus(message) {
    this.elements.trainingStatus.textContent = message;
  }

  /**
   * Update model status display
   */
  setModelStatus(status) {
    if (this.elements.modelStatus) {
      this.elements.modelStatus.textContent = status;
      // Color based on status
      if (status === 'Ready' || status === 'Trained') {
        this.elements.modelStatus.style.color = '#00ff88';
      } else if (status === 'Training...') {
        this.elements.modelStatus.style.color = '#ffaa00';
      } else {
        this.elements.modelStatus.style.color = '#888';
      }
    }
  }

  /**
   * Set driver mode programmatically
   */
  setDriverMode(mode) {
    const radio = document.querySelector(`input[name="driver-mode"][value="${mode}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  /**
   * Get current driver mode
   */
  getDriverMode() {
    const radio = document.querySelector('input[name="driver-mode"]:checked');
    return radio ? radio.value : 'rl';
  }

  /**
   * Check if training is enabled
   */
  isTrainingEnabled() {
    return this.elements.trainingToggle.checked;
  }

  /**
   * Check if fast mode is enabled
   */
  isFastModeEnabled() {
    return this.elements.fastModeToggle.checked;
  }
}
