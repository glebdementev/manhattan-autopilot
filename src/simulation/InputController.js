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
   * 
   * SIMPLE: thrust = world axis acceleration
   * Camera is at +Z looking at -Z, so:
   * - W (forward) = -Z
   * - A (left) = -X
   * - Q (up) = +Y
   */
  getAction() {
    let thrustX = 0;  // World X axis (left/right)
    let thrustY = 0;  // World Y axis (up/down)
    let thrustZ = 0;  // World Z axis (forward/back)
    
    if (this.input.forward) thrustZ = -0.8;  // W = forward = -Z
    if (this.input.backward) thrustZ = 0.8;  // S = backward = +Z
    if (this.input.left) thrustX = -0.8;     // A = left = -X
    if (this.input.right) thrustX = 0.8;     // D = right = +X
    if (this.input.up) thrustY = 0.8;        // Q = up = +Y
    if (this.input.down) thrustY = -0.5;     // Z = down = -Y
    
    return [thrustX, thrustY, thrustZ];
  }
}

