/**
 * Deciduous (oak/maple) tree mesh using merged geometry
 * OPTIMIZED: Single mesh with BVH for fast raycasting
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOREST, COLORS } from '../config.js';

export class DeciduousMesh {
  constructor() {
    this.canopyMesh = null;
    this.trunkMesh = null;
    this.obstacles = [];
  }

  /**
   * Create deciduous trees from tree data using merged geometry
   * @param {Array} trees - Array of {x, y, z, height, radius, rotation}
   */
  create(trees) {
    if (trees.length === 0) return { meshes: [], obstacles: [] };

    // Base geometries
    const baseCanopy = new THREE.SphereGeometry(1, 8, 8);
    const baseTrunk = new THREE.CylinderGeometry(0.25, 0.35, 1, 8);
    
    const canopyGeometries = [];
    const trunkGeometries = [];
    
    trees.forEach((tree) => {
      const trunkHeight = tree.height * 0.35;
      const canopyWidth = tree.radius * 1.2;
      const canopyHeight = tree.radius * 1.4;
      const canopyDepth = tree.radius * 1.2;
      const canopyCenterY = tree.y + trunkHeight + canopyHeight * 0.5;
      const trunkWidthScale = 0.9 + (tree.height / 22) * 0.7;
      
      // Clone and transform trunk geometry
      const trunkGeom = baseTrunk.clone();
      trunkGeom.scale(trunkWidthScale, trunkHeight, trunkWidthScale);
      trunkGeom.translate(tree.x, tree.y + trunkHeight / 2, tree.z);
      trunkGeometries.push(trunkGeom);
      
      // Clone and transform canopy geometry (ellipsoid)
      const canopyGeom = baseCanopy.clone();
      canopyGeom.scale(canopyWidth, canopyHeight, canopyDepth);
      canopyGeom.translate(tree.x, canopyCenterY, tree.z);
      canopyGeometries.push(canopyGeom);
      
      // Store obstacles
      this.obstacles.push({
        type: 'trunk',
        x: tree.x, 
        z: tree.z,
        radius: FOREST.DECIDUOUS_TRUNK_RADIUS * trunkWidthScale,
        minY: tree.y,
        maxY: tree.y + trunkHeight,
      });
      
      this.obstacles.push({
        type: 'canopy',
        x: tree.x, 
        z: tree.z,
        radius: Math.max(canopyWidth, canopyDepth),
        minY: tree.y + trunkHeight,
        maxY: tree.y + trunkHeight + canopyHeight * 2,
      });
    });
    
    // Merge all geometries into single meshes
    const mergedTrunkGeom = mergeGeometries(trunkGeometries, false);
    const mergedCanopyGeom = mergeGeometries(canopyGeometries, false);
    
    // Dispose individual geometries
    trunkGeometries.forEach(g => g.dispose());
    canopyGeometries.forEach(g => g.dispose());
    baseCanopy.dispose();
    baseTrunk.dispose();
    
    // Create materials
    const canopyMat = new THREE.MeshLambertMaterial({ color: COLORS.DECIDUOUS_FOLIAGE });
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.DECIDUOUS_TRUNK });
    
    // Create meshes
    this.canopyMesh = new THREE.Mesh(mergedCanopyGeom, canopyMat);
    this.trunkMesh = new THREE.Mesh(mergedTrunkGeom, trunkMat);
    
    this.canopyMesh.castShadow = true;
    this.trunkMesh.castShadow = true;
    
    return {
      meshes: [this.trunkMesh, this.canopyMesh],
      obstacles: this.obstacles
    };
  }

  getMeshes() {
    return [this.trunkMesh, this.canopyMesh].filter(m => m !== null);
  }

  getObstacles() {
    return this.obstacles;
  }
}
