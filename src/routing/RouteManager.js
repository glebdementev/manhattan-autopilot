/**
 * Route manager - converts node paths to continuous waypoint routes
 */
import { CITY, CONTROLLER } from '../config.js';

export class RouteManager {
  constructor(roadNetwork, pathFinder) {
    this.network = roadNetwork;
    this.pathFinder = pathFinder;
    
    this.nodePath = [];       // Array of node IDs
    this.waypoints = [];      // Array of {x, z} world positions
    this.currentWaypointIndex = 0;
    this.isLooping = false;
  }

  /**
   * Generate a new random route
   */
  generateRandomRoute(minLength = 5) {
    const result = this.pathFinder.findRandomPath(minLength);
    this.setRoute(result.path);
    return result;
  }

  /**
   * Generate a loop route
   */
  generateLoopRoute(startId = null, minLength = 8) {
    const path = this.pathFinder.findLoopPath(startId, minLength);
    this.setRoute(path, true);
    return path;
  }

  /**
   * Set route from node path
   */
  setRoute(nodePath, isLoop = false) {
    this.nodePath = nodePath;
    this.isLooping = isLoop;
    this.waypoints = this.convertToWaypoints(nodePath);
    this.currentWaypointIndex = 0;
  }

  /**
   * Convert node path to detailed waypoints
   */
  convertToWaypoints(nodePath) {
    if (nodePath.length < 2) return [];
    
    const waypoints = [];
    
    for (let i = 0; i < nodePath.length - 1; i++) {
      const fromNode = this.network.getNode(nodePath[i]);
      const toNode = this.network.getNode(nodePath[i + 1]);
      const edge = this.network.getEdge(nodePath[i], nodePath[i + 1]);
      
      if (edge) {
        // Add waypoints along this edge
        // Skip first waypoint to avoid duplicates (except for first edge)
        const startIdx = i === 0 ? 0 : 1;
        
        for (let j = startIdx; j < edge.waypoints.length; j++) {
          waypoints.push({
            x: edge.waypoints[j].x,
            z: edge.waypoints[j].z,
            isIntersection: j === 0 || j === edge.waypoints.length - 1,
            nodeId: j === 0 ? nodePath[i] : (j === edge.waypoints.length - 1 ? nodePath[i + 1] : null),
          });
        }
      }
    }
    
    return waypoints;
  }

  /**
   * Get current target waypoint based on car position
   */
  getCurrentTarget(carX, carZ, lookahead = CONTROLLER.LOOKAHEAD_MIN) {
    if (this.waypoints.length === 0) return null;
    
    // Find closest waypoint ahead
    let bestIndex = this.currentWaypointIndex;
    let bestDistance = Infinity;
    
    // Search forward from current index
    const searchEnd = Math.min(this.currentWaypointIndex + 20, this.waypoints.length);
    
    for (let i = this.currentWaypointIndex; i < searchEnd; i++) {
      const wp = this.waypoints[i];
      const dx = wp.x - carX;
      const dz = wp.z - carZ;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < bestDistance && distance > 1) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    
    // Update current waypoint if we've passed it
    if (bestIndex > this.currentWaypointIndex) {
      this.currentWaypointIndex = bestIndex;
    }
    
    // Find lookahead target
    let lookaheadIndex = this.currentWaypointIndex;
    let accumulatedDistance = 0;
    
    while (lookaheadIndex < this.waypoints.length - 1 && accumulatedDistance < lookahead) {
      const current = this.waypoints[lookaheadIndex];
      const next = this.waypoints[lookaheadIndex + 1];
      const dx = next.x - current.x;
      const dz = next.z - current.z;
      accumulatedDistance += Math.sqrt(dx * dx + dz * dz);
      lookaheadIndex++;
    }
    
    return this.waypoints[Math.min(lookaheadIndex, this.waypoints.length - 1)];
  }

  /**
   * Get the waypoint for lookahead distance
   */
  getLookaheadTarget(carX, carZ, carHeading, carSpeed) {
    // Dynamic lookahead based on speed
    const lookahead = CONTROLLER.LOOKAHEAD_MIN + 
      carSpeed * CONTROLLER.LOOKAHEAD_GAIN;
    
    return this.getCurrentTarget(carX, carZ, Math.min(lookahead, CONTROLLER.LOOKAHEAD_MAX));
  }

  /**
   * Calculate progress along route (0 to 1)
   */
  getProgress() {
    if (this.waypoints.length === 0) return 0;
    return this.currentWaypointIndex / (this.waypoints.length - 1);
  }

  /**
   * Check if route is complete
   */
  isComplete() {
    return this.currentWaypointIndex >= this.waypoints.length - 1;
  }

  /**
   * Reset to start of route
   */
  reset() {
    this.currentWaypointIndex = 0;
  }

  /**
   * Get all waypoints for visualization
   */
  getAllWaypoints() {
    return this.waypoints;
  }

  /**
   * Get remaining waypoints
   */
  getRemainingWaypoints() {
    return this.waypoints.slice(this.currentWaypointIndex);
  }

  /**
   * Get distance to next intersection
   */
  getDistanceToNextIntersection(carX, carZ) {
    for (let i = this.currentWaypointIndex; i < this.waypoints.length; i++) {
      if (this.waypoints[i].isIntersection) {
        const wp = this.waypoints[i];
        const dx = wp.x - carX;
        const dz = wp.z - carZ;
        return Math.sqrt(dx * dx + dz * dz);
      }
    }
    return Infinity;
  }

  /**
   * Calculate lateral offset from route centerline
   */
  getLateralOffset(carX, carZ) {
    if (this.waypoints.length < 2) return 0;
    
    const idx = this.currentWaypointIndex;
    const prevIdx = Math.max(0, idx - 1);
    
    const p1 = this.waypoints[prevIdx];
    const p2 = this.waypoints[Math.min(idx, this.waypoints.length - 1)];
    
    // Vector from p1 to p2
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    
    if (length < 0.001) return 0;
    
    // Normalize
    const nx = dx / length;
    const nz = dz / length;
    
    // Vector from p1 to car
    const cx = carX - p1.x;
    const cz = carZ - p1.z;
    
    // Cross product gives signed lateral offset
    const lateralOffset = nx * cz - nz * cx;
    
    return lateralOffset;
  }

  /**
   * Get route tangent direction at current position
   */
  getRouteTangent() {
    if (this.waypoints.length < 2) return { x: 1, z: 0 };
    
    const idx = Math.min(this.currentWaypointIndex, this.waypoints.length - 2);
    const p1 = this.waypoints[idx];
    const p2 = this.waypoints[idx + 1];
    
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    
    if (length < 0.001) return { x: 1, z: 0 };
    
    return { x: dx / length, z: dz / length };
  }
}

