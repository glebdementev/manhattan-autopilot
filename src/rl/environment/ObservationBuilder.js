/**
 * Observation Builder - SINGLE SOURCE OF TRUTH
 * 
 * Observation = direction to target in world coords [X, Y, Z]
 * Action = acceleration in world coords [X, Y, Z]
 * 
 * If obs[i] > 0, action[i] > 0 moves towards target
 */

export class ObservationBuilder {
  constructor() {
    this.observationSize = 3;
    this.debugCounter = 0;
  }
  
  /**
   * Build observation from drone position and target position
   * This is the ONLY place observation logic exists
   */
  buildFromPositions(droneX, droneY, droneZ, targetX, targetY, targetZ) {
    const dx = targetX - droneX;
    const dy = targetY - droneY;
    const dz = targetZ - droneZ;
    
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    let dirX = 0, dirY = 0, dirZ = 0;
    if (dist > 0.001) {
      dirX = dx / dist;
      dirY = dy / dist;
      dirZ = dz / dist;
    }
    
    const obs = [dirX, dirY, dirZ];
    
    // Debug
    this.debugCounter++;
    if (this.debugCounter <= 10 || this.debugCounter % 500 === 0) {
      console.log(`[OBS] X=${dirX.toFixed(2)} Y=${dirY.toFixed(2)} Z=${dirZ.toFixed(2)}`);
    }
    
    return obs;
  }
  
  /**
   * Legacy build method - calls buildFromPositions
   */
  build(droneState, _a, _b, _c, _d, _e, _f, targetPos) {
    return this.buildFromPositions(
      droneState.x, droneState.y, droneState.z,
      targetPos.x, targetPos.y, targetPos.z
    );
  }
  
  getSpaceInfo() {
    return { size: this.observationSize };
  }
  
  getSize() {
    return this.observationSize;
  }
}
