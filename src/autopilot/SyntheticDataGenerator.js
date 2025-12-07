/**
 * Synthetic data generator for instant training data creation
 * Generates training examples by sampling positions geometrically
 * and computing LiDAR + controller outputs mathematically
 * Updated for drone navigation in forest environment
 */
import { FOREST, LIDAR, DRONE, CONTROLLER, AUTOPILOT } from '../config.js';

// Simple Perlin noise (same as ForestGenerator)
class PerlinNoise {
  constructor(seed = 12345) {
    this.permutation = this.generatePermutation(seed);
  }

  generatePermutation(seed) {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    return [...p, ...p];
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const p = this.permutation;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    
    return this.lerp(
      this.lerp(this.grad(p[A], x, y), this.grad(p[B], x - 1, y), u),
      this.lerp(this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1), u),
      v
    );
  }

  fbm(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    return value / maxValue;
  }
}

export class SyntheticDataGenerator {
  constructor(seed = 42) {
    this.seed = seed;
    this.perlin = new PerlinNoise(seed);
    
    // Forest geometry
    this.forestSize = FOREST.SIZE;
    this.halfSize = FOREST.SIZE / 2;
    
    // Pre-calculate ray directions for LiDAR simulation
    this.rayDirections = this.calculateRayDirections();
    
    // Build obstacle geometry (trees and bushes as cylinders/spheres)
    this.obstacles = this.buildObstacleGeometry();
  }

  /**
   * Calculate ray directions (same as Lidar class)
   */
  calculateRayDirections() {
    const directions = [];
    
    const hFov = LIDAR.HORIZONTAL_FOV;
    const vFov = LIDAR.VERTICAL_FOV;
    const numH = LIDAR.NUM_HORIZONTAL_RAYS;
    const numV = LIDAR.NUM_VERTICAL_RAYS;
    
    for (let v = 0; v < numV; v++) {
      const verticalAngle = -vFov / 2 + (v / Math.max(numV - 1, 1)) * vFov;
      
      for (let h = 0; h < numH; h++) {
        const horizontalAngle = -hFov / 2 + (h / Math.max(numH - 1, 1)) * hFov;
        
        const cosV = Math.cos(verticalAngle);
        const sinV = Math.sin(verticalAngle);
        const cosH = Math.cos(horizontalAngle);
        const sinH = Math.sin(horizontalAngle);
        
        directions.push({
          x: sinH * cosV,
          y: sinV,
          z: cosH * cosV,
        });
      }
    }
    
    return directions;
  }

  /**
   * Get terrain height at position
   */
  getTerrainHeight(x, z) {
    const scale = FOREST.TERRAIN_SCALE;
    const height = FOREST.TERRAIN_HEIGHT;
    return this.perlin.fbm(x * scale, z * scale, 4, 2, 0.5) * height;
  }

  /**
   * Build simplified obstacle geometry for ray testing
   */
  buildObstacleGeometry() {
    const obstacles = [];
    
    // Use seeded random for reproducibility
    let seed = this.seed * 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    // Generate trees
    const numTrees = Math.floor(this.forestSize * this.forestSize * FOREST.TREE_DENSITY);
    
    for (let i = 0; i < numTrees; i++) {
      const x = (random() - 0.5) * this.forestSize;
      const z = (random() - 0.5) * this.forestSize;
      
      // Skip center spawn area
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
      
      const groundY = this.getTerrainHeight(x, z);
      const isConifer = random() < FOREST.CONIFER_RATIO;
      
      let height, radius;
      if (isConifer) {
        height = FOREST.CONIFER_MIN_HEIGHT + random() * (FOREST.CONIFER_MAX_HEIGHT - FOREST.CONIFER_MIN_HEIGHT);
        radius = FOREST.CONIFER_CROWN_RADIUS * (0.7 + random() * 0.6);
      } else {
        height = FOREST.DECIDUOUS_MIN_HEIGHT + random() * (FOREST.DECIDUOUS_MAX_HEIGHT - FOREST.DECIDUOUS_MIN_HEIGHT);
        radius = FOREST.DECIDUOUS_CROWN_RADIUS * (0.7 + random() * 0.6);
      }
      
      obstacles.push({
        type: 'tree',
        x, z,
        minY: groundY,
        maxY: groundY + height,
        radius: radius,
      });
    }
    
    // Generate bushes
    const numBushes = Math.floor(this.forestSize * this.forestSize * FOREST.BUSH_DENSITY);
    
    for (let i = 0; i < numBushes; i++) {
      const x = (random() - 0.5) * this.forestSize;
      const z = (random() - 0.5) * this.forestSize;
      
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      
      const groundY = this.getTerrainHeight(x, z);
      const size = FOREST.BUSH_MIN_SIZE + random() * (FOREST.BUSH_MAX_SIZE - FOREST.BUSH_MIN_SIZE);
      
      obstacles.push({
        type: 'bush',
        x, z,
        minY: groundY,
        maxY: groundY + size * 1.5,
        radius: size,
      });
    }
    
    return obstacles;
  }

