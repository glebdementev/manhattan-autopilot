import { FOREST } from '../config.js';

/**
 * BoundsEnforcer - Keeps drones within forest bounds
 */
export class BoundsEnforcer {
  constructor(forestGenerator) {
    this.forestGenerator = forestGenerator;
    this.margin = 5;
  }

  /**
   * Update forest generator reference
   */
  setForestGenerator(forestGenerator) {
    this.forestGenerator = forestGenerator;
  }

  /**
   * Enforce bounds on a drone
   * @returns {boolean} Whether position was changed
   */
  enforce(drone) {
    const state = drone.getState();
    const halfSize = FOREST.SIZE / 2 - this.margin;
    
    let x = state.x;
    let y = state.y;
    let z = state.z;
    let changed = false;
    
    // Horizontal bounds
    if (x < -halfSize) { x = -halfSize; changed = true; }
    if (x > halfSize) { x = halfSize; changed = true; }
    if (z < -halfSize) { z = -halfSize; changed = true; }
    if (z > halfSize) { z = halfSize; changed = true; }
    
    // Vertical bounds (terrain)
    const groundY = this.forestGenerator.getTerrainHeight(x, z);
    const minY = groundY + 0.5;
    
    if (y < minY) { 
      y = minY; 
      changed = true; 
    }
    
    if (changed) {
      drone.setPosition(x, y, z);
    }
    
    return changed;
  }
}

