/**
 * Scene manager - handles Three.js scene setup and rendering
 */
import * as THREE from 'three';
import { COLORS, CAMERA, CITY } from '../config.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    
    // Three.js core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Lighting
    this.ambientLight = null;
    this.directionalLight = null;
    
    // Route visualization
    this.routeMesh = null;
    this.waypointMarkers = [];
    
    this.init();
  }

  /**
   * Initialize Three.js scene
   */
  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.SKY);
    this.scene.fog = new THREE.Fog(COLORS.SKY, 100, 400);
    
    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, CAMERA.FOLLOW_HEIGHT, CAMERA.FOLLOW_DISTANCE);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    this.container.appendChild(this.renderer.domElement);
    
    // Lighting
    this.setupLighting();
    
    // Handle resize
    window.addEventListener('resize', () => this.onResize());
  }

  /**
   * Setup scene lighting
   */
  setupLighting() {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(this.ambientLight);
    
    // Main directional light (sun)
    this.directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    this.directionalLight.position.set(100, 150, 50);
    this.directionalLight.castShadow = true;
    
    // Shadow configuration
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 400;
    this.directionalLight.shadow.camera.left = -150;
    this.directionalLight.shadow.camera.right = 150;
    this.directionalLight.shadow.camera.top = 150;
    this.directionalLight.shadow.camera.bottom = -150;
    this.directionalLight.shadow.bias = -0.0005;
    
    this.scene.add(this.directionalLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0x8090b0, 0.4);
    fillLight.position.set(-50, 50, -50);
    this.scene.add(fillLight);
    
    // Hemisphere light for sky/ground color
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362a1e, 0.3);
    this.scene.add(hemiLight);
  }

  /**
   * Add object to scene
   */
  add(object) {
    this.scene.add(object);
  }

  /**
   * Remove object from scene
   */
  remove(object) {
    this.scene.remove(object);
  }

  /**
   * Render the scene
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize
   */
  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  /**
   * Update camera to follow target
   */
  followTarget(targetX, targetZ, targetHeading, mode = 'chase') {
    if (mode === 'bird') {
      // Bird's eye view
      this.camera.position.set(targetX, CAMERA.BIRD_EYE_HEIGHT, targetZ);
      this.camera.lookAt(targetX, 0, targetZ);
    } else {
      // Chase camera
      const offsetX = Math.cos(targetHeading + Math.PI) * CAMERA.FOLLOW_DISTANCE;
      const offsetZ = Math.sin(targetHeading + Math.PI) * CAMERA.FOLLOW_DISTANCE;
      
      const targetCamX = targetX + offsetX;
      const targetCamZ = targetZ + offsetZ;
      
      // Smooth camera movement
      this.camera.position.x += (targetCamX - this.camera.position.x) * CAMERA.FOLLOW_SMOOTHING;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * CAMERA.FOLLOW_SMOOTHING;
      this.camera.position.y = CAMERA.FOLLOW_HEIGHT;
      
      // Look at car
      this.camera.lookAt(targetX, 2, targetZ);
    }
  }

  /**
   * Visualize route waypoints using a proper tube/ribbon mesh
   */
  visualizeRoute(waypoints) {
    // Remove existing route visualization
    this.clearRouteVisualization();
    
    if (waypoints.length < 2) return;
    
    // Create a smooth path from waypoints
    const points = waypoints.map(wp => new THREE.Vector3(wp.x, 0.15, wp.z));
    
    // Create a CatmullRom curve for smooth interpolation
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
    
    // Create tube geometry along the path
    const tubeGeometry = new THREE.TubeGeometry(curve, waypoints.length * 4, 0.4, 8, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      opacity: 0.8,
      transparent: true,
    });
    
    this.routeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    this.scene.add(this.routeMesh);
    
    // Add start and end markers
    const startGeometry = new THREE.SphereGeometry(1, 16, 16);
    const startMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const startMarker = new THREE.Mesh(startGeometry, startMaterial);
    startMarker.position.set(waypoints[0].x, 1, waypoints[0].z);
    this.waypointMarkers.push(startMarker);
    this.scene.add(startMarker);
    
    const endGeometry = new THREE.SphereGeometry(1, 16, 16);
    const endMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const endMarker = new THREE.Mesh(endGeometry, endMaterial);
    const lastWp = waypoints[waypoints.length - 1];
    endMarker.position.set(lastWp.x, 1, lastWp.z);
    this.waypointMarkers.push(endMarker);
    this.scene.add(endMarker);
  }

  /**
   * Clear route visualization
   */
  clearRouteVisualization() {
    if (this.routeMesh) {
      this.scene.remove(this.routeMesh);
      this.routeMesh.geometry.dispose();
      this.routeMesh.material.dispose();
      this.routeMesh = null;
    }
    
    this.waypointMarkers.forEach(marker => {
      this.scene.remove(marker);
      marker.geometry.dispose();
      marker.material.dispose();
    });
    this.waypointMarkers = [];
  }

  /**
   * Get the scene
   */
  getScene() {
    return this.scene;
  }

  /**
   * Get the camera
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Get the renderer
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.renderer.dispose();
    this.clearRouteVisualization();
  }
}
