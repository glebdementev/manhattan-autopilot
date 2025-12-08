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
        <h3>🧭 Navigation</h3>
        <div class="stat">
          <span class="label">Status:</span>
          <span id="nav-status">Navigating...</span>
        </div>
        <div class="stat">
          <span class="label">Remaining:</span>
          <span id="nav-progress">0m</span>
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
      <h2>📊 Sensor View</h2>
      
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
        <h3>📡 Obstacle Detection</h3>
        <div class="stat">
          <span class="label">Min Distance:</span>
          <span id="obs-min-obstacle" class="obs-value">∞</span> m
        </div>
      </div>
      
      <div class="section">
        <h3>↕️ Vertical Sensors</h3>
        <div class="stat">
          <span class="label">Ground (↓):</span>
          <span id="obs-nadir" class="obs-value">∞</span> m
        </div>
      </div>
      
      <div class="section">
        <h3>🚀 Velocity</h3>
        <div class="stat">
          <span class="label">X:</span>
          <span id="obs-vel-forward" class="obs-value">0.0</span> m/s
        </div>
        <div class="stat">
          <span class="label">Y:</span>
          <span id="obs-vel-right" class="obs-value">0.0</span> m/s
        </div>
        <div class="stat">
          <span class="label">Z:</span>
          <span id="obs-vel-up" class="obs-value">0.0</span> m/s
        </div>
      </div>
      
      <div class="section">
        <h3>📈 Episode</h3>
        <div class="stat">
          <span class="label">Steps:</span>
          <span id="episode-step-count">0</span>
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
    
    // Navigation status
    navStatus: document.getElementById('nav-status'),
    navProgress: document.getElementById('nav-progress'),
    
    // Buttons
    btnNewTarget: document.getElementById('btn-new-target'),
    btnReset: document.getElementById('btn-reset'),
    
    // Toggles
    lidarToggle: document.getElementById('lidar-toggle'),
    
    // Observation display elements
    obsTargetDist: document.getElementById('obs-target-dist'),
    obsTargetDir: document.getElementById('obs-target-dir'),
    obsTargetVisible: document.getElementById('obs-target-visible'),
    obsMinObstacle: document.getElementById('obs-min-obstacle'),
    obsNadir: document.getElementById('obs-nadir'),
    obsVelForward: document.getElementById('obs-vel-forward'),
    obsVelRight: document.getElementById('obs-vel-right'),
    obsVelUp: document.getElementById('obs-vel-up'),
    
    // Episode stats
    episodeStepCount: document.getElementById('episode-step-count'),
  };
}
