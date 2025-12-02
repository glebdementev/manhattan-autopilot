/**
 * Synthetic data generator for instant training data creation
 * Generates training examples by sampling positions geometrically
 * and computing LiDAR + controller outputs mathematically
 */
import { CITY, LIDAR, VEHICLE, CONTROLLER, AUTOPILOT } from '../config.js';

// Lane offset from road center (drive on the right side)
const LANE_OFFSET = CITY.ROAD_WIDTH / 4;

export class SyntheticDataGenerator {
  constructor() {
    // Precompute city geometry
    this.citySize = CITY.GRID_SIZE * (CITY.BLOCK_SIZE + CITY.ROAD_WIDTH) + CITY.ROAD_WIDTH;
    this.cityOffset = -this.citySize / 2;
    this.blockUnit = CITY.BLOCK_SIZE + CITY.ROAD_WIDTH;
    
    // Precompute ray angles for LiDAR simulation
    this.rayAngles = [];
    const startAngle = -LIDAR.FOV / 2;
    const angleStep = LIDAR.FOV / (LIDAR.NUM_RAYS - 1);
    for (let i = 0; i < LIDAR.NUM_RAYS; i++) {
      this.rayAngles.push(startAngle + i * angleStep);
    }
    
    // Build obstacle geometry (buildings and sidewalks as AABBs)
    this.obstacles = this.buildObstacleGeometry();
  }

  /**
   * Build axis-aligned bounding boxes for all obstacles
   */
  buildObstacleGeometry() {
    const obstacles = [];
    
    // Add sidewalks and buildings for each block
    for (let i = 0; i < CITY.GRID_SIZE; i++) {
      for (let j = 0; j < CITY.GRID_SIZE; j++) {
        const blockX = this.cityOffset + CITY.ROAD_WIDTH + i * this.blockUnit;
        const blockZ = this.cityOffset + CITY.ROAD_WIDTH + j * this.blockUnit;
        
        // Sidewalks around block
        const sw = CITY.SIDEWALK_WIDTH;
        const bs = CITY.BLOCK_SIZE;
        
        // North sidewalk
        obstacles.push({ minX: blockX, maxX: blockX + bs, minZ: blockZ, maxZ: blockZ + sw });
        // South sidewalk
        obstacles.push({ minX: blockX, maxX: blockX + bs, minZ: blockZ + bs - sw, maxZ: blockZ + bs });
        // West sidewalk
        obstacles.push({ minX: blockX, maxX: blockX + sw, minZ: blockZ + sw, maxZ: blockZ + bs - sw });
        // East sidewalk
        obstacles.push({ minX: blockX + bs - sw, maxX: blockX + bs, minZ: blockZ + sw, maxZ: blockZ + bs - sw });
        
        // Building (fills block inside sidewalks)
        obstacles.push({
          minX: blockX + sw,
          maxX: blockX + bs - sw,
          minZ: blockZ + sw,
          maxZ: blockZ + bs - sw,
        });
      }
    }
    
    return obstacles;
  }

  /**
   * Ray-AABB intersection test (2D)
   * Returns distance to intersection or MAX_RANGE if no hit
   */
  rayAABBIntersect(rayOriginX, rayOriginZ, rayDirX, rayDirZ, box) {
    let tmin = 0;
    let tmax = LIDAR.MAX_RANGE;
    
    // X slab
    if (Math.abs(rayDirX) > 1e-8) {
      const tx1 = (box.minX - rayOriginX) / rayDirX;
      const tx2 = (box.maxX - rayOriginX) / rayDirX;
      tmin = Math.max(tmin, Math.min(tx1, tx2));
      tmax = Math.min(tmax, Math.max(tx1, tx2));
    } else {
      // Ray parallel to X axis
      if (rayOriginX < box.minX || rayOriginX > box.maxX) {
        return LIDAR.MAX_RANGE;
      }
    }
    
    // Z slab
    if (Math.abs(rayDirZ) > 1e-8) {
      const tz1 = (box.minZ - rayOriginZ) / rayDirZ;
      const tz2 = (box.maxZ - rayOriginZ) / rayDirZ;
      tmin = Math.max(tmin, Math.min(tz1, tz2));
      tmax = Math.min(tmax, Math.max(tz1, tz2));
    } else {
      // Ray parallel to Z axis
      if (rayOriginZ < box.minZ || rayOriginZ > box.maxZ) {
        return LIDAR.MAX_RANGE;
      }
    }
    
    if (tmax >= tmin && tmin > 0) {
      return tmin;
    }
    return LIDAR.MAX_RANGE;
  }

