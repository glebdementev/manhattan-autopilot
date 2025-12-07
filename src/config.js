/**
 * Configuration constants for the Forest Drone Navigation simulation
 * OPTIMIZED for performance
 */

// Forest generation
export const FOREST = {
  SIZE: 150,              // Reduced forest area size (meters)
  TERRAIN_SCALE: 0.015,   // Perlin noise scale for terrain (reduced for flatter terrain)
  TERRAIN_HEIGHT: 5,      // Maximum terrain height variation (reduced from 12)
  TERRAIN_SEGMENTS: 64,   // Reduced terrain mesh resolution (was 128)
  
  // Trees - DENSE FOREST (almost covering entire terrain)
  TREE_DENSITY: 0.0175,   // Reduced 30% (~390 trees)
  CONIFER_RATIO: 0.5,     // Ratio of coniferous to deciduous trees
  
  // Coniferous trees (pine/spruce) - BIGGER with reduced variation
  CONIFER_MIN_HEIGHT: 18,
  CONIFER_MAX_HEIGHT: 24,
  CONIFER_TRUNK_RADIUS: 0.5,
  CONIFER_CROWN_RADIUS: 4.0,
  
  // Deciduous trees (oak/maple style) - TALLER with reduced variation
  DECIDUOUS_MIN_HEIGHT: 16,
  DECIDUOUS_MAX_HEIGHT: 22,
  DECIDUOUS_TRUNK_RADIUS: 0.6,
  DECIDUOUS_CROWN_RADIUS: 5.0,
  
  // Bushes - denser with larger sizes
  BUSH_DENSITY: 0.012,    // More bushes (~270)
  BUSH_MIN_SIZE: 1.0,
  BUSH_MAX_SIZE: 3.5,     // Can be much larger now
  
  // Canopy
  CANOPY_HEIGHT: 12,      // Average height of forest canopy
  FLYING_HEIGHT_MIN: 1.5, // Minimum safe flying height above ground
  FLYING_HEIGHT_MAX: 10,  // Maximum flying height (under canopy)
};

// Drone physics
export const DRONE = {
  SIZE: 0.8,              // Drone box size (meters)
  MAX_SPEED: 8,           // Maximum speed in m/s
  MAX_ACCELERATION: 6.0,  // Maximum acceleration in m/s²
  DRAG_COEFFICIENT: 0.5,  // Air resistance
  HOVER_POWER: 0.3,       // Power needed to maintain altitude
  VERTICAL_SPEED: 4,      // Vertical movement speed
};

// LiDAR configuration - OPTIMIZED
export const LIDAR = {
  NUM_HORIZONTAL_RAYS: 16,  // Reduced from 32
  NUM_VERTICAL_RAYS: 4,     // Reduced from 8
  HORIZONTAL_FOV: Math.PI * 1.5, // 270 degrees horizontal
  VERTICAL_FOV: Math.PI / 4,     // 45 degrees vertical
  MAX_RANGE: 25,            // Reduced range
  VISUALIZE: false,         // DISABLED by default for performance
  RAY_COLOR: 0x00ffaa,      // Color of LiDAR rays
  HIT_COLOR: 0xff4444,      // Color of hit points
};

// Simulation
export const SIMULATION = {
  TIMESTEP: 1 / 60,       // Physics timestep (60 Hz)
  RENDER_FPS: 60,         // Target render framerate
};

// Autopilot neural network - ADJUSTED for new LiDAR size
export const AUTOPILOT = {
  INPUT_SIZE: 16 * 4 + 2 + 6, // LiDAR grid rays (64) + nadir/zenith (2) + [vx, vy, vz, target_dx, target_dy, target_dz]
  HIDDEN_LAYERS: [64, 32],  // Smaller network
  OUTPUT_SIZE: 3,         // [thrust_x, thrust_y, thrust_z]
  LEARNING_RATE: 0.001,
  BATCH_SIZE: 64,
};

// Controller
export const CONTROLLER = {
  TARGET_SPEED: 5,        // Target cruising speed in m/s
  OBSTACLE_AVOIDANCE_DIST: 4, // Distance to start avoiding obstacles
  WAYPOINT_REACH_DIST: 3, // Distance to consider waypoint reached
};

// Colors
export const COLORS = {
  // Terrain
  GROUND_LOW: 0x2d4a1c,   // Valley floor (darker green/brown)
  GROUND_HIGH: 0x4a6b2a,  // Hilltops (lighter green)
  
  // Trees
  CONIFER_TRUNK: 0x4a3728,
  CONIFER_FOLIAGE: 0x1a4d2e,
  DECIDUOUS_TRUNK: 0x5c4033,
  DECIDUOUS_FOLIAGE: 0x228b22,
  
  // Bushes
  BUSH: 0x2e5a1c,
  
  // Sky and atmosphere
  SKY: 0x87ceeb,
  FOG: 0x8fbc8f,
  
  // Drone
  DRONE_BODY: 0xff6b35,
  DRONE_LIGHT: 0x00ffff,
  
  // Drone colors for different modes
  DRONE_CLASSIC: 0x00aaff,    // Blue for classic controller
  DRONE_AUTOPILOT: 0x00ff88,  // Green for neural autopilot
  DRONE_MANUAL: 0xff8844,     // Orange for manual control
  
  // Target
  TARGET: 0xff00ff,
};

