/**
 * Drone - flying box with 6-axis movement
 * 
 * Composes physics, mesh, and state modules for clean separation of concerns.
 * 
 * Physics model:
 * - Controls are in LOCAL coordinates (relative to drone facing)
 * - thrustX > 0 = forward (direction drone is facing)
 * - thrustY > 0 = strafe right
 * - thrustZ > 0 = up
 * - Velocity has inertia (drag-based deceleration)
 */
import { DronePhysics } from './DronePhysics.js';
import { DroneMesh } from './DroneMesh.js';
import { DroneState } from './DroneState.js';

export class Drone {
  constructor() {
    // Core modules
    this.physics = new DronePhysics();
    this.droneMesh = new DroneMesh();
    this.droneState = new DroneState(this.physics);
    
    // Expose mesh for scene
    this.mesh = this.droneMesh.getMesh();
    
    // Expose light for backwards compatibility
    this.droneLight = this.droneMesh.droneLight;
  }
  
  /**
   * Set scene reference for proximity light detection
   */
  setScene(scene) {
    this.droneMesh.setScene(scene);
  }
  
  /**
   * Set collision checker (forest generator reference)
   */
  setCollisionChecker(checker) {
    this.physics.setCollisionChecker(checker);
  }
  
  /**
   * Refresh collision data (call after scene regeneration)
   */
  refreshCollisionData() {
    this.physics.refreshCollisionData();
  }
  
  /**
   * Set collision callback
   */
  setOnCollision(callback) {
    this.physics.setOnCollision(callback);
  }
  
  /**
   * Update drone physics and mesh
   */
  update(dt) {
    const result = this.physics.update(dt);
    this.updateMesh();
    return result;
  }
  
  /**
   * Check collision at a specific position
   */
  checkCollisionAtPosition(posX, posY, posZ) {
    return this.physics.checkCollisionAtPosition(posX, posY, posZ);
  }
  
  /**
   * Legacy method for backwards compatibility
   */
  checkCollision(newX, newY, newZ) {
    return this.checkCollisionAtPosition(newX, newY, newZ);
  }
  
  /**
   * Check if drone had a collision in the last update
   */
  hadCollision() {
    return this.physics.hadCollision();
  }
  
  /**
   * Get the type of the last collision
   */
  getLastCollisionType() {
    return this.physics.getLastCollisionType();
  }
  
  /**
   * Set drone position
   */
  setPosition(x, y, z) {
    this.physics.setPosition(x, y, z);
    this.updateMesh();
  }

  /**
   * Set drone yaw
   */
  setYaw(yaw) {
    this.physics.setYaw(yaw);
    this.updateMesh();
  }
  
  /**
   * Make drone face a target position
   */
  lookAt(targetX, targetZ) {
    this.physics.lookAt(targetX, targetZ);
    this.updateMesh();
  }
  
  /**
   * Force mesh update to match physics state
   */
  updateMesh() {
    const localVel = this.physics.getLocalVelocity();
    this.droneMesh.update(
      this.physics.x,
      this.physics.y,
      this.physics.z,
      this.physics.yaw,
      localVel
    );
  }
  
  /**
   * Set control inputs
   */
  setControls(thrustX, thrustY, thrustZ) {
    this.physics.setControls(thrustX, thrustY, thrustZ);
  }
  
  /**
   * Get current state vector
   */
  getState() {
    return this.droneState.getState();
  }
  
  /**
   * Get velocity in LOCAL coordinates
   */
  getLocalVelocity() {
    return this.physics.getLocalVelocity();
  }
  
  /**
   * Get forward direction vector in world coords
   */
  getForwardVector() {
    return this.physics.getForwardVector();
  }
  
  /**
   * Transform world coordinates to drone-local coordinates
   */
  worldToLocal(worldX, worldY, worldZ) {
    return this.physics.worldToLocal(worldX, worldY, worldZ);
  }
  
  /**
   * Reset drone state
   */
  reset() {
    this.physics.reset();
    this.droneMesh.reset();
    this.updateMesh();
  }
  
  /**
   * Get the Three.js mesh
   */
  getMesh() {
    return this.mesh;
  }
  
  /**
   * Get the collision system
   */
  getCollisionSystem() {
    return this.physics.getCollisionSystem();
  }
  
  /**
   * Set drone body color based on mode
   */
  setMode(mode) {
    this.droneMesh.setMode(mode);
  }
  
  // ==========================================
  // Property accessors for backwards compatibility
  // ==========================================
  
  get x() { return this.physics.x; }
  set x(val) { this.physics.x = val; }
  
  get y() { return this.physics.y; }
  set y(val) { this.physics.y = val; }
  
  get z() { return this.physics.z; }
  set z(val) { this.physics.z = val; }
  
  get vx() { return this.physics.vx; }
  set vx(val) { this.physics.vx = val; }
  
  get vy() { return this.physics.vy; }
  set vy(val) { this.physics.vy = val; }
  
  get vz() { return this.physics.vz; }
  set vz(val) { this.physics.vz = val; }
  
  get yaw() { return this.physics.yaw; }
  set yaw(val) { this.physics.yaw = val; }
  
  get thrustX() { return this.physics.thrustX; }
  set thrustX(val) { this.physics.thrustX = val; }
  
  get thrustY() { return this.physics.thrustY; }
  set thrustY(val) { this.physics.thrustY = val; }
  
  get thrustZ() { return this.physics.thrustZ; }
  set thrustZ(val) { this.physics.thrustZ = val; }
  
  get distanceTraveled() { return this.physics.distanceTraveled; }
  get maxSpeedReached() { return this.physics.maxSpeedReached; }
  
  get lastCollision() { return this.physics.lastCollision; }
  get lastCollisionType() { return this.physics.lastCollisionType; }
  get collisionFrozen() { return this.physics.collisionFrozen; }
  set collisionFrozen(val) { this.physics.collisionFrozen = val; }
}