  /**
   * Simulate LiDAR scan at a given position and heading
   */
  simulateLidar(x, z, heading) {
    const distances = new Array(LIDAR.NUM_RAYS);
    
    for (let i = 0; i < LIDAR.NUM_RAYS; i++) {
      const worldAngle = heading + this.rayAngles[i];
      const dirX = Math.cos(worldAngle);
      const dirZ = Math.sin(worldAngle);
      
      let minDist = LIDAR.MAX_RANGE;
      
      // Test against all obstacles
      for (const obstacle of this.obstacles) {
        const dist = this.rayAABBIntersect(x, z, dirX, dirZ, obstacle);
        if (dist < minDist) {
          minDist = dist;
        }
      }
      
      distances[i] = minDist;
    }
    
    return distances;
  }

  /**
   * Generate a random position on a road segment
   */
  sampleRoadPosition() {
    // Randomly pick horizontal or vertical road
    const isHorizontal = Math.random() < 0.5;
    
    if (isHorizontal) {
      // Horizontal road (along X)
      const roadIndex = Math.floor(Math.random() * (CITY.GRID_SIZE + 1));
      const z = this.cityOffset + roadIndex * this.blockUnit + CITY.ROAD_WIDTH / 2;
      const x = this.cityOffset + CITY.ROAD_WIDTH / 2 + Math.random() * (this.citySize - CITY.ROAD_WIDTH);
      
      // Direction: +X or -X
      const heading = Math.random() < 0.5 ? 0 : Math.PI;
      
      // Offset to the right lane
      const perpZ = heading === 0 ? -LANE_OFFSET : LANE_OFFSET;
      
      return { x, z: z + perpZ, heading };
    } else {
      // Vertical road (along Z)
      const roadIndex = Math.floor(Math.random() * (CITY.GRID_SIZE + 1));
      const x = this.cityOffset + roadIndex * this.blockUnit + CITY.ROAD_WIDTH / 2;
      const z = this.cityOffset + CITY.ROAD_WIDTH / 2 + Math.random() * (this.citySize - CITY.ROAD_WIDTH);
      
      // Direction: +Z or -Z
      const heading = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      
      // Offset to the right lane
      const perpX = heading === Math.PI / 2 ? LANE_OFFSET : -LANE_OFFSET;
      
      return { x: x + perpX, z, heading };
    }
  }

  /**
   * Generate a scenario with route information
   */
  generateScenario() {
    const pos = this.sampleRoadPosition();
    
    // Add some noise to position and heading to create diverse scenarios
    const lateralNoise = (Math.random() - 0.5) * CITY.ROAD_WIDTH * 0.3;
    const headingNoise = (Math.random() - 0.5) * 0.3; // ~17 degrees
    
    // Apply lateral offset perpendicular to heading
    const perpX = -Math.sin(pos.heading);
    const perpZ = Math.cos(pos.heading);
    
    pos.x += perpX * lateralNoise;
    pos.z += perpZ * lateralNoise;
    pos.heading += headingNoise;
    
    // Generate a target point ahead (simulating route waypoint)
    const lookahead = CONTROLLER.LOOKAHEAD_MIN + Math.random() * (CONTROLLER.LOOKAHEAD_MAX - CONTROLLER.LOOKAHEAD_MIN);
    
    // Target is generally ahead but may have some offset (simulating turns)
    const turnBias = (Math.random() - 0.5) * 0.5; // Slight turning tendency
    const targetAngle = pos.heading + turnBias;
    
    const targetX = pos.x + Math.cos(targetAngle) * lookahead;
    const targetZ = pos.z + Math.sin(targetAngle) * lookahead;
    
    // Random speed
    const speed = Math.random() * VEHICLE.MAX_SPEED * 0.8;
    
    return {
      x: pos.x,
      z: pos.z,
      heading: pos.heading,
      speed,
      targetX,
      targetZ,
      lateralNoise,
    };
  }

  /**
   * Compute Pure Pursuit steering for a scenario
   */
  computePurePursuitSteering(scenario) {
    // Transform target to car-local coordinates
    const dx = scenario.targetX - scenario.x;
    const dz = scenario.targetZ - scenario.z;
    
    const cos = Math.cos(-scenario.heading);
    const sin = Math.sin(-scenario.heading);
    
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    
    const lookaheadDist = Math.sqrt(localX * localX + localZ * localZ);
    
    if (lookaheadDist < 0.1) {
      return 0;
    }
    
    // Pure pursuit formula
    const curvature = (2 * localZ) / (lookaheadDist * lookaheadDist);
    let steeringAngle = Math.atan(VEHICLE.WHEELBASE * curvature);
    
    // Clamp
    steeringAngle = Math.max(-VEHICLE.MAX_STEER_ANGLE, Math.min(VEHICLE.MAX_STEER_ANGLE, steeringAngle));
    
    return steeringAngle;
  }