// Camera
export const CAMERA = {
  FOLLOW_HEIGHT: 2,       // Reduced from 8 - more horizontal view
  FOLLOW_DISTANCE: 6,     // Reduced from 15 - closer to drone
  FOLLOW_SMOOTHING: 0.08,
};

// Reinforcement Learning Configuration
export const RL_CONFIG = {
  // Episode settings
  MAX_EPISODE_STEPS: 2000,      // Max steps per episode
  MAX_TARGET_DISTANCE: 100,     // Max distance for normalization
  
  // ===========================================
  // REWARD SHAPING
  // ===========================================
  
  // Goal rewards (Primary motivation)
  REWARD_TARGET_REACHED: 100,   // Big bonus for reaching target
  REWARD_DISTANCE_PROGRESS: 2.5, // Reward for getting closer to target (per meter)
  REWARD_DISTANCE_REGRESS: 3.0, // Penalty multiplier for moving away from target (stronger than progress)
  
  // Collision/Safety penalties (CRITICAL - agent must HATE being near obstacles)
  REWARD_COLLISION: -500,       // CATASTROPHIC penalty for collision - must never happen
  REWARD_OBSTACLE_PROXIMITY: -2.0, // Strong base penalty for being close to obstacles
  REWARD_OBSTACLE_VERY_CLOSE: -8.0, // Extreme penalty when dangerously close
  OBSTACLE_DANGER_DISTANCE: 8,  // Distance at which obstacles become dangerous (meters)
  OBSTACLE_CLOSE_DISTANCE: 4,   // Distance at which strong penalty kicks in (meters)
  OBSTACLE_CRITICAL_DISTANCE: 2, // Distance at which EXTREME penalty kicks in (meters)
  
  // Speed rewards (Encourages efficient navigation)
  REWARD_HIGH_SPEED: 0.15,      // Bonus for maintaining high speed
  REWARD_STAGNATION: -0.3,      // Penalty for staying in one place (anti-hovering)
  REWARD_VELOCITY_TOWARDS_TARGET: 0.2, // Bonus for moving towards target
  
  // Altitude rewards/penalties (Encourages low flight, HATES high flight)
  REWARD_LOW_ALTITUDE: 0.12,    // Bonus for flying low (1.5-4m above ground)
  REWARD_GOOD_ALTITUDE: 0.05,   // Smaller bonus for moderate altitude (4-8m)
  REWARD_HIGH_ALTITUDE: -0.5,   // Penalty for flying too high (8-15m)
  REWARD_VERY_HIGH_ALTITUDE: -2.0, // Strong penalty for flying way too high (>15m)
  
  // Time penalty
  REWARD_TIME_PENALTY: -0.02,   // Small penalty per step (encourages fast completion)
  
  // ===========================================
  // NEURAL NETWORK
  // ===========================================
  HIDDEN_UNITS: [128, 64, 32],  // Hidden layer sizes
  
  // ===========================================
  // TRAINING HYPERPARAMETERS
  // ===========================================
  LEARNING_RATE: 0.0003,        // Learning rate for optimizer
  POLICY_LEARNING_RATE: 0.1,    // Learning rate for policy updates
  GAMMA: 0.99,                  // Discount factor
  GAE_LAMBDA: 0.95,             // GAE lambda for advantage estimation
  BATCH_SIZE: 64,               // Training batch size
  BUFFER_SIZE: 10000,           // Experience replay buffer size
  MIN_BUFFER_SIZE: 500,         // Minimum buffer size before training
  
  // ===========================================
  // EXPLORATION
  // ===========================================
  INITIAL_EXPLORATION: 0.5,     // Initial exploration rate
  EXPLORATION_DECAY: 0.9995,    // Exploration decay per training step
  MIN_EXPLORATION: 0.05,        // Minimum exploration rate
  ACTION_NOISE: 0.3,            // Noise added to actions during exploration
  
  // ===========================================
  // HEURISTIC BLENDING (for faster initial learning)
  // ===========================================
  INITIAL_HEURISTIC_WEIGHT: 0.7,  // Start with 70% heuristic, 30% NN
  MIN_HEURISTIC_WEIGHT: 0.1,      // Minimum 10% heuristic for safety
  HEURISTIC_DECAY: 0.9998,        // Decay per training step
  
  // ===========================================
  // TRAINING CONTROL
  // ===========================================
  TRAIN_INTERVAL: 10,           // Train every N steps
  EPISODES_PER_SCENE: 5,        // Regenerate scene every N episodes
  AUTO_TRAIN: true,             // Whether to train automatically
  TRAINING_SPEED: 1,            // Simulation speed multiplier during training
};
