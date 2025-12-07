/**
 * Materials for forest elements
 */
import * as THREE from 'three';
import { COLORS } from '../config.js';

/**
 * Create terrain material with vertex colors
 */
export function createTerrainMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: false,
  });
}

/**
 * Create conifer trunk material (dark bark)
 */
export function createConiferTrunkMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.CONIFER_TRUNK,
    roughness: 0.95,
    metalness: 0.0,
  });
}

/**
 * Create conifer foliage material (dark green)
 */
export function createConiferFoliageMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.CONIFER_FOLIAGE,
    roughness: 0.8,
    metalness: 0.0,
  });
}

/**
 * Create deciduous trunk material (lighter bark)
 */
export function createDeciduousTrunkMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.DECIDUOUS_TRUNK,
    roughness: 0.9,
    metalness: 0.0,
  });
}

/**
 * Create deciduous foliage material (bright green)
 */
export function createDeciduousFoliageMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.DECIDUOUS_FOLIAGE,
    roughness: 0.7,
    metalness: 0.0,
  });
}

/**
 * Create bush material
 */
export function createBushMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.BUSH,
    roughness: 0.85,
    metalness: 0.0,
  });
}

/**
 * Create drone body material
 */
export function createDroneMaterial(mode = 'classic') {
  let color;
  switch (mode) {
    case 'autopilot':
      color = COLORS.DRONE_AUTOPILOT;
      break;
    case 'manual':
      color = COLORS.DRONE_MANUAL;
      break;
    case 'classic':
    default:
      color = COLORS.DRONE_CLASSIC;
      break;
  }
  
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.3,
    metalness: 0.7,
    emissive: color,
    emissiveIntensity: 0.2,
  });
}

/**
 * Create drone light material (glowing)
 */
export function createDroneLightMaterial() {
  return new THREE.MeshBasicMaterial({
    color: COLORS.DRONE_LIGHT,
    transparent: true,
    opacity: 0.9,
  });
}

/**
 * Create target marker material
 */
export function createTargetMaterial() {
  return new THREE.MeshBasicMaterial({
    color: COLORS.TARGET,
    transparent: true,
    opacity: 0.8,
  });
}