  /**
   * Compute throttle based on steering and speed
   */
  computeThrottle(scenario, steering) {
    // Base target speed
    let targetSpeed = CONTROLLER.TARGET_SPEED;
    
    // Reduce speed for turns
    const steeringMagnitude = Math.abs(steering) / VEHICLE.MAX_STEER_ANGLE;
    if (steeringMagnitude > 0.2) {
      targetSpeed = CONTROLLER.TURN_SPEED + 
        (CONTROLLER.TARGET_SPEED - CONTROLLER.TURN_SPEED) * (1 - steeringMagnitude);
    }
    
    // Simple P controller
    const speedError = targetSpeed - scenario.speed;
    const kP = 0.5;
    let throttle = kP * speedError;
    
    // Clamp
    throttle = Math.max(-1, Math.min(1, throttle));
    
    return throttle;
  }

  /**
   * Generate a single training example
   */
  generateExample() {
    const scenario = this.generateScenario();
    
    // Simulate LiDAR
    const lidarDistances = this.simulateLidar(scenario.x, scenario.z, scenario.heading);
    
    // Compute control outputs
    const steering = this.computePurePursuitSteering(scenario);
    const throttle = this.computeThrottle(scenario, steering);
    
    // Compute route state
    const dx = scenario.targetX - scenario.x;
    const dz = scenario.targetZ - scenario.z;
    const targetDist = Math.sqrt(dx * dx + dz * dz);
    
    // Heading error
    const targetHeading = Math.atan2(dz, dx);
    let headingError = scenario.heading - targetHeading;
    while (headingError > Math.PI) headingError -= 2 * Math.PI;
    while (headingError < -Math.PI) headingError += 2 * Math.PI;
    
    // Target direction in local coordinates
    const cos = Math.cos(-scenario.heading);
    const sin = Math.sin(-scenario.heading);
    const localTargetX = (dx * cos - dz * sin) / Math.max(targetDist, 0.001);
    const localTargetZ = (dx * sin + dz * cos) / Math.max(targetDist, 0.001);
    
    // Build input vector (same format as DataRecorder)
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    const input = [
      ...normalizedLidar,
      scenario.speed / VEHICLE.MAX_SPEED,
      headingError / Math.PI,
      scenario.lateralNoise / (VEHICLE.WIDTH * 2),
      localTargetX,
      localTargetZ,
    ];
    
    // Target output
    const target = [
      steering / VEHICLE.MAX_STEER_ANGLE,
      throttle,
    ];
    
    return { input, target };
  }

  /**
   * Generate multiple training examples instantly
   */
  generateBatch(count) {
    const examples = [];
    for (let i = 0; i < count; i++) {
      examples.push(this.generateExample());
    }
    return examples;
  }

  /**
   * Generate diverse training data with specific scenarios
   */
  generateDiverseDataset(totalCount) {
    const examples = [];
    
    // Distribution of scenarios
    const straightCount = Math.floor(totalCount * 0.4);
    const turnCount = Math.floor(totalCount * 0.3);
    const recoveryCount = Math.floor(totalCount * 0.3);
    
    // Straight driving scenarios
    for (let i = 0; i < straightCount; i++) {
      examples.push(this.generateStraightScenario());
    }
    
    // Turning scenarios
    for (let i = 0; i < turnCount; i++) {
      examples.push(this.generateTurnScenario());
    }
    
    // Recovery scenarios (off-center, need to correct)
    for (let i = 0; i < recoveryCount; i++) {
      examples.push(this.generateRecoveryScenario());
    }
    
    // Shuffle
    for (let i = examples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [examples[i], examples[j]] = [examples[j], examples[i]];
    }
    
    return examples;
  }

  /**
   * Generate a straight driving scenario
   */
  generateStraightScenario() {
    const pos = this.sampleRoadPosition();
    const lateralNoise = (Math.random() - 0.5) * CITY.ROAD_WIDTH * 0.1;
    const headingNoise = (Math.random() - 0.5) * 0.1;
    
    const perpX = -Math.sin(pos.heading);
    const perpZ = Math.cos(pos.heading);
    
    const scenario = {
      x: pos.x + perpX * lateralNoise,
      z: pos.z + perpZ * lateralNoise,
      heading: pos.heading + headingNoise,
      speed: CONTROLLER.TARGET_SPEED * (0.7 + Math.random() * 0.3),
      lateralNoise,
    };
    
    // Target straight ahead
    const lookahead = CONTROLLER.LOOKAHEAD_MIN + Math.random() * 5;
    scenario.targetX = scenario.x + Math.cos(pos.heading) * lookahead;
    scenario.targetZ = scenario.z + Math.sin(pos.heading) * lookahead;
    
    return this.buildExampleFromScenario(scenario);
  }

