/**
 * Bush mesh using merged geometry
 * OPTIMIZED: Single mesh with BVH for fast raycasting
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from '../config.js';

export class BushMesh {
  constructor() {
    this.bushMesh = null;
    this.obstacles = [];
  }

  /**
   * Create bushes from bush data using merged geometry
   * @param {Array} bushes - Array of {x, y, z, size}
   */
  create(bushes) {
    if (bushes.length === 0) return { meshes: [], obstacles: [] };

    const baseBush = new THREE.SphereGeometry(1, 6, 6);
    const bushGeometries = [];
    
    bushes.forEach((bush) => {
      const bushGeom = baseBush.clone();
      bushGeom.scale(bush.size, bush.size * 0.7, bush.size);
      bushGeom.translate(bush.x, bush.y + bush.size * 0.5, bush.z);
      bushGeometries.push(bushGeom);
      
      this.obstacles.push({
        type: 'bush',
        x: bush.x, 
        z: bush.z,
        radius: bush.size,
        minY: bush.y,
        maxY: bush.y + bush.size * 1.2,
      });
    });
    
    // Merge all geometries
    const mergedGeom = mergeGeometries(bushGeometries, false);
    
    // Dispose individual geometries
    bushGeometries.forEach(g => g.dispose());
    baseBush.dispose();
    
    // Create mesh
    const bushMat = new THREE.MeshLambertMaterial({ color: COLORS.BUSH });
    this.bushMesh = new THREE.Mesh(mergedGeom, bushMat);
    this.bushMesh.name = 'bush';
    this.bushMesh.castShadow = true;
    
    return {
      meshes: [this.bushMesh],
      obstacles: this.obstacles
    };
  }

  getMesh() {
    return this.bushMesh;
  }

  getObstacles() {
    return this.obstacles;
  }
}
