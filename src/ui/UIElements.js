/**
 * UI Elements - Creates and manages DOM elements for the simulation UI
 */

/**
 * Create the main info panel HTML structure
 */
export function createInfoPanelHTML() {
  return `
    <div id="info-panel">
      <h2>🚁 Drone Navigator</h2>
      
      <div class="section">
        <h3>Manual Drone</h3>
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
      
      <div class="section" id="ghost-section" style="display: none;">
        <h3>👻 RL Ghost Drone</h3>
        <div class="stat">
          <span class="label">Status:</span>
          <span id="ghost-status">No model loaded</span>
        </div>
        <div class="stat">
          <span class="label">To Target:</span>
          <span id="ghost-dist-value">-</span> m
        </div>
      </div>
      
      <div class="section">
        <h3>🧠 RL Model</h3>
        <div class="stat">
          <span class="label">Status:</span>
          <span id="model-status">No model</span>
        </div>
        <div class="control-group">
          <button id="btn-train">Train New Model</button>
          <button id="btn-import">Load Model</button>
        </div>
        <input type="file" id="model-file-input" accept=".json" style="display: none;">
      </div>
      
      <div class="section" id="camera-section" style="display: none;">
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
      
      <div class="section">
        <h3>Controls</h3>
        <div class="control-group">
          <button id="btn-new-target">New Target</button>
          <button id="btn-reset">Reset Position</button>
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
    
    // Ghost drone stats
    ghostSection: document.getElementById('ghost-section'),
    ghostStatus: document.getElementById('ghost-status'),
    ghostDistValue: document.getElementById('ghost-dist-value'),
    
    // Model
    modelStatus: document.getElementById('model-status'),
    
    // Buttons
    btnNewTarget: document.getElementById('btn-new-target'),
    btnReset: document.getElementById('btn-reset'),
    btnTrain: document.getElementById('btn-train'),
    btnImport: document.getElementById('btn-import'),
    modelFileInput: document.getElementById('model-file-input'),
    
    // Toggles
    lidarToggle: document.getElementById('lidar-toggle'),
    
    // Sections
    cameraSection: document.getElementById('camera-section'),
    
    // Reward indicator
    rewardIndicator: document.getElementById('reward-indicator'),
  };
}
