/**
 * Simple event emitter mixin for UI components
 */

export class EventEmitter {
  constructor() {
    this.callbacks = {};
  }

  /**
   * Register a callback for an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  /**
   * Remove a callback for an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (!this.callbacks[event]) return;
    
    this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
  }

  /**
   * Emit an event with optional data
   * @param {string} event - Event name
   * @param {*} data - Data to pass to callbacks
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }
}

