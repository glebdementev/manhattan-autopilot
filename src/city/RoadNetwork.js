/**
 * Road network graph for pathfinding
 * Manages the graph structure of intersections and road segments
 */
import { CITY } from '../config.js';

// Lane offset from road center (drive on the right side)
const LANE_OFFSET = CITY.ROAD_WIDTH / 4;

export class RoadNetwork {
  constructor() {
    this.nodes = new Map();  // Intersection nodes
    this.edges = new Map();  // Road segments connecting nodes
  }

  /**
   * Build network from city generator data
   */
  buildFromIntersections(intersections) {
    // Create nodes
    intersections.forEach(intersection => {
      this.nodes.set(intersection.id, {
        id: intersection.id,
        gridX: intersection.gridX,
        gridZ: intersection.gridZ,
        x: intersection.x,
        z: intersection.z,
        neighbors: intersection.neighbors,
      });
    });

    // Create edges (with waypoints for both directions)
    this.nodes.forEach((node, nodeId) => {
      node.neighbors.forEach(neighborId => {
        const edgeId = this.getEdgeId(nodeId, neighborId);
        if (!this.edges.has(edgeId)) {
          const neighbor = this.nodes.get(neighborId);
          const distance = this.calculateDistance(node, neighbor);
          
          // Store waypoints for both travel directions (each on right side of road)
          this.edges.set(edgeId, {
            id: edgeId,
            from: nodeId,
            to: neighborId,
            distance,
            // Forward waypoints (from node -> neighbor)
            forwardWaypoints: this.generateEdgeWaypoints(node, neighbor),
            // Reverse waypoints (from neighbor -> node)
            reverseWaypoints: this.generateEdgeWaypoints(neighbor, node),
          });
        }
      });
    });
  }

  /**
   * Get consistent edge ID (smaller ID first)
   */
  getEdgeId(nodeA, nodeB) {
    return nodeA < nodeB ? `${nodeA}->${nodeB}` : `${nodeB}->${nodeA}`;
  }

  /**
   * Calculate distance between two nodes
   */
  calculateDistance(nodeA, nodeB) {
    const dx = nodeB.x - nodeA.x;
    const dz = nodeB.z - nodeA.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Generate waypoints along an edge (for smoother path following)
   * Waypoints are offset to the right side of the road for lane driving
   */
  generateEdgeWaypoints(fromNode, toNode) {
    const waypoints = [];
    const numPoints = 5; // Intermediate points
    
    // Calculate direction vector
    const dx = toNode.x - fromNode.x;
    const dz = toNode.z - fromNode.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    
    if (length < 0.001) {
      return [{ x: fromNode.x, z: fromNode.z }];
    }
    
    // Normalize direction
    const dirX = dx / length;
    const dirZ = dz / length;
    
    // Calculate perpendicular vector (pointing to the right side of the road)
    // For right-hand traffic: rotate direction 90 degrees clockwise
    const perpX = -dirZ;
    const perpZ = dirX;
    
    // Offset amount for the right lane
    const offsetX = perpX * LANE_OFFSET;
    const offsetZ = perpZ * LANE_OFFSET;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      waypoints.push({
        x: fromNode.x + dx * t + offsetX,
        z: fromNode.z + dz * t + offsetZ,
      });
    }
    
    return waypoints;
  }

  /**
   * Get node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Get edge between two nodes
   */
  getEdge(nodeA, nodeB) {
    const edgeId = this.getEdgeId(nodeA, nodeB);
    return this.edges.get(edgeId);
  }

  /**
   * Get waypoints for traveling from nodeA to nodeB (on the correct side of road)
   */
  getDirectionalWaypoints(fromNodeId, toNodeId) {
    const edge = this.getEdge(fromNodeId, toNodeId);
    if (!edge) return [];
    
    // Check if we're going in the "forward" direction (matches stored from/to)
    if (edge.from === fromNodeId) {
      return edge.forwardWaypoints;
    } else {
      return edge.reverseWaypoints;
    }
  }

  /**
   * Get all edges from a node
   */
  getEdgesFrom(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    
    return node.neighbors.map(neighborId => {
      const edgeId = this.getEdgeId(nodeId, neighborId);
      return this.edges.get(edgeId);
    });
  }

  /**
   * Find nearest node to a world position
   */
  findNearestNode(x, z) {
    let nearestNode = null;
    let minDistance = Infinity;
    
    this.nodes.forEach(node => {
      const dx = node.x - x;
      const dz = node.z - z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestNode = node;
      }
    });
    
    return nearestNode;
  }

  /**
   * Get random node
   */
  getRandomNode() {
    const nodes = Array.from(this.nodes.values());
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  /**
   * Check if two nodes are connected directly
   */
  areConnected(nodeAId, nodeBId) {
    const nodeA = this.nodes.get(nodeAId);
    return nodeA && nodeA.neighbors.includes(nodeBId);
  }
}

