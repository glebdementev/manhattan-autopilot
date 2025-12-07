/**
 * Configuration constants for the Forest Drone Navigation simulation
 * OPTIMIZED for performance
 */

// Forest generation
export const FOREST = {
  SIZE: 200,              // Larger forest (meters)
  TERRAIN_SCALE: 0.015,   // Perlin noise scale for terrain
  TERRAIN_HEIGHT: 5,      // Maximum terrain height variation
  TERRAIN_SEGMENTS: 80,   // Terrain mesh resolution
  
  // Trees - DENSE FOREST for obstacle avoidance training
  TREE_DENSITY: 0.025,    // Denser trees (~1000 trees)
  CONIFER_RATIO: 0.5,     // Ratio of coniferous to deciduous trees
  
  // Coniferous trees (pine/spruce)
  CONIFER_MIN_HEIGHT: 18,
  CONIFER_MAX_HEIGHT: 24,
  CONIFER_TRUNK_RADIUS: 0.5,
  CONIFER_CROWN_RADIUS: 4.5,  // Slightly larger crowns
  
  // Deciduous trees (oak/maple style)
  DECIDUOUS_MIN_HEIGHT: 16,
  DECIDUOUS_MAX_HEIGHT: 22,
  DECIDUOUS_TRUNK_RADIUS: 0.6,
  DECIDUOUS_CROWN_RADIUS: 5.5,  // Slightly larger crowns
  
  // Bushes - more obstacles at ground level
  BUSH_DENSITY: 0.015,    // More bushes
  BUSH_MIN_SIZE: 1.0,
  BUSH_MAX_SIZE: 4.0,     // Larger bushes
  
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

// LiDAR configuration - CLOSEST OBSTACLES MODE
export const LIDAR = {
  NUM_SCAN_RAYS: 72,              // Dense scan (5° per ray for 360° coverage)
  HORIZONTAL_FOV: Math.PI * 2,    // 360 degrees horizontal scan
  NUM_CLOSEST_OBSTACLES: 4,       // Return 4 closest obstacles
  MIN_ANGULAR_SEPARATION: Math.PI / 9, // 20 degrees minimum between obstacles
  MAX_RANGE: 25,                  // Maximum detection range
  VISUALIZE: false,               // DISABLED by default for performance
  RAY_COLOR: 0x00ffaa,            // Color of LiDAR rays
  HIT_COLOR: 0xff4444,            // Color of hit points
};

// Simulation
export const SIMULATION = {
  TIMESTEP: 1 / 60,       // Physics timestep (60 Hz)
  RENDER_FPS: 60,         // Target render framerate
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
  MAX_EPISODE_STEPS: 1000,      // Longer episodes for longer distances
  MAX_TARGET_DISTANCE: 80,      // Max distance for normalization
  
  // ===========================================
  // NEURAL NETWORK
  // ===========================================
  HIDDEN_UNITS: [64, 64],   // Larger network (3 inputs → 3 outputs)
  
  // ===========================================
  // TRAINING HYPERPARAMETERS
  // ===========================================
  LEARNING_RATE: 0.001,         // Learning rate for optimizer
  POLICY_LEARNING_RATE: 0.05,   // Learning rate for policy updates
  GAMMA: 0.99,                  // Discount factor
  BATCH_SIZE: 64,               // Training batch size
  BUFFER_SIZE: 2000,            // Smaller buffer for focused learning
  MIN_BUFFER_SIZE: 100,         // Start training earlier
  
  // ===========================================
  // EXPLORATION
  // ===========================================
  INITIAL_EXPLORATION: 0.5,     // Start with moderate exploration
  EXPLORATION_DECAY: 0.995,     // Faster decay to reduce noise over time
  MIN_EXPLORATION: 0.1,         // Keep some exploration
  ACTION_NOISE: 0.15,           // Reduced noise magnitude
  
  // ===========================================
  // TRAINING CONTROL
  // ===========================================
  TRAIN_INTERVAL: 20,           // Train every N steps
  EPISODES_PER_SCENE: 50,       // Less frequent scene regeneration
  AUTO_TRAIN: true,             // Whether to train automatically
  TRAINING_SPEED: 1,            // Simulation speed multiplier during training
};
