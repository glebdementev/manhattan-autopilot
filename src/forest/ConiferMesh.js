/**
 * Conifer (pine/spruce) tree mesh using merged geometry
 * OPTIMIZED: Single mesh with BVH for fast raycasting
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOREST, COLORS } from '../config.js';

export class ConiferMesh {
  constructor() {
    this.foliageMesh = null;
    this.trunkMesh = null;
    this.obstacles = [];
  }

  /**
   * Create conifer trees from tree data using merged geometry
   * @param {Array} trees - Array of {x, y, z, height, radius, rotation}
   */
  create(trees) {
    if (trees.length === 0) return { meshes: [], obstacles: [] };

    // Base geometries (will be cloned and transformed)
    const baseCone = new THREE.ConeGeometry(1, 2.5, 8);
    const baseTrunk = new THREE.CylinderGeometry(0.25, 0.35, 1, 8);
    
    const coneGeometries = [];
    const trunkGeometries = [];
    
    trees.forEach((tree) => {
      const trunkHeight = tree.height * 0.3;
      const coneHeight = tree.height * 0.7;
      const trunkWidthScale = 0.8 + (tree.height / 24) * 0.6;
      
      // Clone and transform trunk geometry
      const trunkGeom = baseTrunk.clone();
      trunkGeom.scale(trunkWidthScale, trunkHeight, trunkWidthScale);
      trunkGeom.translate(tree.x, tree.y + trunkHeight / 2, tree.z);
      trunkGeometries.push(trunkGeom);
      
      // Clone and transform cone geometry
      const coneGeom = baseCone.clone();
      coneGeom.scale(tree.radius, coneHeight / 2.5, tree.radius);
      coneGeom.translate(tree.x, tree.y + trunkHeight + coneHeight / 2, tree.z);
      coneGeometries.push(coneGeom);
      
      // Store obstacles
      this.obstacles.push({
        type: 'trunk',
        x: tree.x, 
        z: tree.z,
        radius: FOREST.CONIFER_TRUNK_RADIUS * trunkWidthScale,
        minY: tree.y,
        maxY: tree.y + trunkHeight,
      });
      
      this.obstacles.push({
        type: 'canopy',
        x: tree.x, 
        z: tree.z,
        radius: tree.radius,
        minY: tree.y + trunkHeight,
        maxY: tree.y + tree.height,
      });
    });
    
    // Merge all geometries into single meshes
    const mergedTrunkGeom = mergeGeometries(trunkGeometries, false);
    const mergedConeGeom = mergeGeometries(coneGeometries, false);
    
    // Dispose individual geometries
    trunkGeometries.forEach(g => g.dispose());
    coneGeometries.forEach(g => g.dispose());
    baseCone.dispose();
    baseTrunk.dispose();
    
    // Create materials
    const coneMat = new THREE.MeshLambertMaterial({ color: COLORS.CONIFER_FOLIAGE });
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.CONIFER_TRUNK });
    
    // Create meshes
    this.foliageMesh = new THREE.Mesh(mergedConeGeom, coneMat);
    this.trunkMesh = new THREE.Mesh(mergedTrunkGeom, trunkMat);
    
    this.foliageMesh.castShadow = true;
    this.trunkMesh.castShadow = true;
    
    return {
      meshes: [this.trunkMesh, this.foliageMesh],
      obstacles: this.obstacles
    };
  }

  getMeshes() {
    return [this.trunkMesh, this.foliageMesh].filter(m => m !== null);
  }

  getObstacles() {
    return this.obstacles;
  }
}
