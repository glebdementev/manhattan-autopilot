/**
 * PathSmoother - Smooths A* paths by removing unnecessary waypoints
 */
export class PathSmoother {
  constructor(obstacleGrid) {
    this.obstacleGrid = obstacleGrid;
  }
  
  /**
   * Smooth path by removing unnecessary waypoints
   */
  smooth(path) {
    if (path.length <= 2) return path;
    
    const smoothed = [path[0]];
    let i = 0;
    
    while (i < path.length - 1) {
      let furthest = i + 1;
      
      // Try to skip ahead while maintaining clear line
      for (let j = i + 2; j < path.length; j++) {
        if (this.obstacleGrid.isLineClear(path[i], path[j])) {
          furthest = j;
        }
      }
      
      smoothed.push(path[furthest]);
      i = furthest;
    }
    
    return smoothed;
  }
}

