/**
 * UI Manager - handles all user interface elements and controls
 */

export class UIManager {
  constructor() {
    this.elements = {};
    this.callbacks = {};
    
    this.createUI();
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
        <h2>Manhattan Autopilot</h2>
        
        <div class="section">
          <h3>Vehicle</h3>
          <div class="stat">
            <span class="label">Speed:</span>
            <span id="speed-value">0.0</span> m/s
          </div>
          <div class="stat">
            <span class="label">Steering:</span>
            <span id="steering-value">0.0</span>°
          </div>
          <div class="stat">
            <span class="label">Distance:</span>
            <span id="distance-value">0</span> m
          </div>
        </div>
        
        <div class="section">
          <h3>Route</h3>
          <div class="stat">
            <span class="label">Progress:</span>
            <span id="progress-value">0</span>%
          </div>
          <div class="stat">
            <span class="label">Status:</span>
            <span id="route-status">Ready</span>
          </div>
        </div>
        
        <div class="section">
          <h3>Controls</h3>
          <div class="control-group">
            <button id="btn-new-route">New Route</button>
            <button id="btn-reset">Reset</button>
          </div>
        </div>
        
        <div class="section">
          <h3>Driver Mode</h3>
          <div class="radio-group">
            <label>
              <input type="radio" name="driver-mode" value="classic" checked>
              Classic Controller
            </label>
            <label>
              <input type="radio" name="driver-mode" value="autopilot">
              Neural Autopilot
            </label>
            <label>
              <input type="radio" name="driver-mode" value="manual">
              Manual (WASD)
            </label>
          </div>
        </div>
        
        <div class="section">
          <h3>Camera</h3>
          <div class="radio-group">
            <label>
              <input type="radio" name="camera-mode" value="chase" checked>
              Chase
            </label>
            <label>
              <input type="radio" name="camera-mode" value="bird">
              Bird's Eye
            </label>
          </div>
        </div>
        
        <div class="section">
          <h3>Training</h3>
          <div class="stat">
            <span class="label">Samples:</span>
            <span id="samples-value">0</span>
          </div>
          <div class="stat">
            <span class="label">Loss:</span>
            <span id="loss-value">-</span>
          </div>
          <div class="stat">
            <span class="label">Model:</span>
            <span id="model-status">Not trained</span>
          </div>
          <div class="control-group instant-train">
            <button id="btn-instant-train" class="primary">⚡ Instant Train</button>
          </div>
          <div class="control-group">
            <button id="btn-export">Export Model</button>
            <button id="btn-import">Import Model</button>
          </div>
          <div class="control-group">
            <button id="btn-download-data">Download Training Data</button>
          </div>
          <input type="file" id="model-file-input" accept=".json" style="display: none;">
          <div id="training-status"></div>
        </div>
        
        <div class="section">
          <h3>LiDAR</h3>
          <label>
            <input type="checkbox" id="lidar-toggle" checked>
            Show LiDAR Rays
          </label>
        </div>
      </div>
      
      <div id="help-panel">
        <p><strong>W</strong> - Accelerate</p>
        <p><strong>S</strong> - Brake</p>
        <p><strong>A/D</strong> - Steer</p>
        <p><strong>R</strong> - New route</p>
        <p><strong>C</strong> - Toggle camera</p>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Store references to elements
    this.elements = {
      speedValue: document.getElementById('speed-value'),
      steeringValue: document.getElementById('steering-value'),
      distanceValue: document.getElementById('distance-value'),
      progressValue: document.getElementById('progress-value'),
      routeStatus: document.getElementById('route-status'),
      samplesValue: document.getElementById('samples-value'),
      lossValue: document.getElementById('loss-value'),
      modelStatus: document.getElementById('model-status'),
      trainingStatus: document.getElementById('training-status'),
      btnNewRoute: document.getElementById('btn-new-route'),
      btnReset: document.getElementById('btn-reset'),
      btnInstantTrain: document.getElementById('btn-instant-train'),
      btnExport: document.getElementById('btn-export'),
      btnImport: document.getElementById('btn-import'),
      btnDownloadData: document.getElementById('btn-download-data'),
      modelFileInput: document.getElementById('model-file-input'),
      lidarToggle: document.getElementById('lidar-toggle'),
      autopilotRadio: document.querySelector('input[name="driver-mode"][value="autopilot"]'),
    };
    
    // Initially disable autopilot option
    this.setAutopilotEnabled(false);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Button clicks
    this.elements.btnNewRoute.addEventListener('click', () => {
      this.emit('newRoute');
    });
    
    this.elements.btnReset.addEventListener('click', () => {
      this.emit('reset');
    });
    
    this.elements.btnInstantTrain.addEventListener('click', () => {
      this.emit('instantTrain');
    });
    
    this.elements.btnExport.addEventListener('click', () => {
      this.emit('exportModel');
    });
    
    this.elements.btnImport.addEventListener('click', () => {
      this.elements.modelFileInput.click();
    });
    
    this.elements.btnDownloadData.addEventListener('click', () => {
      this.emit('downloadTrainingData');
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
    
    document.querySelectorAll('input[name="camera-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.emit('cameraModeChange', e.target.value);
      });
    });
    
