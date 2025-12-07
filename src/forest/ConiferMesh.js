/**
 * Conifer (pine/spruce) tree mesh using InstancedMesh
 */
import * as THREE from 'three';
import { FOREST, COLORS } from '../config.js';

export class ConiferMesh {
  constructor() {
    this.coneInstances = null;
    this.trunkInstances = null;
    this.obstacles = [];
  }

  /**
   * Create conifer trees from tree data
   * @param {Array} trees - Array of {x, y, z, height, radius, rotation}
   */
  create(trees) {
    if (trees.length === 0) return { meshes: [], obstacles: [] };

    // Cone for foliage - taller and more prominent
    const coneGeom = new THREE.ConeGeometry(1, 2.5, 8);
    const coneMat = new THREE.MeshLambertMaterial({ color: COLORS.CONIFER_FOLIAGE });
    
    // Trunk cylinder - unit size, will be scaled per instance (50% narrower)
    const trunkGeom = new THREE.CylinderGeometry(0.25, 0.35, 1, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.CONIFER_TRUNK });
    
    this.coneInstances = new THREE.InstancedMesh(coneGeom, coneMat, trees.length);
    this.trunkInstances = new THREE.InstancedMesh(trunkGeom, trunkMat, trees.length);
    
    this.coneInstances.castShadow = true;
    this.trunkInstances.castShadow = true;
    
    const coneMatrix = new THREE.Matrix4();
    const trunkMatrix = new THREE.Matrix4();
    
    trees.forEach((tree, i) => {
      // Trunk takes 30% of height, foliage takes 70%
      const trunkHeight = tree.height * 0.3;
      const coneHeight = tree.height * 0.7;
      
      // Trunk width depends on tree height (taller = wider trunk)
      const trunkWidthScale = 0.8 + (tree.height / 24) * 0.6; // 0.8 to 1.4 based on height
      
      // Trunk - positioned at base
      trunkMatrix.identity();
      trunkMatrix.makeTranslation(tree.x, tree.y + trunkHeight / 2, tree.z);
      const trunkScale = new THREE.Matrix4().makeScale(trunkWidthScale, trunkHeight, trunkWidthScale);
      trunkMatrix.multiply(trunkScale);
      this.trunkInstances.setMatrixAt(i, trunkMatrix);
      
      // Cone (foliage) - positioned above trunk
      coneMatrix.identity();
      coneMatrix.makeTranslation(tree.x, tree.y + trunkHeight + coneHeight / 2, tree.z);
      const coneScale = new THREE.Matrix4().makeScale(tree.radius, coneHeight / 2.5, tree.radius);
      coneMatrix.multiply(coneScale);
      this.coneInstances.setMatrixAt(i, coneMatrix);
      
      // Store obstacle
      this.obstacles.push({
        type: 'tree',
        x: tree.x, 
        z: tree.z,
        radius: tree.radius,
        minY: tree.y,
        maxY: tree.y + tree.height,
      });
    });
    
    this.coneInstances.instanceMatrix.needsUpdate = true;
    this.trunkInstances.instanceMatrix.needsUpdate = true;
    
    return {
      meshes: [this.trunkInstances, this.coneInstances],
      obstacles: this.obstacles
    };
  }

  getMeshes() {
    return [this.trunkInstances, this.coneInstances].filter(m => m !== null);
  }

  getObstacles() {
    return this.obstacles;
  }
}

