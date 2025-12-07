/**
 * Training Screen - Offline RL training interface
 * Shows training progress without the 3D simulation
 */

export class TrainingScreen {
  constructor() {
    this.element = null;
    this.isVisible = false;
    this.onStop = null;
    this.onDownload = null;
    
    this.create();
  }
  
  create() {
    this.element = document.createElement('div');
    this.element.id = 'training-screen';
    this.element.innerHTML = `
      <div class="training-container">
        <h1>🧠 RL Training in Progress</h1>
        
        <div class="training-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="training-progress-fill"></div>
          </div>
          <div class="progress-text" id="training-progress-text">Episode 0</div>
        </div>
        
        <div class="training-stats-grid">
          <div class="stat-card">
            <div class="stat-value" id="train-episodes">0</div>
            <div class="stat-label">Episodes</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="train-success-rate">0%</div>
            <div class="stat-label">Success Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="train-avg-reward">0</div>
            <div class="stat-label">Avg Reward</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="train-steps">0</div>
            <div class="stat-label">Training Steps</div>
          </div>
        </div>
        
        <div class="training-details">
          <div class="detail-row highlight">
            <span class="detail-label">⚡ Simulation Speed:</span>
            <span class="detail-value speed-value" id="train-speed">0x</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Steps/Second:</span>
            <span class="detail-value" id="train-sps">0</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Exploration Rate:</span>
            <span class="detail-value" id="train-exploration">50%</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Buffer Size:</span>
            <span class="detail-value" id="train-buffer">0</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Policy Loss:</span>
            <span class="detail-value" id="train-policy-loss">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Value Loss:</span>
            <span class="detail-value" id="train-value-loss">-</span>
          </div>
        </div>
        
        <div class="training-log" id="training-log">
          <div class="log-entry">Training started...</div>
        </div>
        
        <div class="training-actions">
          <button id="btn-stop-training" class="btn-danger">Stop Training</button>
          <button id="btn-download-model" class="btn-primary">Download Model</button>
        </div>
      </div>
    `;
    
    // Add styles
    this.addStyles();
    
    // Add to DOM (hidden)
    document.body.appendChild(this.element);
    
    // Setup event listeners
    this.element.querySelector('#btn-stop-training').addEventListener('click', () => {
      if (this.onStop) this.onStop();
    });
    
    this.element.querySelector('#btn-download-model').addEventListener('click', () => {
      if (this.onDownload) this.onDownload();
    });
  }
  
  addStyles() {
    if (document.getElementById('training-screen-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'training-screen-styles';
    style.textContent = `
      #training-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
      }
      
      #training-screen.visible {
        display: flex;
      }
      
      .training-container {
        max-width: 800px;
        width: 90%;
        padding: 40px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      
      .training-container h1 {
        text-align: center;
        color: #00d4ff;
        margin-bottom: 30px;
        font-size: 2rem;
        text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
      }
      
      .training-progress {
        margin-bottom: 30px;
      }
      
      .progress-bar {
        height: 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      
      .progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #00d4ff, #00ff88);
        border-radius: 6px;
        transition: width 0.3s ease;
      }
      
      .progress-text {
        text-align: center;
        color: #888;
        font-size: 0.9rem;
      }
      
      .training-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 30px;
      }
      
      .stat-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .stat-value {
        font-size: 1.8rem;
        font-weight: bold;
        color: #00ff88;
        margin-bottom: 5px;
      }
      
      .stat-label {
        font-size: 0.8rem;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .training-details {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      }
      
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .detail-row:last-child {
        border-bottom: none;
      }
      
      .detail-label {
        color: #888;
      }
      
      .detail-value {
        color: #fff;
        font-weight: 500;
      }
      
      .detail-row.highlight {
        background: rgba(0, 212, 255, 0.1);
        margin: -8px -10px 8px -10px;
        padding: 12px 10px;
        border-radius: 8px;
        border-bottom: none;
      }
      
      .speed-value {
        color: #00d4ff !important;
        font-size: 1.2rem;
        text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
      }
      
      .training-log {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 15px;
        height: 120px;
        overflow-y: auto;
        margin-bottom: 25px;
        font-size: 0.85rem;
      }
      
      .log-entry {
        color: #666;
        padding: 3px 0;
      }
      
      .log-entry.success {
        color: #00ff88;
      }
      
      .log-entry.failure {
        color: #ff6b6b;
      }
      
      .log-entry.info {
        color: #00d4ff;
      }
      
      .training-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
      }
      
      .training-actions button {
        padding: 15px 40px;
        font-size: 1rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #00d4ff, #00ff88);
        color: #000;
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
      }
      
      .btn-danger {
        background: rgba(255, 107, 107, 0.2);
        color: #ff6b6b;
        border: 1px solid #ff6b6b;
      }
      
      .btn-danger:hover {
        background: rgba(255, 107, 107, 0.3);
      }
      
      @media (max-width: 600px) {
        .training-stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .training-container {
          padding: 20px;
        }
        
        .training-container h1 {
          font-size: 1.5rem;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  show() {
    this.isVisible = true;
    this.element.classList.add('visible');
  }
  
  hide() {
    this.isVisible = false;
    this.element.classList.remove('visible');
  }
  
  /**
   * Update training stats
   */
  updateStats(stats) {
    const {
      episodes = 0,
      successRate = 0,
      avgReward = 0,
      trainingSteps = 0,
      explorationRate = 0.5,
      bufferSize = 0,
      policyLoss = null,
      valueLoss = null,
      targetEpisodes = 1000,
      stepsPerSecond = 0,
      simSpeedMultiplier = 0,
    } = stats;
    
    // Update stat cards
    document.getElementById('train-episodes').textContent = episodes;
    document.getElementById('train-success-rate').textContent = `${(successRate * 100).toFixed(1)}%`;
    document.getElementById('train-avg-reward').textContent = avgReward.toFixed(1);
    document.getElementById('train-steps').textContent = trainingSteps;
    
    // Update details - speed first
    document.getElementById('train-speed').textContent = `${simSpeedMultiplier}x real-time`;
    document.getElementById('train-sps').textContent = stepsPerSecond.toLocaleString();
    document.getElementById('train-exploration').textContent = `${(explorationRate * 100).toFixed(1)}%`;
    document.getElementById('train-buffer').textContent = bufferSize;
    document.getElementById('train-policy-loss').textContent = policyLoss !== null ? policyLoss.toFixed(4) : '-';
    document.getElementById('train-value-loss').textContent = valueLoss !== null ? valueLoss.toFixed(4) : '-';
    
    // Update progress bar
    const progress = Math.min(100, (episodes / targetEpisodes) * 100);
    document.getElementById('training-progress-fill').style.width = `${progress}%`;
    document.getElementById('training-progress-text').textContent = `Episode ${episodes} / ${targetEpisodes}`;
  }
  
  /**
   * Add log entry
   */
  log(message, type = 'default') {
    const logContainer = document.getElementById('training-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 50 entries
    while (logContainer.children.length > 50) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }
  
  /**
   * Clear log
   */
  clearLog() {
    const logContainer = document.getElementById('training-log');
    logContainer.innerHTML = '';
  }
}

