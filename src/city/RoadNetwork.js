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

    // Create edges
    this.nodes.forEach((node, nodeId) => {
      node.neighbors.forEach(neighborId => {
        const edgeId = this.getEdgeId(nodeId, neighborId);
        if (!this.edges.has(edgeId)) {
          const neighbor = this.nodes.get(neighborId);
          const distance = this.calculateDistance(node, neighbor);
          
          this.edges.set(edgeId, {
            id: edgeId,
            from: nodeId,
            to: neighborId,
            distance,
            waypoints: this.generateEdgeWaypoints(node, neighbor),
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
   */
  generateEdgeWaypoints(fromNode, toNode) {
    const waypoints = [];
    const numPoints = 5; // Intermediate points
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      waypoints.push({
        x: fromNode.x + (toNode.x - fromNode.x) * t,
        z: fromNode.z + (toNode.z - fromNode.z) * t,
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
    con