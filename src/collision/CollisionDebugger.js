/**
 * CollisionDebugger - Debug visualization for collision system
 * 
 * Creates visual helpers to display collision boxes for debugging purposes.
 */
import * as THREE from 'three';

export class CollisionDebugger {
  constructor() {
    this.debugHelpers = [];
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'collision-debug';
    this.enabled = false;
  }
  
  /**
   * Enable/disable debug visualization
   * @param {boolean} enabled 
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.debugGroup.visible = enabled;
  }
  
  /**
   * Check if debug is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
  
  /**
   * Get the debug group for adding to scene
   * @returns {THREE.Group}
   */
  getDebugGroup() {
    return this.debugGroup;
  }
  
  /**
   * Create debug visualization helpers
   * @param {THREE.Scene} scene 
   * @param {Array} obstacleBoxes - Array of obstacle objects with box property
   * @param {THREE.Box3} droneBox - The drone's bounding box
   */
  createHelpers(scene, obstacleBoxes, droneBox) {
    this.clearHelpers();
    
    if (!this.enabled) return;
    
    // Create box helpers for each obstacle
    for (const obstacle of obstacleBoxes) {
      const helper = new THREE.Box3Helper(obstacle.box, 0xff0000);
      this.debugHelpers.push(helper);
      this.debugGroup.add(helper);
    }
    
    // Create drone box helper
    const droneHelper = new THREE.Box3Helper(droneBox, 0x00ff00);
    droneHelper.name = 'drone-collision-box';
    this.debugHelpers.push(droneHelper);
    this.debugGroup.add(droneHelper);
    
    scene.add(this.debugGroup);
  }
  
  /**
   * Update debug visualization (call each frame if debug enabled)
   * @param {THREE.Box3} droneBox - The drone's current bounding box
   */
  updateVisualization(droneBox) {
    if (!this.enabled) return;
    
    // Update drone box helper
    const droneHelper = this.debugGroup.getObjectByName('drone-collision-box');
    if (droneHelper) {
      droneHelper.box.copy(droneBox);
    }
  }
  
  /**
   * Clear all debug helpers
   */
  clearHelpers() {
    for (const helper of this.debugHelpers) {
      if (helper.parent) {
        helper.parent.remove(helper);
      }
      if (helper.geometry) helper.geometry.dispose();
      if (helper.material) helper.material.dispose();
    }
    this.debugHelpers = [];
    
    // Clear children from debug group
    while (this.debugGroup.children.length > 0) {
      this.debugGroup.remove(this.debugGroup.children[0]);
    }
  }
}

