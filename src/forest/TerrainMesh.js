/**
 * Terrain mesh generator using Perlin noise
 */
import * as THREE from 'three';
import { FOREST, COLORS } from '../config.js';

export class TerrainMesh {
  constructor(perlin) {
    this.perlin = perlin;
    this.mesh = null;
  }

  /**
   * Get terrain height at a given world position
   */
  getHeight(x, z) {
    const scale = FOREST.TERRAIN_SCALE;
    const height = FOREST.TERRAIN_HEIGHT;
    return this.perlin.fbm(x * scale, z * scale, 3, 2, 0.5) * height;
  }

  /**
   * Create terrain mesh
   */
  create() {
    const size = FOREST.SIZE;
    const segments = FOREST.TERRAIN_SEGMENTS;
    
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    const lowColor = new THREE.Color(COLORS.GROUND_LOW);
    const highColor = new THREE.Color(COLORS.GROUND_HIGH);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const height = this.getHeight(x, z);
      
      positions.setY(i, height);
      
      const t = (height / FOREST.TERRAIN_HEIGHT + 1) / 2;
      const color = lowColor.clone().lerp(highColor, t);
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
    
    return this.mesh;
  }

  getMesh() {
    return this.mesh;
  }
}

