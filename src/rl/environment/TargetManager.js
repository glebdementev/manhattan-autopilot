/**
 * Target Manager for RL Environment
 * Handles target position generation and tracking
 */

export class TargetManager {
  constructor(forest, sceneManager = null) {
    this.forest = forest;
    this.sceneManager = sceneManager;
    
    // Target state
    this.targetX = 0;
    this.targetY = 5;
    this.targetZ = 0;
    this.targetRadius = 2.0;
  }
  
  /**
   * Set forest reference
   * @param {Object} forest - Forest generator
   */
  setForest(forest) {
    this.forest = forest;
  }
  
  /**
   * Set scene manager reference
   * @param {Object} sceneManager
   */
  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }
  
  /**
   * Generate a new target position
   * @param {number} droneX - Current drone X position
   * @param {number} droneZ - Current drone Z position
   */
  generate(droneX, droneZ) {
    if (!this.forest) {
      console.warn('TargetManager: No forest set');
      return;
    }
    
    const target = this.forest.generateTargetPosition(droneX, droneZ);
    
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetZ = target.z;
    
    // Update scene marker
    if (this.sceneManager) {
      this.sceneManager.setTargetPosition(target.x, target.y, target.z);
    }
  }
  
  /**
   * Get current target position
   * @returns {Object} - { x, y, z }
   */
  getPosition() {
    return {
      x: this.targetX,
      y: this.targetY,
      z: this.targetZ,
    };
  }
  
  /**
   * Set target position directly
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    
    if (this.sceneManager) {
      this.sceneManager.setTargetPosition(x, y, z);
    }
  }
  
  /**
   * Get target radius (for collision detection)
   * @returns {number}
   */
  getRadius() {
    return this.targetRadius;
  }
  
  /**
   * Set target radius
   * @param {number} radius
   */
  setRadius(radius) {
    this.targetRadius = radius;
  }
  
  /**
   * Calculate distance from a point to target
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  getDistanceFrom(x, y, z) {
    const dx = this.targetX - x;
    const dy = this.targetY - y;
    const dz = this.targetZ - z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Get direction to target from a point (world coordinates, unit vector)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Object} - { x, y, z }
   */
  getDirectionFrom(x, y, z) {
    const dx = this.targetX - x;
    const dy = this.targetY - y;
    const dz = this.targetZ - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) return { x: 0, y: 0, z: 1 };
    
    return {
      x: dx / dist,
      y: dy / dist,
      z: dz / dist,
    };
  }
  
  /**
   * Check if a point is within target radius
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  isReached(x, y, z) {
    return this.getDistanceFrom(x, y, z) < this.targetRadius;
  }
}