  /**
   * Ray-cylinder intersection (simplified for vertical cylinders)
   */
  rayCylinderIntersect(rayX, rayY, rayZ, dirX, dirY, dirZ, obs) {
    // 2D intersection with cylinder (ignore Y for horizontal intersection)
    const dx = rayX - obs.x;
    const dz = rayZ - obs.z;
    
    const a = dirX * dirX + dirZ * dirZ;
    const b = 2 * (dx * dirX + dz * dirZ);
    const c = dx * dx + dz * dz - obs.radius * obs.radius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return LIDAR.MAX_RANGE;
    
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    
    // Check if hit is within vertical bounds
    for (const t of [t1, t2]) {
      if (t > 0 && t < LIDAR.MAX_RANGE) {
        const hitY = rayY + dirY * t;
        if (hitY >= obs.minY && hitY <= obs.maxY) {
          return t;
        }
      }
    }
    
    return LIDAR.MAX_RANGE;
  }

  /**
   * Ray-ground intersection
   */
  rayGroundIntersect(rayX, rayY, rayZ, dirX, dirY, dirZ) {
    // Simple check: if ray points down, find intersection with terrain
    if (dirY >= 0) return LIDAR.MAX_RANGE;
    
    // Approximate: check a few points along ray
    for (let t = 1; t < LIDAR.MAX_RANGE; t += 0.5) {
      const px = rayX + dirX * t;
      const py = rayY + dirY * t;
      const pz = rayZ + dirZ * t;
      
      const groundY = this.getTerrainHeight(px, pz);
      if (py <= groundY) {
        return t;
      }
    }
    
    return LIDAR.MAX_RANGE;
  }

  /**
   * Simulate LiDAR scan at a given position
   */
  simulateLidar(x, y, z, yaw = 0) {
    const numRays = this.rayDirections.length;
    const distances = new Array(numRays);
    
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    
    for (let i = 0; i < numRays; i++) {
      const localDir = this.rayDirections[i];
      
      // Transform to world space
      const worldDirX = localDir.x * cosYaw + localDir.z * sinYaw;
      const worldDirY = localDir.y;
      const worldDirZ = -localDir.x * sinYaw + localDir.z * cosYaw;
      
      let minDist = LIDAR.MAX_RANGE;
      
      // Check ground
      const groundDist = this.rayGroundIntersect(x, y, z, worldDirX, worldDirY, worldDirZ);
      if (groundDist < minDist) minDist = groundDist;
      
      // Check obstacles
      for (const obs of this.obstacles) {
        // Quick distance check
        const dx = obs.x - x;
        const dz = obs.z - z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        
        if (dist2D > LIDAR.MAX_RANGE + obs.radius) continue;
        
        const dist = this.rayCylinderIntersect(x, y, z, worldDirX, worldDirY, worldDirZ, obs);
        if (dist < minDist) minDist = dist;
      }
      
      distances[i] = minDist;
    }
    
    return distances;
  }

  /**
   * Generate a random position in the forest
   */
  samplePosition() {
    let seed = Date.now() + Math.random() * 1000000;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    const margin = 15;
    const x = (random() - 0.5) * (this.forestSize - margin * 2);
    const z = (random() - 0.5) * (this.forestSize - margin * 2);
    
    const groundY = this.getTerrainHeight(x, z);
    const y = groundY + FOREST.FLYING_HEIGHT_MIN + 
      random() * (FOREST.FLYING_HEIGHT_MAX - FOREST.FLYING_HEIGHT_MIN);
    
    return { x, y, z };
  }

