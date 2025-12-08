/**
 * InputController - Handles keyboard input for manual drone control
 * Outputs LOCAL velocity setpoints: [forward, vertical, yawRate]
 * 
 * Controls:
 * - W/S or Up/Down: Forward/Backward movement
 * - A/D or Left/Right: Turn left/right (yaw)
 * - Q/Z: Up/Down (vertical)
 */
export class InputController {
  constructor() {
    this.input = {
      forward: false,
      backward: false,
      turnLeft: false,
      turnRight: false,
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
        this.input.turnLeft = true;
        break;
      case 'd': case 'arrowright':
        this.input.turnRight = true;
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
        this.input.turnLeft = false;
        break;
      case 'd': case 'arrowright':
        this.input.turnRight = false;
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
   * Get LOCAL velocity setpoint action from input state
   * @returns {number[]} [forward, vertical, yawRate] in [-1, 1]
   * 
   * - forward: positive = move in drone's facing direction
   * - vertical: positive = up
   * - yawRate: positive = turn right, negative = turn left
   */
  getAction() {
    let forward = 0;
    let vertical = 0;
    let yawRate = 0;
    
    if (this.input.forward) forward = 0.8;
    if (this.input.backward) forward = -0.5;
    if (this.input.turnLeft) yawRate = -0.8;
    if (this.input.turnRight) yawRate = 0.8;
    if (this.input.up) vertical = 0.8;
    if (this.input.down) vertical = -0.5;
    
    return [forward, vertical, yawRate];
  }
}
