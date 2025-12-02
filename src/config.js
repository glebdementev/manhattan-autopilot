/**
 * Configuration constants for the Manhattan Autopilot simulation
 */

// City generation
export const CITY = {
  GRID_SIZE: 5,           // Number of blocks in each direction
  BLOCK_SIZE: 60,         // Size of each city block in meters
  ROAD_WIDTH: 12,         // Width of roads in meters
  SIDEWALK_WIDTH: 3,      // Width of sidewalks in meters
  SIDEWALK_HEIGHT: 0.15,  // Height of sidewalks above road
  BUILDING_MIN_HEIGHT: 15,
  BUILDING_MAX_HEIGHT: 80,
  BUILDING_MARGIN: 2,     // Gap between buildings and sidewalk
};

// Vehicle physics
export const VEHICLE = {
  LENGTH: 4.5,            // Car length in meters
  WIDTH: 2.0,             // Car width in meters
  HEIGHT: 1.5,            // Car height in meters
  WHEELBASE: 2.7,         // Distance between axles
  MAX_SPEED: 15,          // Maximum speed in m/s (~54 km/h)
  MAX_ACCELERATION: 4.0,  // Maximum acceleration in m/s²
  MAX_BRAKE: 8.0,         // Maximum braking deceleration
  MAX_STEER_ANGLE: Math.PI / 4, // Maximum steering angle (45 degrees)
  DRAG_COEFFICIENT: 0.02, // Air resistance
};

// LiDAR configuration
export const LIDAR = {
  NUM_RAYS: 64,           // Number of LiDAR rays
  FOV: Math.PI,           // Field of view (180 degrees)
  MAX_RANGE: 50,          // Maximum detection range in meters
  HEIGHT: 1.2,            // Height of LiDAR sensor on car
  VISUALIZE: true,        // Show LiDAR rays in scene
  RAY_COLOR: 0x00ff00,    // Color of LiDAR rays
  HIT_COLOR: 0xff0000,    // Color of hit points
};

// Simulation
export const SIMULATION = {
  TIMESTEP: 1 / 60,       // Physics timestep (60 Hz)
  RENDER_FPS: 60,         // Target render framerate
};

// Autopilot neural network
export const AUTOPILOT = {
  INPUT_SIZE: 64 + 5,     // LiDAR rays + [velocity, heading_error, lateral_offset, target_dx, target_dy]
  HIDDEN_LAYERS: [128, 64, 32],
  OUTPUT_SIZE: 2,         // [steering, throttle]
  LEARNING_RATE: 0.001,
  BATCH_SIZE: 64,
  LOOKAHEAD_DISTANCE: 10, // How far ahead to look for target waypoint
};

// Classical controller (Pure Pursuit)
export const CONTROLLER = {
  LOOKAHEAD_MIN: 5,
  LOOKAHEAD_MAX: 15,
  LOOKAHEAD_GAIN: 0.5,    // Lookahead increases with speed
  TARGET_SPEED: 8,        // Target cruising speed in m/s
  TURN_SPEED: 4,          // Speed when turning
};

// Colors
export const COLORS = {
  ROAD: 0x333333,
  ROAD_MARKING: 0xffffff,
  SIDEWALK: 0x888888,
  BUILDING_BASE: 0x556677,
  BUILDING_ACCENT: 0x667788,
  GROUND: 0x1a1a1a,
  SKY: 0x0a0a15,
  CAR_BODY: 0xff4444,
  CAR_WINDOWS: 0x333333,
};

// Camera
export const CAMERA = {
  FOLLOW_HEIGHT: 25,
  FOLLOW_DISTANCE: 35,
  FOLLOW_SMOOTHING: 0.1,
  BIRD_EYE_HEIGHT: 200,
};

