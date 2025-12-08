/**
 * UI Elements - Creates DOM elements for the simulation UI
 * Two navigation modes: Omniscient (A*) and Learned Model
 */

export function createInfoPanelHTML() {
  return `
    <div id="info-panel">
      <h2>🚁 Drone Navigator</h2>
      
      <div class="section">
        <h3>🧭 Navigation Mode</h3>
        <div class="mode-selector">
          <label class="radio-label">
            <input type="radio" name="nav-mode" value="omniscient" checked>
            <span>Omniscient (A*)</span>
          </label>
          <label class="radio-label">
            <input type="radio" name="nav-mode" value="learned" id="learned-mode-radio" disabled>
            <span>Learned Model</span>
          </label>
        </div>
      </div>
      
      <div class="section">
        <h3>Drone</h3>
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
        <h3>Controls</h3>
        <div class="control-group">
          <button id="btn-new-target">New Target</button>
          <button id="btn-reset">Reset</button>
        </div>
      </div>
      
      <div class="section">
        <h3>Display</h3>
        <label class="checkbox-label">
          <input type="checkbox" id="lidar-toggle">
          Show LiDAR
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="path-toggle" checked>
          Show Path
        </label>
      </div>

      <div class="section">
        <h3>LiDAR</h3>
        <div class="lidar-config">
          <label>
            Horizontal rays
            <input type="number" id="lidar-horizontal" min="4" max="64" step="1">
          </label>
          <label>
            Vertical layers
            <input type="number" id="lidar-vertical" min="1" max="16" step="1">
          </label>
          <button id="btn-apply-lidar">Apply</button>
        </div>
      </div>
      
      <div class="section" id="model-section">
        <h3>🧠 Model</h3>
        <div class="stat">
          <span class="label">Status:</span>
          <span id="model-status">Not loaded</span>
        </div>
        <div class="control-group">
          <button id="btn-upload-model">Upload Model</button>
          <button id="btn-train-model">Train Model</button>
        </div>
      </div>
    </div>
    
    <div id="help-panel">
      <p><strong>Manual:</strong> WASD + Q/Z</p>
      <p><strong>R</strong> - New target</p>
    </div>
    
    <!-- Training Modal -->
    <div id="training-modal" class="modal-overlay">
      <div class="modal-content">
        <h2>🧠 Train New Model</h2>
        
        <div class="modal-section">
          <div class="stat">
            <span class="label">Samples:</span>
            <span id="stat-samples">0</span>
          </div>
          <div class="stat">
            <span class="label">Loss:</span>
            <span id="stat-loss">-</span>
          </div>
        </div>
        
        <div class="modal-section">
          <div class="training-inputs">
            <label>
              Episodes:
              <input type="number" id="train-episodes" value="100" min="10" max="5000">
            </label>
            <label>
              Epochs:
              <input type="number" id="train-epochs" value="30" min="5" max="200">
            </label>
          </div>
        </div>
        
        <div id="training-progress" style="display: none;">
          <div class="progress-label">
            <span id="progress-text">Generating...</span>
            <span id="progress-percent">0%</span>
          </div>
          <div class="progress-bar-container">
            <div id="progress-bar" class="progress-bar"></div>
          </div>
        </div>
        
        <div class="modal-actions">
          <button id="btn-generate">Generate Data</button>
          <button id="btn-train" disabled>Train</button>
          <button id="btn-save" disabled>Save Model</button>
          <button id="btn-download-model" disabled>Download Model</button>
          <button id="btn-create-report" disabled>Create Report</button>
        </div>
        
        <button id="btn-close-modal" class="modal-close">Close</button>
      </div>
    </div>
    <input type="file" id="model-file-input" accept=".json" style="display:none">
  `;
}

export function createUIContainer() {
  const container = document.createElement('div');
  container.id = 'ui-container';
  container.innerHTML = createInfoPanelHTML();
  document.body.appendChild(container);

  return {
    // Mode selector
    navModeRadios: document.querySelectorAll('input[name="nav-mode"]'),
    learnedModeRadio: document.getElementById('learned-mode-radio'),
    
    // Drone stats
    speedValue: document.getElementById('speed-value'),
    altitudeValue: document.getElementById('altitude-value'),
    targetDistValue: document.getElementById('target-dist-value'),
    
    // Model status
    modelStatus: document.getElementById('model-status'),
    
    // Buttons
    btnNewTarget: document.getElementById('btn-new-target'),
    btnReset: document.getElementById('btn-reset'),
    btnTrainModel: document.getElementById('btn-train-model'),
    
    // Toggles
    lidarToggle: document.getElementById('lidar-toggle'),
    pathToggle: document.getElementById('path-toggle'),

    // LiDAR config
    lidarHorizontal: document.getElementById('lidar-horizontal'),
    lidarVertical: document.getElementById('lidar-vertical'),
    btnApplyLidar: document.getElementById('btn-apply-lidar'),
    
    // Modal
    trainingModal: document.getElementById('training-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    
    // Training (in modal)
    trainEpisodes: document.getElementById('train-episodes'),
    trainEpochs: document.getElementById('train-epochs'),
    statSamples: document.getElementById('stat-samples'),
    statLoss: document.getElementById('stat-loss'),
    progressContainer: document.getElementById('training-progress'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),
    progressBar: document.getElementById('progress-bar'),
    btnGenerate: document.getElementById('btn-generate'),
    btnTrain: document.getElementById('btn-train'),
    btnSave: document.getElementById('btn-save'),

    // Model files
    btnUploadModel: document.getElementById('btn-upload-model'),
    btnDownloadModel: document.getElementById('btn-download-model'),
    modelFileInput: document.getElementById('model-file-input'),

    // Report
    btnCreateReport: document.getElementById('btn-create-report'),
  };
}
