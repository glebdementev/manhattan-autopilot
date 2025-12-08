/**
 * Configuration constants for the Forest Drone Navigation simulation
 */

// Forest generation
export const FOREST = {
  SIZE: 200,              // Larger forest (meters)
  TERRAIN_SCALE: 0.015,   // Perlin noise scale for terrain
  TERRAIN_HEIGHT: 5,      // Maximum terrain height variation
  TERRAIN_SEGMENTS: 80,   // Terrain mesh resolution
  
  // Trees - DENSE FOREST for obstacle avoidance
  TREE_DENSITY: 0.025,    // Denser trees (~1000 trees)
  CONIFER_RATIO: 0.5,     // Ratio of coniferous to deciduous trees
  
  // Coniferous trees (pine/spruce)
  CONIFER_MIN_HEIGHT: 18,
  CONIFER_MAX_HEIGHT: 24,
  CONIFER_TRUNK_RADIUS: 0.5,
  CONIFER_CROWN_RADIUS: 4.5,
  
  // Deciduous trees (oak/maple style)
  DECIDUOUS_MIN_HEIGHT: 16,
  DECIDUOUS_MAX_HEIGHT: 22,
  DECIDUOUS_TRUNK_RADIUS: 0.6,
  DECIDUOUS_CROWN_RADIUS: 5.5,
  
  // Bushes
  BUSH_DENSITY: 0.015,
  BUSH_MIN_SIZE: 1.0,
  BUSH_MAX_SIZE: 4.0,
  
  // Canopy
  CANOPY_HEIGHT: 12,
  FLYING_HEIGHT_MIN: 1.5,
  FLYING_HEIGHT_MAX: 10,
};

// Drone (no inertia - direct velocity control)
export const DRONE = {
  SIZE: 0.8,              // Drone box size (meters)
  MAX_SPEED: 8,           // Maximum speed in m/s
  MAX_YAW_RATE: 3.0,      // Maximum yaw rate in rad/s (~170°/s)
};

// LiDAR configuration - Multi-layer 3D scanning
export const LIDAR = {
  HORIZONTAL_RAYS: 12,    // Rays per vertical layer
  VERTICAL_LAYERS: 4,     // Number of vertical layers (-30°, -10°, +10°, +30°)
  FOV: Math.PI / 3,       // 60° horizontal FOV (±30° from forward)
  VERTICAL_FOV: Math.PI / 3, // 60° vertical FOV (±30° from horizontal)
  MAX_RANGE: 25,          // Maximum detection range (meters)
  VISUALIZE: false,       // Disabled by default for performance
  RAY_COLOR: 0x00ffaa,    // Color of LiDAR rays
  HIT_COLOR: 0xff4444,    // Color of hit points
};

// Simulation
export const SIMULATION = {
  TIMESTEP: 1 / 60,       // Physics timestep (60 Hz)
  RENDER_FPS: 60,         // Target render framerate
};

// Navigation/Controller
export const CONTROLLER = {
  TARGET_SPEED: 5,        // Target cruising speed in m/s
  OBSTACLE_AVOIDANCE_DIST: 4, // Distance to start avoiding obstacles
  WAYPOINT_REACH_DIST: 2, // Distance to consider waypoint reached
};

// Target placement distances (relative to drone)
export const TARGET = {
  MIN_DISTANCE: 20,       // Minimum distance to new target (meters) - NEVER closer
  MAX_DISTANCE: 40,       // Maximum distance to new target (meters)
};

// Colors
export const COLORS = {
  // Terrain
  GROUND_LOW: 0x2d4a1c,
  GROUND_HIGH: 0x4a6b2a,
  
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
  DRONE_AUTOPILOT: 0x00ff88,
  DRONE_MANUAL: 0xff8844,
  
  // Target
  TARGET: 0xff00ff,
  
  // Path
  PATH: 0x00ff88,
};

// Camera
export const CAMERA = {
  FOLLOW_HEIGHT: 2,
  FOLLOW_DISTANCE: 6,
  FOLLOW_SMOOTHING: 0.08,
};