  /**
   * Generate a turning scenario
   */
  generateTurnScenario() {
    const pos = this.sampleRoadPosition();
    
    const scenario = {
      x: pos.x,
      z: pos.z,
      heading: pos.heading,
      speed: CONTROLLER.TURN_SPEED * (0.8 + Math.random() * 0.4),
      lateralNoise: 0,
    };
    
    // Target to the side (simulating a turn)
    const turnDirection = Math.random() < 0.5 ? 1 : -1;
    const turnAngle = (Math.PI / 4 + Math.random() * Math.PI / 4) * turnDirection;
    const lookahead = CONTROLLER.LOOKAHEAD_MIN + Math.random() * 3;
    
    const targetAngle = pos.heading + turnAngle;
    scenario.targetX = scenario.x + Math.cos(targetAngle) * lookahead;
    scenario.targetZ = scenario.z + Math.sin(targetAngle) * lookahead;
    
    return this.buildExampleFromScenario(scenario);
  }

  /**
   * Generate a recovery scenario (off-center, need correction)
   */
  generateRecoveryScenario() {
    const pos = this.sampleRoadPosition();
    
    // Significant lateral offset
    const lateralNoise = (Math.random() - 0.5) * CITY.ROAD_WIDTH * 0.4;
    const headingNoise = (Math.random() - 0.5) * 0.4;
    
    const perpX = -Math.sin(pos.heading);
    const perpZ = Math.cos(pos.heading);
    
    const scenario = {
      x: pos.x + perpX * lateralNoise,
      z: pos.z + perpZ * lateralNoise,
      heading: pos.heading + headingNoise,
      speed: VEHICLE.MAX_SPEED * (0.3 + Math.random() * 0.5),
      lateralNoise,
    };
    
    // Target back towards centerline
    const lookahead = CONTROLLER.LOOKAHEAD_MIN + Math.random() * 5;
    scenario.targetX = pos.x + Math.cos(pos.heading) * lookahead;
    scenario.targetZ = pos.z + Math.sin(pos.heading) * lookahead;
    
    return this.buildExampleFromScenario(scenario);
  }

  /**
   * Build training example from scenario
   */
  buildExampleFromScenario(scenario) {
    const lidarDistances = this.simulateLidar(scenario.x, scenario.z, scenario.heading);
    const steering = this.computePurePursuitSteering(scenario);
    const throttle = this.computeThrottle(scenario, steering);
    
    const dx = scenario.targetX - scenario.x;
    const dz = scenario.targetZ - scenario.z;
    const targetDist = Math.sqrt(dx * dx + dz * dz);
    
    const targetHeading = Math.atan2(dz, dx);
    let headingError = scenario.heading - targetHeading;
    while (headingError > Math.PI) headingError -= 2 * Math.PI;
    while (headingError < -Math.PI) headingError += 2 * Math.PI;
    
    const cos = Math.cos(-scenario.heading);
    const sin = Math.sin(-scenario.heading);
    const localTargetX = (dx * cos - dz * sin) / Math.max(targetDist, 0.001);
    const localTargetZ = (dx * sin + dz * cos) / Math.max(targetDist, 0.001);
    
    const normalizedLidar = lidarDistances.map(d => d / LIDAR.MAX_RANGE);
    
    const input = [
      ...normalizedLidar,
      scenario.speed / VEHICLE.MAX_SPEED,
      headingError / Math.PI,
      scenario.lateralNoise / (VEHICLE.WIDTH * 2),
      localTargetX,
      localTargetZ,
    ];
    
    const target = [
      steering / VEHICLE.MAX_STEER_ANGLE,
      throttle,
    ];
    
    return { input, target };
  }

  /**
   * Validate that generated data matches expected format
   */
  validateExample(example) {
    if (!example.input || !example.target) return false;
    if (example.input.length !== AUTOPILOT.INPUT_SIZE) return false;
    if (example.target.length !== AUTOPILOT.OUTPUT_SIZE) return false;
    
    // Check for NaN
    for (const v of example.input) {
      if (isNaN(v)) return false;
    }
    for (const v of example.target) {
      if (isNaN(v)) return false;
    }
    
    return true;
  }
}

