/**
 * Materials for city elements
 */
import * as THREE from 'three';
import { COLORS } from '../config.js';

/**
 * Create road material with subtle texture
 */
export function createRoadMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.ROAD,
    roughness: 0.9,
    metalness: 0.1,
  });
}

/**
 * Create road marking material (white lines)
 */
export function createMarkingMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.ROAD_MARKING,
    roughness: 0.5,
    metalness: 0.0,
    emissive: COLORS.ROAD_MARKING,
    emissiveIntensity: 0.1,
  });
}

/**
 * Create sidewalk material
 */
export function createSidewalkMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.SIDEWALK,
    roughness: 0.95,
    metalness: 0.0,
  });
}

/**
 * Create building material with variation
 */
export function createBuildingMaterial(variation = 0) {
  const baseColor = new THREE.Color(COLORS.BUILDING_BASE);
  const accentColor = new THREE.Color(COLORS.BUILDING_ACCENT);
  
  // Add slight color variation
  const color = baseColor.lerp(accentColor, variation);
  
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.2,
  });
}

/**
 * Create window material for buildings
 */
export function createWindowMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x88aacc,
    roughness: 0.1,
    metalness: 0.8,
    emissive: 0xffffcc,
    emissiveIntensity: 0.15,
  });
}

/**
 * Create ground material
 */
export function createGroundMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.GROUND,
    roughness: 1.0,
    metalness: 0.0,
  });
}

