/**
 * PathFollowingDataCollector - Collects ultra-simple path-following samples.
 *
 * Observation: direction to NEXT waypoint in WORLD frame.
 * Action:      same direction vector (identity mapping).
 *
 * The controller later converts this world-space direction into
 * local controls using the same logic as OmniscientController.
 */
export class PathFollowingDataCollector {
  constructor() {
    this.samples = [];
  }
  
  clear() {
    this.samples = [];
  }
  
  getNumSamples() {
    return this.samples.length;
  }
  
  /**
   * Collect a training sample
   * @param {Object} droneState - {x, y, z}
   * @param {Object} nextWaypoint - Immediate next waypoint {x, y, z}
   */
  collectSample(droneState, nextWaypoint) {
    const observation = this.buildObservation(droneState, nextWaypoint);
    const action = this.buildAction(droneState, nextWaypoint);
    this.samples.push({ observation, action });
  }
  
  /**
   * Build observation:
   * [0-2]: world-space unit direction to next waypoint
   * [3]:   normalized distance (0..1)
   */
  buildObservation(droneState, nextWaypoint) {
    const { x, y, z } = droneState;
    
    const dx = nextWaypoint.x - x;
    const dy = nextWaypoint.y - y;
    const dz = nextWaypoint.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const obs = new Float32Array(4);
    
    if (dist > 0.001) {
      const dirX = dx / dist;
      const dirY = dy / dist;
      const dirZ = dz / dist;
      
      obs[0] = dirX;
      obs[1] = dirY;
      obs[2] = dirZ;
      obs[3] = Math.min(1, dist / 50);
    } else {
      // Already at waypoint - arbitrary forward direction
      obs[0] = 0;
      obs[1] = 0;
      obs[2] = 1;
      obs[3] = 0;
    }
    
    return obs;
  }
  
  /**
   * Build action: identical to world direction in observation
   */
  buildAction(droneState, nextWaypoint) {
    const { x, y, z } = droneState;
    
    const dx = nextWaypoint.x - x;
    const dy = nextWaypoint.y - y;
    const dz = nextWaypoint.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) {
      return new Float32Array([0, 0, 1]);
    }
    
    return new Float32Array([dx / dist, dy / dist, dz / dist]);
  }
  
  getSamples() {
    return this.samples;
  }
  
  getObservationDim() {
    return 4;
  }
  
  getActionDim() {
    return 3;
  }
  
  exportSamples() {
    return {
      observationDim: this.getObservationDim(),
      actionDim: this.getActionDim(),
      numSamples: this.samples.length,
      samples: this.samples.map(s => ({
        observation: Array.from(s.observation),
        action: Array.from(s.action),
      })),
    };
  }
  
  importSamples(data) {
    this.samples = data.samples.map(s => ({
      observation: new Float32Array(s.observation),
      action: new Float32Array(s.action),
    }));
  }
}
