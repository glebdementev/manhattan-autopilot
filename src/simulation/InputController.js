/**
 * InputController - Handles keyboard input for manual drone control
 * Outputs velocity setpoints [-1, 1] (same as RL agent)
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

  setOnReset(callback) {
    this.onReset = callback;
  }

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
   * Get velocity setpoint action from input state
   * @returns {number[]} [vx, vy, vz] velocity setpoints in [-1, 1]
   * 
   * Camera is at +Z looking at -Z, so:
   * - W (forward) = -Z velocity
   * - A (left) = -X velocity
   * - Q (up) = +Y velocity
   */
  getAction() {
    let vx = 0;
    let vy = 0;
    let vz = 0;
    
    if (this.input.forward) vz = -0.8;
    if (this.input.backward) vz = 0.8;
    if (this.input.left) vx = -0.8;
    if (this.input.right) vx = 0.8;
    if (this.input.up) vy = 0.8;
    if (this.input.down) vy = -0.5;
    
    return [vx, vy, vz];
  }
}
