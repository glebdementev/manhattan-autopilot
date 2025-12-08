/**
 * ObstacleGrid - thin adapter over ForestGenerator collision logic
 *
 * We already have a robust collision "computer" in `ForestGenerator`:
 *  - `isPositionClear(x, y, z, margin)` uses box–cylinder checks against
 *    the same obstacle data that drives LiDAR/target placement.
 *  - `isPathClear(startX, startY, startZ, endX, endY, endZ, margin)` walks
 *    along a segment and reuses `isPositionClear`.
 *
 * The omniscient planner should use exactly that, but with a *larger*
 * clearance margin than the runtime drone, so paths never graze canopies
 * and trunks that the mesh collider might still hit.
 */

// Extra safety margin for omniscient planning (on top of drone size)
const CLEAR_MARGIN = 1.0;
// Softer margin for validating start/goal points (avoid over-rejecting on slopes)
const SOFT_MARGIN = 0.4;

export class ObstacleGrid {
  constructor(forestGenerator) {
    this.forest = forestGenerator;
  }
  
  /**
   * Check if a position is clear of obstacles and terrain.
   * Delegates directly to ForestGenerator's box-based collision.
   */
  isPositionClear(x, y, z, margin = CLEAR_MARGIN) {
    return this.forest.isPositionClear(x, y, z, margin);
  }
  
  /**
   * Check if straight line between two points is clear.
   * Delegates to ForestGenerator's path clearance checker.
   */
  isLineClear(from, to, margin = CLEAR_MARGIN) {
    return this.forest.isPathClear(
      from.x, from.y, from.z,
      to.x, to.y, to.z,
      margin,
    );
  }
  
  getClearMargin() {
    return CLEAR_MARGIN;
  }
  
  getSoftMargin() {
    return SOFT_MARGIN;
  }
}

