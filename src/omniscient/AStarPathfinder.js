/**
 * AStarPathfinder - A* pathfinding algorithm for 3D grid
 */
import { MinHeap } from './MinHeap.js';

const GRID_RESOLUTION = 1.0;
const VERTICAL_RESOLUTION = 0.5;

export class AStarPathfinder {
  constructor(obstacleGrid) {
    this.obstacleGrid = obstacleGrid;
    this.softMargin = obstacleGrid.getSoftMargin ? obstacleGrid.getSoftMargin() : undefined;
  }
  
  /**
   * Find path from start to goal
   * @returns {Array|null} Array of {x, y, z} waypoints, or null if no path
   */
  findPath(startX, startY, startZ, goalX, goalY, goalZ) {
    const softMargin = this.softMargin;
    // Reject immediately if start/goal are not clear (use softer margin to avoid false negatives)
    if (!this.obstacleGrid.isPositionClear(startX, startY, startZ, softMargin)) {
      console.warn('A* start is not clear');
      return null;
    }
    if (!this.obstacleGrid.isPositionClear(goalX, goalY, goalZ, softMargin)) {
      console.warn('A* goal is not clear');
      return null;
    }
    
    const start = this.toGrid(startX, startY, startZ);
    const goal = this.toGrid(goalX, goalY, goalZ);
    
    const openSet = new MinHeap();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const startKey = this.gridKey(start);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, goal));
    openSet.push({ node: start, f: fScore.get(startKey) });
    
    const closedSet = new Set();
    let iterations = 0;
    const maxIterations = 50000;
    
    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++;
      
      const current = openSet.pop().node;
      const currentWorld = this.toWorld(current);
      const currentKey = this.gridKey(current);
      
      if (this.isAtGoal(current, goal)) {
        return this.reconstructPath(cameFrom, current, startX, startY, startZ, goalX, goalY, goalZ);
      }
      
      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);
      
      for (const neighbor of this.getNeighbors(current)) {
        const neighborKey = this.gridKey(neighbor);
        
        if (closedSet.has(neighborKey)) continue;
        
        const worldPos = this.toWorld(neighbor);
        // Require both the neighbor cell to be clear and the edge between cells to be clear
        if (!this.obstacleGrid.isPositionClear(worldPos.x, worldPos.y, worldPos.z)) continue;
        if (!this.obstacleGrid.isLineClear(currentWorld, worldPos)) continue;
        
        const tentativeG = gScore.get(currentKey) + this.moveCost(current, neighbor);
        
        if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + this.heuristic(neighbor, goal);
          fScore.set(neighborKey, f);
          openSet.push({ node: neighbor, f });
        }
      }
    }
    
    console.warn(`A* failed after ${iterations} iterations`);
    return null;
  }
  
  toGrid(x, y, z) {
    return {
      gx: Math.round(x / GRID_RESOLUTION),
      gy: Math.round(y / VERTICAL_RESOLUTION),
      gz: Math.round(z / GRID_RESOLUTION),
    };
  }
  
  toWorld(grid) {
    return {
      x: grid.gx * GRID_RESOLUTION,
      y: grid.gy * VERTICAL_RESOLUTION,
      z: grid.gz * GRID_RESOLUTION,
    };
  }
  
  gridKey(grid) {
    return `${grid.gx},${grid.gy},${grid.gz}`;
  }
  
  heuristic(a, b) {
    const dx = (a.gx - b.gx) * GRID_RESOLUTION;
    const dy = (a.gy - b.gy) * VERTICAL_RESOLUTION;
    const dz = (a.gz - b.gz) * GRID_RESOLUTION;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  moveCost(from, to) {
    const dx = Math.abs(to.gx - from.gx);
    const dy = Math.abs(to.gy - from.gy);
    const dz = Math.abs(to.gz - from.gz);
    
    const horizDist = Math.sqrt(dx * dx + dz * dz) * GRID_RESOLUTION;
    const vertDist = dy * VERTICAL_RESOLUTION * 1.2; // Penalize vertical
    
    return Math.sqrt(horizDist * horizDist + vertDist * vertDist);
  }
  
  isAtGoal(current, goal) {
    return this.heuristic(current, goal) < GRID_RESOLUTION * 1.5;
  }
  
  getNeighbors(node) {
    const neighbors = [];
    
    // 26-connected neighbors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          
          neighbors.push({
            gx: node.gx + dx,
            gy: node.gy + dy,
            gz: node.gz + dz,
          });
        }
      }
    }
    
    return neighbors;
  }
  
  reconstructPath(cameFrom, current, startX, startY, startZ, goalX, goalY, goalZ) {
    const path = [];
    let node = current;
    
    while (node) {
      const world = this.toWorld(node);
      path.unshift(world);
      
      const key = this.gridKey(node);
      node = cameFrom.get(key);
    }
    
    // Ensure exact start, and snap/append goal only if clear from last node
    if (path.length > 0) {
      path[0] = { x: startX, y: startY, z: startZ };

      const last = path[path.length - 1];
      const goalPoint = { x: goalX, y: goalY, z: goalZ };

      const canReachGoal =
        this.obstacleGrid.isPositionClear(goalPoint.x, goalPoint.y, goalPoint.z) &&
        this.obstacleGrid.isLineClear(last, goalPoint);

      if (canReachGoal) {
        path[path.length - 1] = goalPoint;
      } else {
        // Keep the last safe node; do not force an unsafe goal into the path
        console.warn('A* goal not directly reachable from last node; leaving last safe waypoint.');
      }
    }
    
    return path;
  }
}

