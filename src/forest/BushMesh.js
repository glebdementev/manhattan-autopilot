/**
 * Bush mesh using InstancedMesh
 */
import * as THREE from 'three';
import { COLORS } from '../config.js';

export class BushMesh {
  constructor() {
    this.bushInstances = null;
    this.obstacles = [];
  }

  /**
   * Create bushes from bush data
   * @param {Array} bushes - Array of {x, y, z, size}
   */
  create(bushes) {
    if (bushes.length === 0) return { meshes: [], obstacles: [] };

    // Single sphere geometry for all bushes
    const bushGeom = new THREE.SphereGeometry(1, 6, 6);
    const bushMat = new THREE.MeshLambertMaterial({ color: COLORS.BUSH });
    
    this.bushInstances = new THREE.InstancedMesh(bushGeom, bushMat, bushes.length);
    this.bushInstances.castShadow = true;
    
    const matrix = new THREE.Matrix4();
    
    bushes.forEach((bush, i) => {
      matrix.identity();
      matrix.makeTranslation(bush.x, bush.y + bush.size * 0.5, bush.z);
      const scale = new THREE.Matrix4().makeScale(bush.size, bush.size * 0.7, bush.size);
      matrix.multiply(scale);
      this.bushInstances.setMatrixAt(i, matrix);
      
      this.obstacles.push({
        type: 'bush',
        x: bush.x, 
        z: bush.z,
        radius: bush.size,
        minY: bush.y,
        maxY: bush.y + bush.size * 1.2,
      });
    });
    
    this.bushInstances.instanceMatrix.needsUpdate = true;
    
    return {
      meshes: [this.bushInstances],
      obstacles: this.obstacles
    };
  }

  getMesh() {
    return this.bushInstances;
  }

  getObstacles() {
    return this.obstacles;
  }
}

