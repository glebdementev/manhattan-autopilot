/**
 * InputController - Handles keyboard input for manual drone control
 */
export class InputController {
  constructor() {
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
    };
    
    this.onReset = null;
  }

  /**
   * Set reset callback
   */
  setOnReset(callback) {
    this.onReset = callback;
  }

  /**
   * Handle key down event
   */
  handleKeyDown(key) {
    switch (key) {
      case 'w': case 'arrowup':
        this.input.forward = true;
        break;
      case 's': case 'arrowdown':
        this.input.backward = true;
        break;
      case 'a': case 'arrowleft':
        this.input.left = true;
        break;
      case 'd': case 'arrowright':
        this.input.right = true;
        break;
      case 'q':
        this.input.up = true;
        break;
      case 'z':
        this.input.down = true;
        break;
      case 'r':
        if (this.onReset) this.onReset();
        break;
    }
  }

  /**
   * Handle key up event
   */
  handleKeyUp(key) {
    switch (key) {
      case 'w': case 'arrowup':
        this.input.forward = false;
        break;
      case 's': case 'arrowdown':
        this.input.backward = false;
        break;
      case 'a': case 'arrowleft':
        this.input.left = false;
        break;
      case 'd': case 'arrowright':
        this.input.right = false;
        break;
      case 'q':
        this.input.up = false;
        break;
      case 'z':
        this.input.down = false;
        break;
    }
  }

  /**
   * Get current action from input state
   * @returns {number[]} [thrustX, thrustY, thrustZ]
   */
  getAction() {
    let thrustX = 0;
    let thrustY = 0;
    let thrustZ = 0;
    
    if (this.input.forward) thrustX = 0.8;
    if (this.input.backward) thrustX = -0.8;
    if (this.input.left) thrustY = 0.8;
    if (this.input.right) thrustY = -0.8;
    if (this.input.up) thrustZ = 0.8;
    if (this.input.down) thrustZ = -0.5;
    
    return [thrustX, thrustY, thrustZ];
  }
}

