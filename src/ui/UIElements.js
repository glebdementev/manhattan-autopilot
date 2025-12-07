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
    
    <div id="reward-panel">
      <h2>📊 Model View</h2>
      
      <div class="section">
        <h3>🎯 Target</h3>
        <div class="stat">
          <span class="label">Distance:</span>
          <span id="obs-target-dist">0.0</span> m
        </div>
        <div class="stat">
          <span class="label">Direction:</span>
          <span id="obs-target-dir" class="obs-value">(0, 0, 0)</span>
        </div>
        <div class="stat">
          <span class="label">Visible:</span>
          <span id="obs-target-visible" class="obs-value">No</span>
        </div>
      </div>
      
      <div class="section">
        <h3>📡 4 Closest Obstacles</h3>
        <div class="obstacle-grid">
          <div class="obstacle-item">
            <span class="obs-label">#1</span>
            <span id="obs-obstacle-1" class="obs-value">-</span>
          </div>
          <div class="obstacle-item">
            <span class="obs-label">#2</span>
            <span id="obs-obstacle-2" class="obs-value">-</span>
          </div>
          <div class="obstacle-item">
            <span class="obs-label">#3</span>
            <span id="obs-obstacle-3" class="obs-value">-</span>
          </div>
          <div class="obstacle-item">
            <span class="obs-label">#4</span>
            <span id="obs-obstacle-4" class="obs-value">-</span>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h3>↕️ Vertical Sensors</h3>
        <div class="stat">
          <span class="label">Nadir (↓):</span>
          <span id="obs-nadir" class="obs-value">∞</span> m
        </div>
        <div class="stat">
          <span class="label">Zenith (↑):</span>
          <span id="obs-zenith" class="obs-value">∞</span> m
        </div>
      </div>
      
      <div class="section">
        <h3>🚀 Velocity (local)</h3>
        <div class="stat">
          <span class="label">Forward:</span>
          <span id="obs-vel-forward" class="obs-value">0.0</span>
        </div>
        <div class="stat">
          <span class="label">Right:</span>
          <span id="obs-vel-right" class="obs-value">0.0</span>
        </div>
        <div class="stat">
          <span class="label">Up:</span>
          <span id="obs-vel-up" class="obs-value">0.0</span>
        </div>
      </div>
      
      <div class="section">
        <h3>💰 Step Rewards</h3>
        <div class="stat">
          <span class="label">Progress:</span>
          <span id="reward-progress" class="reward-neutral">+0.000</span>
        </div>
        <div class="stat">
          <span class="label">Proximity:</span>
          <span id="reward-proximity" class="reward-neutral">+0.000</span>
        </div>
        <div class="stat">
          <span class="label">Time:</span>
          <span id="reward-time" class="reward-neutral">-0.010</span>
        </div>
        <div class="stat" id="reward-terminal-row" style="display: none;">
          <span class="label" id="reward-terminal-label">Terminal:</span>
          <span id="reward-terminal" class="reward-neutral">0.000</span>
        </div>
        <div class="stat total-row">
          <span class="label">Step Total:</span>
          <span id="reward-total" class="reward-neutral">+0.000</span>
        </div>
      </div>
      
      <div class="section">
        <h3>📈 Episode</h3>
        <div class="stat">
          <span class="label">Total Reward:</span>
          <span id="episode-total-reward" class="reward-neutral">0.0</span>
        </div>
        <div class="stat">
          <span class="label">Steps:</span>
          <span id="episode-step-count">0</span>
        </div>
      </div>
      
      <div class="section" id="action-section" style="display: none;">
        <h3>🎮 Model Action</h3>
        <div class="stat">
          <span class="label">Forward:</span>
          <span id="action-forward" class="obs-value">0.00</span>
        </div>
        <div class="stat">
          <span class="label">Right:</span>
          <span id="action-right" class="obs-value">0.00</span>
        </div>
        <div class="stat">
          <span class="label">Up:</span>
          <span id="action-up" class="obs-value">0.00</span>
        </div>
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
    
    // Reward display panel
    rewardSection: document.getElementById('reward-panel'),
    rewardProgress: document.getElementById('reward-progress'),
    rewardProximity: document.getElementById('reward-proximity'),
    rewardTime: document.getElementById('reward-time'),
    rewardTerminal: document.getElementById('reward-terminal'),
    rewardTerminalRow: document.getElementById('reward-terminal-row'),
    rewardTerminalLabel: document.getElementById('reward-terminal-label'),
    rewardTotal: document.getElementById('reward-total'),
    episodeTotalReward: document.getElementById('episode-total-reward'),
    episodeStepCount: document.getElementById('episode-step-count'),
    
    // Observation display elements
    obsTargetDist: document.getElementById('obs-target-dist'),
    obsTargetDir: document.getElementById('obs-target-dir'),
    obsTargetVisible: document.getElementById('obs-target-visible'),
    obsObstacle1: document.getElementById('obs-obstacle-1'),
    obsObstacle2: document.getElementById('obs-obstacle-2'),
    obsObstacle3: document.getElementById('obs-obstacle-3'),
    obsObstacle4: document.getElementById('obs-obstacle-4'),
    obsNadir: document.getElementById('obs-nadir'),
    obsZenith: document.getElementById('obs-zenith'),
    obsVelForward: document.getElementById('obs-vel-forward'),
    obsVelRight: document.getElementById('obs-vel-right'),
    obsVelUp: document.getElementById('obs-vel-up'),
    
    // Model action display
    actionSection: document.getElementById('action-section'),
    actionForward: document.getElementById('action-forward'),
    actionRight: document.getElementById('action-right'),
    actionUp: document.getElementById('action-up'),
  };
}
