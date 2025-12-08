/**
 * Scene manager - handles Three.js scene setup and rendering
 * OPTIMIZED: Reduced shadow quality, simpler lighting
 */
import * as THREE from 'three';
import { COLORS, CAMERA, FOREST } from '../config.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.targetMarker = null;
    
    this.init();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.SKY);
    this.scene.fog = new THREE.FogExp2(COLORS.FOG, 0.012);
    
    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 300);
    this.camera.position.set(0, CAMERA.FOLLOW_HEIGHT, CAMERA.FOLLOW_DISTANCE);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer - OPTIMIZED settings
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: false, // Disabled for performance
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // Fastest shadow type
    
    this.container.appendChild(this.renderer.domElement);
    
    this.setupLighting();
    this.createTargetMarker();
    
    window.addEventListener('resize', () => this.onResize());
  }

  setupLighting() {
    // Simple ambient light
    const ambient = new THREE.AmbientLight(0x607060, 0.7);
    this.scene.add(ambient);
    
    // Single directional light with shadows
    const sun = new THREE.DirectionalLight(0xfff8e0, 0.9);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    
    // Reduced shadow quality for performance
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    
    this.scene.add(sun);
    
    // Hemisphere light for ambient color
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x2d4a1c, 0.3);
    this.scene.add(hemi);
  }

  createTargetMarker() {
    const group = new THREE.Group();
    group.name = 'target_marker';
    
    // Simple glowing box
    const boxGeom = new THREE.BoxGeometry(2.0, 2.0, 2.0);
    const boxMat = new THREE.MeshBasicMaterial({
      color: COLORS.TARGET,
      transparent: true,
      opacity: 0.7,
    });
    const box = new THREE.Mesh(boxGeom, boxMat);
    group.add(box);
    
    // Vertical beam
    const beamGeom = new THREE.CylinderGeometry(0.15, 0.15, 40, 6);
    const beamMat = new THREE.MeshBasicMaterial({
      color: COLORS.TARGET,
      transparent: true,
      opacity: 0.25,
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = 20;
    group.add(beam);
    
    // Point light
    const light = new THREE.PointLight(COLORS.TARGET, 1.5, 15);
    group.add(light);
    
    this.targetMarker = group;
    this.scene.add(this.targetMarker);
  }

  setTargetPosition(x, y, z) {
    if (this.targetMarker) {
      this.targetMarker.position.set(x, y, z);
    }
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  followTarget(targetX, targetY, targetZ, targetYaw, mode = 'chase') {
    if (mode === 'bird') {
      this.camera.position.set(targetX, CAMERA.BIRD_EYE_HEIGHT, targetZ);
      this.camera.lookAt(targetX, targetY, targetZ);
    } else {
      // Camera behind drone based on yaw angle
      // Drone forward is in the direction of yaw, so camera is opposite (behind)
      const behindX = -Math.sin(targetYaw) * CAMERA.FOLLOW_DISTANCE;
      const behindZ = -Math.cos(targetYaw) * CAMERA.FOLLOW_DISTANCE;
      
      const targetCamX = targetX + behindX;
      const targetCamY = targetY + CAMERA.FOLLOW_HEIGHT;
      const targetCamZ = targetZ + behindZ;
      
      this.camera.position.x += (targetCamX - this.camera.position.x) * CAMERA.FOLLOW_SMOOTHING;
      this.camera.position.y += (targetCamY - this.camera.position.y) * CAMERA.FOLLOW_SMOOTHING;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * CAMERA.FOLLOW_SMOOTHING;
      
      this.camera.lookAt(targetX, targetY, targetZ);
    }
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }

  dispose() {
    this.renderer.dispose();
  }
}
