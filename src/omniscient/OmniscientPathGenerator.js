/**
 * OmniscientPathGenerator - Generates perfect paths using A* with full environment knowledge
 */
import { ObstacleGrid } from './ObstacleGrid.js';
import { AStarPathfinder } from './AStarPathfinder.js';
import { PathSmoother } from './PathSmoother.js';

export class OmniscientPathGenerator {
  constructor(forestGenerator) {
    this.forest = forestGenerator;
    this.obstacleGrid = new ObstacleGrid(forestGenerator);
    this.pathfinder = new AStarPathfinder(this.obstacleGrid);
    this.smoother = new PathSmoother(this.obstacleGrid);
  }
  
  /**
   * Generate path from start to target
   * @returns {Array|null} Array of {x, y, z} waypoints, or null if no path
   */
  generatePath(startX, startY, startZ, targetX, targetY, targetZ) {
    const rawPath = this.pathfinder.findPath(
      startX, startY, startZ,
      targetX, targetY, targetZ
    );
    
    if (!rawPath) return null;
    
    return this.smoother.smooth(rawPath);
  }
  
  /**
   * Check if position is clear
   */
  isPositionClear(x, y, z) {
    return this.obstacleGrid.isPositionClear(x, y, z);
  }
  
  /**
   * Check if line between two points is clear
   */
  isLineClear(from, to) {
    return this.obstacleGrid.isLineClear(from, to);
  }
}
