/**
 * A* pathfinding implementation for the road network
 */

export class PathFinder {
  constructor(roadNetwork) {
    this.network = roadNetwork;
  }

  /**
   * Find path between two nodes using A*
   * @param {string} startId - Starting node ID
   * @param {string} endId - Destination node ID
   * @returns {Array} - Array of node IDs forming the path
   */
  findPath(startId, endId) {
    if (startId === endId) {
      return [startId];
    }

    const startNode = this.network.getNode(startId);
    const endNode = this.network.getNode(endId);
    
    if (!startNode || !endNode) {
      console.error('Invalid start or end node');
      return [];
    }

    // A* algorithm
    const openSet = new Set([startId]);
    const cameFrom = new Map();
    
    const gScore = new Map();
    gScore.set(startId, 0);
    
    const fScore = new Map();
    fScore.set(startId, this.heuristic(startNode, endNode));

    while (openSet.size > 0) {
      // Get node with lowest fScore
      const current = this.getLowestFScore(openSet, fScore);
      
      if (current === endId) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      const currentNode = this.network.getNode(current);

      // Check all neighbors
      for (const neighborId of currentNode.neighbors) {
        const edge = this.network.getEdge(current, neighborId);
        const tentativeGScore = gScore.get(current) + edge.distance;

        if (tentativeGScore < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeGScore);
          
          const neighborNode = this.network.getNode(neighborId);
          fScore.set(neighborId, tentativeGScore + this.heuristic(neighborNode, endNode));
          
          if (!openSet.has(neighborId)) {
            openSet.add(neighborId);
          }
        }
      }
    }

    // No path found
    console.warn(`No path found from ${startId} to ${endId}`);
    return [];
  }

  /**
   * Heuristic function (Euclidean distance)
   */
  heuristic(nodeA, nodeB) {
    const dx = nodeB.x - nodeA.x;
    const dz = nodeB.z - nodeA.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Get node with lowest fScore from open set
   */
  getLowestFScore(openSet, fScore) {
    let lowest = null;
    let lowestScore = Infinity;
    
    for (const nodeId of openSet) {
      const score = fScore.get(nodeId) ?? Infinity;
      if (score < lowestScore) {
        lowestScore = score;
        lowest = nodeId;
      }
    }
    
    return lowest;
  }

  /**
   * Reconstruct path from cameFrom map
   */
  reconstructPath(cameFrom, current) {
    const path = [current];
    
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    
    return path;
  }

  /**
   * Find a random path of minimum length
   * @param {number} minLength - Minimum number of nodes in path
   * @returns {Object} - { path, startNode, endNode }
   */
  findRandomPath(minLength = 5) {
    const maxAttempts = 50;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startNode = this.network.getRandomNode();
      const endNode = this.network.getRandomNode();
      
      if (!startNode || !endNode) continue;
      if (startNode.id === endNode.id) continue;
      
      const path = this.findPath(startNode.id, endNode.id);
      
      if (path.length >= minLength) {
        return { path, startNode, endNode };
      }
    }
    
    // Fallback: ensure we get a valid path with different start and end
    let startNode, endNode, path;
    for (let fallbackAttempt = 0; fallbackAttempt < 20; fallbackAttempt++) {
      startNode = this.network.getRandomNode();
      endNode = this.network.getRandomNode();
      
      if (!startNode || !endNode) continue;
      if (startNode.id === endNode.id) continue;
      
      path = this.findPath(startNode.id, endNode.id);
      if (path.length >= 2) {
        return { path, startNode, endNode };
      }
    }
    
    // Ultimate fallback: return whatever we have
    return { path: path || [], startNode, endNode };
  }

  /**
   * Generate a loop path that returns to start
   * @param {string} startId - Starting node ID
   * @param {number} minLength - Minimum path length
   * @returns {Array} - Array of node IDs forming a loop
   */
  findLoopPath(startId = null, minLength = 8) {
    const start = startId 
      ? this.network.getNode(startId) 
      : this.network.getRandomNode();
    
    // Find a point roughly opposite in the grid
    const allNodes = this.network.getAllNodes();
    const midpoint = allNodes.find(n => 
      Math.abs(n.gridX - start.gridX) >= 2 && 
      Math.abs(n.gridZ - start.gridZ) >= 2
    ) || this.network.getRandomNode();
    
    // Path to midpoint
    const pathTo = this.findPath(start.id, midpoint.id);
    
    // Different path back (try to avoid same route)
    const pathBack = this.findPath(midpoint.id, start.id);
    
    // Combine paths (remove duplicate at midpoint)
    const fullPath = [...pathTo, ...pathBack.slice(1)];
    
    return fullPath;
  }
}

