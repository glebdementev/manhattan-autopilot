/**
 * PathVisualizer - renders omniscient paths in the scene
 *
 * Keeps a simple Three.js line in sync with the current waypoint list.
 */
import * as THREE from 'three';
import { COLORS } from '../config.js';

export class PathVisualizer {
  constructor(sceneManager) {
    this.scene = sceneManager.getScene();
    this.line = null;
    this.enabled = true;
    this.currentPath = null;
  }

  /**
   * Enable/disable visualization without losing the current path
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.line) {
      this.line.visible = enabled;
    }
  }

  /**
   * Update the rendered path.
   * @param {Array<{x:number,y:number,z:number}>|null} path
   */
  updatePath(path) {
    // If disabled, keep cached path but hide geometry
    if (!this.enabled) {
      if (this.line) this.line.visible = false;
      this.currentPath = path;
      return;
    }

    // No path – clear any existing geometry
    if (!path || path.length < 2) {
      this.clear();
      return;
    }

    // Skip if nothing changed
    if (this.currentPath === path && this.line) {
      this.line.visible = true;
      return;
    }

    this.currentPath = path;

    const positions = new Float32Array(path.length * 3);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const idx = i * 3;
      positions[idx] = p.x;
      positions[idx + 1] = p.y;
      positions[idx + 2] = p.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    if (!this.line) {
      const material = new THREE.LineBasicMaterial({
        color: COLORS.PATH,
        transparent: true,
        opacity: 0.9,
      });
      this.line = new THREE.Line(geometry, material);
      this.line.name = 'omniscient_path';
      this.scene.add(this.line);
    } else {
      this.line.geometry.dispose();
      this.line.geometry = geometry;
      this.line.visible = true;
    }
  }

  /**
   * Remove any rendered path from the scene
   */
  clear() {
    this.currentPath = null;
    if (this.line) {
      this.scene.remove(this.line);
      this.line.geometry.dispose();
      this.line.material.dispose();
      this.line = null;
    }
  }
}


