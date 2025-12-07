/**
 * UI Elements - Creates and manages DOM elements for the UI
 */

/**
 * Create the main info panel HTML structure
 */
export function createInfoPanelHTML() {
  return `
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
            <input type="radio" name="driver-mode" value="rl">
            🤖 RL Agent Only
          </label>
          <label>
            <input type="radio" name="driver-mode" value="manual" checked>
            🎮 Manual + Ghost RL
          </label>
        </div>
      </div>
      
      <div class="section" id="camera-section">
        <h3>📷 Camera Follow</h3>
        <div class="radio-group">
          <label>
            <input type="radio" name="camera-target" value="manual" checked>
            🎮 Manual Drone
          </label>
          <label>
            <input type="radio" name="camera-target" value="ghost">
            👻 Ghost RL
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
            <input type="checkbox" id="training-toggle">
            Enable Training
          </label>
        </div>
        
        <div class="control-group">
          <label class="checkbox-label">
            <input type="checkbox" id="learn-from-manual-toggle">
            Learn from Manual
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
      <p><strong>Q/Z</strong> - Up/Down</p>
      <p><strong>R</strong> - New target</p>
    </div>
    
    <div id="reward-indicator"></div>
  `;
}

/**
 * Create the main UI container with all elements
 * @returns {Object} References to all UI elements
 */
export function createUIContainer() {
  const container = document.createElement('div');
  container.id = 'ui-container';
  container.innerHTML = createInfoPanelHTML();
  document.body.appendChild(container);

  // Return references to all elements
  return {
    // Drone stats
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
    learnFromManualToggle: document.getElementById('learn-from-manual-toggle'),
    lidarToggle: document.getElementById('lidar-toggle'),
    
    // Reward indicator
    rewardIndicator: document.getElementById('reward-indicator'),
  };
}