  /**
   * Generate a scenario with drone state and target
   */
  generateScenario() {
    let seed = Date.now() + Math.random() * 1000000;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    // Sample drone position
    const pos = this.samplePosition();
    
    // Random velocity
    const speed = random() * DRONE.MAX_SPEED * 0.6;
    const velAngle = random() * Math.PI * 2;
    const velPitch = (random() - 0.5) * 0.5;
    
    const vx = Math.sin(velAngle) * Math.cos(velPitch) * speed;
    const vy = Math.sin(velPitch) * speed;
    const vz = Math.cos(velAngle) * Math.cos(velPitch) * speed;
    
    // Generate target
    const targetDist = 10 + random() * 40;
    const targetAngle = random() * Math.PI * 2;
    const targetPitch = (random() - 0.5) * 0.6;
    
    let targetX = pos.x + Math.sin(targetAngle) * Math.cos(targetPitch) * targetDist;
    let targetZ = pos.z + Math.cos(targetAngle) * Math.cos(targetPitch) * targetDist;
    
    // Clamp target to forest bounds
    const margin = 10;
    targetX = Math.max(-this.halfSize + margin, Math.min(this.halfSize - margin, targetX));
    targetZ = Math.max(-this.halfSize + margin, Math.min(this.halfSize - margin, targetZ));
    
    const targetGroundY = this.getTerrainHeight(targetX, targetZ);
    const targetY = targetGroundY + FOREST.FLYING_HEIGHT_MIN + 
      random() * (FOREST.FLYING_HEIGHT_MAX - FOREST.FLYING_HEIGHT_MIN);
    
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx, vy, vz,
      targetX, targetY, targetZ,
      yaw: velAngle,
    };
  }

  /**
   * Compute controller output for a scenario
   */
  computeControl(scenario) {
    // Vector to target
    const dx = scenario.targetX - scenario.x;
    const dy = scenario.targetY - scenario.y;
    const dz = scenario.targetZ - scenario.z;
    
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Normalize direction
    let dirX = 0, dirY = 0, dirZ = 0;
    if (dist > 0.1) {
      dirX = dx / dist;
      dirY = dy / dist;
      dirZ = dz / dist;
    }
    
    // Proportional control towards target
    const gain = 0.3;
    let thrustX = dirX * Math.min(dist * gain, 1);
    let thrustY = dirY * Math.min(dist * gain, 1);
    let thrustZ = dirZ * Math.min(dist * gain, 1);
    
    // Velocity damping
    const dampGain = 0.3;
    thrustX -= scenario.vx * dampGain / DRONE.MAX_SPEED;
    thrustY -= scenario.vy * dampGain / DRONE.MAX_SPEED;
    thrustZ -= scenario.vz * dampGain / DRONE.MAX_SPEED;
    
    // Clamp
    thrustX = Math.max(-1, Math.min(1, thrustX));
    thrustY = Math.max(-1, Math.min(1, thrustY));
    thrustZ = Math.max(-1, Math.min(1, thrustZ));
    
    return { thrustX, thrustY, thrustZ };
  }

  /**
   * Generate a single training example
   */
  generateExample() {
    const scenario = this.generateScenario();
    
    // Simulate LiDAR
    const lidarDistances = this.simulateLidar(
      scenario.x, scenario.y, scenario.z, scenario.yaw
    );
    
    // Compute control
    const control = this.computeControl(scenario);
    
    // Compute target direction (normalized)
    const dx = scenario.targetX - scenario.x;
    const dy = scenario.targetY - scenario.y;
    const dz = scenario.targetZ - scenario.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const targetDirX = dist > 0.001 ? dx / dist : 0;
    const targetDirY = dist > 0.001 ? dy / dist : 0;
    const targetDirZ = dist > 0.001 ? dz / dist : 1;
    
    // Build input
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    const input = [
      ...normalizedLidar,
      scenario.vx / DRONE.MAX_SPEED,
      scenario.vy / DRONE.MAX_SPEED,
      scenario.vz / DRONE.MAX_SPEED,
      targetDirX,
      targetDirY,
      targetDirZ,
    ];
    
    const target = [
      control.thrustX,
      control.thrustY,
      control.thrustZ,
    ];
    
    return { input, target };
  }

  /**
   * Generate diverse training dataset
   */
  generateDiverseDataset(totalCount) {
    const examples = [];
    
    // Distribution: normal navigation, obstacle avoidance, altitude changes
    const normalCount = Math.floor(totalCount * 0.5);
    const avoidanceCount = Math.floor(totalCount * 0.3);
    const altitudeCount = Math.floor(totalCount * 0.2);
    
    // Normal navigation
    for (let i = 0; i < normalCount; i++) {
      examples.push(this.generateExample());
    }
    
    // Near-obstacle scenarios (for avoidance training)
    for (let i = 0; i < avoidanceCount; i++) {
      examples.push(this.generateNearObstacleExample());
    }
    
    // Altitude change scenarios
    for (let i = 0; i < altitudeCount; i++) {
      examples.push(this.generateAltitudeExample());
    }
    
    // Shuffle
    for (let i = examples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [examples[i], examples[j]] = [examples[j], examples[i]];
    }
    
    return examples;
  }

  /**
   * Generate example near obstacles
   */
  generateNearObstacleExample() {
    // Find a random obstacle and place drone near it
    if (this.obstacles.length === 0) {
      return this.generateExample();
    }
    
    const obs = this.obstacles[Math.floor(Math.random() * this.obstacles.length)];
    
    const angle = Math.random() * Math.PI * 2;
    const dist = obs.radius + 2 + Math.random() * 3;
    
    const x = obs.x + Math.cos(angle) * dist;
    const z = obs.z + Math.sin(angle) * dist;
    const y = (obs.minY + obs.maxY) / 2;
    
    // Target is away from obstacle
    const targetAngle = angle + Math.PI + (Math.random() - 0.5) * Math.PI;
    const targetDist = 15 + Math.random() * 20;
    
    const scenario = {
      x, y, z,
      vx: 0, vy: 0, vz: 0,
      targetX: x + Math.cos(targetAngle) * targetDist,
      targetY: y,
      targetZ: z + Math.sin(targetAngle) * targetDist,
      yaw: targetAngle,
    };
    
    return this.buildExampleFromScenario(scenario);
  }

  /**
   * Generate altitude change example
   */
  generateAltitudeExample() {
    const pos = this.samplePosition();
    
    // Target at significantly different altitude
    const altDiff = (Math.random() - 0.5) * 10;
    
    const scenario = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: 0,
      vy: Math.random() * 2 - 1,
      vz: 0,
      targetX: pos.x + (Math.random() - 0.5) * 20,
      targetY: Math.max(this.getTerrainHeight(pos.x, pos.z) + 2, pos.y + altDiff),
      targetZ: pos.z + (Math.random() - 0.5) * 20,
      yaw: Math.random() * Math.PI * 2,
    };
    
    return this.buildExampleFromScenario(scenario);
  }

  /**
   * Build training example from scenario
   */
  buildExampleFromScenario(scenario) {
    const lidarDistances = this.simulateLidar(
      scenario.x, scenario.y, scenario.z, scenario.yaw
    );
    const control = this.computeControl(scenario);
    
    const dx = scenario.targetX - scenario.x;
    const dy = scenario.targetY - scenario.y;
    const dz = scenario.targetZ - scenario.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const targetDirX = dist > 0.001 ? dx / dist : 0;
    const targetDirY = dist > 0.001 ? dy / dist : 0;
    const targetDirZ = dist > 0.001 ? dz / dist : 1;
    
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    const input = [
      ...normalizedLidar,
      scenario.vx / DRONE.MAX_SPEED,
      scenario.vy / DRONE.MAX_SPEED,
      scenario.vz / DRONE.MAX_SPEED,
      targetDirX,
      targetDirY,
      targetDirZ,
    ];
    
    const target = [
      control.thrustX,
      control.thrustY,
      control.thrustZ,
    ];
    
    return { input, target };
  }

  /**
   * Validate example
   */
  validateExample(example) {
    if (!example.input || !example.target) return false;
    if (example.input.length !== AUTOPILOT.INPUT_SIZE) return false;
    if (example.target.length !== AUTOPILOT.OUTPUT_SIZE) return false;
    
    for (const v of example.input) {
      if (isNaN(v)) return false;
    }
    for (const v of example.target) {
      if (isNaN(v)) return false;
    }
    
    return true;
  }
}
