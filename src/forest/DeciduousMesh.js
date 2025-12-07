/**
 * Deciduous (oak/maple) tree mesh using InstancedMesh
 * Features ellipsoid canopy for realistic appearance
 */
import * as THREE from 'three';
import { FOREST, COLORS } from '../config.js';

export class DeciduousMesh {
  constructor() {
    this.canopyInstances = null;
    this.trunkInstances = null;
    this.obstacles = [];
  }

  /**
   * Create deciduous trees from tree data
   * @param {Array} trees - Array of {x, y, z, height, radius, rotation}
   */
  create(trees) {
    if (trees.length === 0) return { meshes: [], obstacles: [] };

    // Ellipsoid for canopy - stretched vertically for realistic tree shape
    // Using sphere geometry that will be scaled to ellipsoid
    const canopyGeom = new THREE.SphereGeometry(1, 8, 8);
    const canopyMat = new THREE.MeshLambertMaterial({ color: COLORS.DECIDUOUS_FOLIAGE });
    
    // Trunk cylinder - unit size, will be scaled per instance (50% narrower)
    const trunkGeom = new THREE.CylinderGeometry(0.25, 0.35, 1, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.DECIDUOUS_TRUNK });
    
    this.canopyInstances = new THREE.InstancedMesh(canopyGeom, canopyMat, trees.length);
    this.trunkInstances = new THREE.InstancedMesh(trunkGeom, trunkMat, trees.length);
    
    this.canopyInstances.castShadow = true;
    this.trunkInstances.castShadow = true;
    
    const canopyMatrix = new THREE.Matrix4();
    const trunkMatrix = new THREE.Matrix4();
    
    trees.forEach((tree, i) => {
      // Trunk takes 35% of height for taller deciduous trees
      const trunkHeight = tree.height * 0.35;
      // Canopy ellipsoid dimensions
      const canopyWidth = tree.radius * 1.2;  // Wider
      const canopyHeight = tree.radius * 1.4; // Taller - ellipsoid shape
      const canopyDepth = tree.radius * 1.2;  // Same as width
      
      // Position canopy center
      const canopyCenterY = tree.y + trunkHeight + canopyHeight * 0.5;
      
      // Trunk width depends on tree height (taller = wider trunk)
      const trunkWidthScale = 0.9 + (tree.height / 22) * 0.7; // 0.9 to 1.6 based on height
      
      // Trunk
      trunkMatrix.identity();
      trunkMatrix.makeTranslation(tree.x, tree.y + trunkHeight / 2, tree.z);
      const trunkScale = new THREE.Matrix4().makeScale(trunkWidthScale, trunkHeight, trunkWidthScale);
      trunkMatrix.multiply(trunkScale);
      this.trunkInstances.setMatrixAt(i, trunkMatrix);
      
      // Canopy (ellipsoid) - scaled sphere
      canopyMatrix.identity();
      canopyMatrix.makeTranslation(tree.x, canopyCenterY, tree.z);
      const canopyScale = new THREE.Matrix4().makeScale(canopyWidth, canopyHeight, canopyDepth);
      canopyMatrix.multiply(canopyScale);
      this.canopyInstances.setMatrixAt(i, canopyMatrix);
      
      // Store trunk obstacle (narrower, for target placement)
      this.obstacles.push({
        type: 'trunk',
        x: tree.x, 
        z: tree.z,
        radius: FOREST.DECIDUOUS_TRUNK_RADIUS * trunkWidthScale,
        minY: tree.y,
        maxY: tree.y + trunkHeight,
      });
      
      // Store canopy obstacle (wider, for drone collision)
      this.obstacles.push({
        type: 'canopy',
        x: tree.x, 
        z: tree.z,
        radius: Math.max(canopyWidth, canopyDepth),
        minY: tree.y + trunkHeight,
        maxY: tree.y + trunkHeight + canopyHeight * 2,
      });
    });
    
    this.canopyInstances.instanceMatrix.needsUpdate = true;
    this.trunkInstances.instanceMatrix.needsUpdate = true;
    
    return {
      meshes: [this.trunkInstances, this.canopyInstances],
      obstacles: this.obstacles
    };
  }

  getMeshes() {
    return [this.trunkInstances, this.canopyInstances].filter(m => m !== null);
  }

  getObstacles() {
    return this.obstacles;
  }
}

