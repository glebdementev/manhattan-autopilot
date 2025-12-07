/**
 * Splash Screens - Handles collision, success, and timeout splash overlays
 */

/**
 * Splash screen manager for episode end events
 */
export class SplashScreens {
  constructor() {
    this.splashTimeout = null;
    this.elements = {};
    
    this.createSplashScreens();
  }

  /**
   * Create all splash screen overlays
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
   * @param {string} type - Type of collision ('terrain', 'tree', 'bush')
   */
  showCollision(type) {
    const typeLabels = {
      'terrain': 'Ground collision (-50)',
      'tree': 'Tree collision (-50)',
      'bush': 'Bush collision (-50)',
    };
    
    this.elements.collisionMessage.textContent = typeLabels[type] || type;
    this.show(this.elements.collisionSplash);
  }

  /**
   * Show success splash screen
   */
  showSuccess() {
    this.show(this.elements.successSplash);
  }

  /**
   * Show timeout splash screen
   */
  showTimeout() {
    this.show(this.elements.timeoutSplash);
  }

  /**
   * Show a splash screen with auto-hide
   * @param {HTMLElement} splash - The splash element to show
   */
  show(splash) {
    // Hide all splashes first
    this.hideAll();
    
    splash.classList.add('visible');
    
    if (this.splashTimeout) {
      clearTimeout(this.splashTimeout);
    }
    
    this.splashTimeout = setTimeout(() => {
      this.hideAll();
    }, 800);
  }

  /**
   * Hide all splash screens
   */
  hideAll() {
    this.elements.collisionSplash.classList.remove('visible');
    this.elements.successSplash.classList.remove('visible');
    this.elements.timeoutSplash.classList.remove('visible');
  }
}