    // Checkbox
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
   * Update vehicle stats display
   */
  updateVehicleStats(speed, steering, distance) {
    this.elements.speedValue.textContent = speed.toFixed(1);
    this.elements.steeringValue.textContent = (steering * 180 / Math.PI).toFixed(1);
    this.elements.distanceValue.textContent = Math.round(distance);
  }

  /**
   * Update route progress display
   */
  updateRouteProgress(progress, status) {
    this.elements.progressValue.textContent = Math.round(progress * 100);
    this.elements.routeStatus.textContent = status;
  }

  /**
   * Update training stats display
   */
  updateTrainingStats(samples, loss) {
    this.elements.samplesValue.textContent = samples;
    this.elements.lossValue.textContent = loss !== null ? loss.toFixed(6) : '-';
  }

  /**
   * Set training status message
   */
  setTrainingStatus(message) {
    this.elements.trainingStatus.textContent = message;
  }

  /**
   * Enable/disable instant train button
   */
  setInstantTrainEnabled(enabled) {
    this.elements.btnInstantTrain.disabled = !enabled;
  }

  /**
   * Enable/disable autopilot mode option
   */
  setAutopilotEnabled(enabled) {
    if (this.elements.autopilotRadio) {
      this.elements.autopilotRadio.disabled = !enabled;
      const label = this.elements.autopilotRadio.parentElement;
      if (label) {
        label.style.opacity = enabled ? '1' : '0.4';
        label.title = enabled ? '' : 'Train or import a model first';
      }
    }
  }

  /**
   * Update model status display
   */
  setModelStatus(status) {
    if (this.elements.modelStatus) {
      this.elements.modelStatus.textContent = status;
      // Color based on status
      if (status === 'Ready') {
        this.elements.modelStatus.style.color = '#00ff88';
      } else if (status === 'Training...') {
        this.elements.modelStatus.style.color = '#ffaa00';
      } else {
        this.elements.modelStatus.style.color = '#ff4444';
      }
    }
  }

  /**
   * Set driver mode programmatically
   */
  setDriverMode(mode) {
    const radio = document.querySelector(`input[name="driver-mode"][value="${mode}"]`);
    if (radio && !radio.disabled) {
      radio.checked = true;
    }
  }

  /**
   * Get current driver mode
   */
  getDriverMode() {
    const radio = document.querySelector('input[name="driver-mode"]:checked');
    return radio ? radio.value : 'classic';
  }

  /**
   * Get current camera mode
   */
  getCameraMode() {
    const radio = document.querySelector('input[name="camera-mode"]:checked');
    return radio ? radio.value : 'chase';
  }
}

