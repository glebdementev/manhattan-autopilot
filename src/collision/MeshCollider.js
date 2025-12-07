/**
 * MeshCollider - Simple mesh-based collision using Three.js Raycaster
 * 
 * Casts rays from drone center in 6 directions to detect collisions
 */
import * as THREE from 'three';

export class MeshCollider {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.targets = [];
    this.droneRadius = 0.5; // Collision radius around drone center
    
    // Pre-allocate direction vectors for 6 cardinal directions
    this.directions = [
      new THREE.Vector3(1, 0, 0),   // +X
      new THREE.Vector3(-1, 0, 0),  // -X
      new THREE.Vector3(0, 1, 0),   // +Y (up)
      new THREE.Vector3(0, -1, 0),  // -Y (down)
      new THREE.Vector3(0, 0, 1),   // +Z
      new THREE.Vector3(0, 0, -1),  // -Z
    ];
    
    // Additional diagonal directions for better coverage
    const diag = 0.707; // 1/sqrt(2)
    this.diagonals = [
      new THREE.Vector3(diag, 0, diag),
      new THREE.Vector3(diag, 0, -diag),
      new THREE.Vector3(-diag, 0, diag),
      new THREE.Vector3(-diag, 0, -diag),
    ];
    
    this._origin = new THREE.Vector3();
    this._intersects = [];
  }
  
  /**
   * Set collision targets (meshes to check against)
   */
  setTargets(targets) {
    this.targets = targets;
  }
  
  /**
   * Set drone collision radius
   */
  setDroneRadius(radius) {
    this.droneRadius = radius;
  }
  
  /**
   * Check collision at position
   * @returns {Object} { collided: boolean, type: string|null, distance: number }
   */
  checkCollision(x, y, z) {
    if (this.targets.length === 0) {
      return { collided: false, type: null, distance: Infinity };
    }
    
    this._origin.set(x, y, z);
    
    // Check all cardinal directions
    for (const dir of this.directions) {
      const result = this.castRay(dir);
      if (result.collided) {
        return result;
      }
    }
    
    // Check diagonal directions
    for (const dir of this.diagonals) {
      const result = this.castRay(dir);
      if (result.collided) {
        return result;
      }
    }
    
    return { collided: false, type: null, distance: Infinity };
  }
  
  /**
   * Cast a single ray and check for collision within drone radius
   */
  castRay(direction) {
    this.raycaster.set(this._origin, direction);
    this.raycaster.far = this.droneRadius;
    
    this._intersects.length = 0;
    this.raycaster.intersectObjects(this.targets, false, this._intersects);
    
    if (this._intersects.length > 0) {
      const hit = this._intersects[0];
      const type = this.getCollisionType(hit.object);
      return {
        collided: true,
        type: type,
        distance: hit.distance,
      };
    }
    
    return { collided: false, type: null, distance: Infinity };
  }
  
  /**
   * Determine collision type from mesh
   */
  getCollisionType(mesh) {
    const name = mesh.name?.toLowerCase() || '';
    const matColor = mesh.material?.color?.getHex?.() || 0;
    
    // Check by name
    if (name.includes('terrain') || name.includes('ground')) return 'terrain';
    if (name.includes('trunk')) return 'trunk';
    if (name.includes('canopy') || name.includes('foliage')) return 'canopy';
    if (name.includes('bush')) return 'bush';
    
    // Check by material color (fallback)
    // Brown colors = trunk
    if ((matColor & 0xFF0000) > 0x300000 && (matColor & 0x00FF00) < 0x006000) {
      return 'trunk';
    }
    // Green colors = foliage
    if ((matColor & 0x00FF00) > 0x004000) {
      return 'canopy';
    }
    
    return 'obstacle';
  }
  
  /**
   * Check swept collision along a path
   */
  checkSweptCollision(startX, startY, startZ, endX, endY, endZ) {
    const dx = endX - startX;
    const dy = endY - startY;
    const dz = endZ - startZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 0.001) {
      return this.checkCollision(endX, endY, endZ);
    }
    
    // Check start, middle, and end
    const steps = Math.max(2, Math.ceil(dist / (this.droneRadius * 0.5)));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startX + dx * t;
      const y = startY + dy * t;
      const z = startZ + dz * t;
      
      const result = this.checkCollision(x, y, z);
      if (result.collided) {
        return result;
      }
    }
    
    return { collided: false, type: null, distance: Infinity };
  }
}

