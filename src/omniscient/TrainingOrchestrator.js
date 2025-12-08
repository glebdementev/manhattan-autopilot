/**
 * TrainingOrchestrator - Runs thousands of episodes to collect training data
 * 
 * Workflow:
 * 1. Generate random start/target positions
 * 2. Use OmniscientPathGenerator to find perfect path
 * 3. Simulate drone following path, collecting LIDAR observations at each step
 * 4. Train PathPredictor on collected data
 */
import { OmniscientPathGenerator } from './OmniscientPathGenerator.js';
import { TrainingDataCollector } from './TrainingDataCollector.js';
import { PathPredictor } from './PathPredictor.js';
import { FOREST, TARGET, LIDAR } from '../config.js';

// Simulation step size for data collection
const STEP_SIZE = 0.5; // meters between samples

export class TrainingOrchestrator {
  constructor(drone, lidar, forestGenerator, sceneManager) {
    this.drone = drone;
    this.lidar = lidar;
    this.forest = forestGenerator;
    this.sceneManager = sceneManager;
    
    // Components
    this.pathGenerator = new OmniscientPathGenerator(forestGenerator);
    this.dataCollector = new TrainingDataCollector(lidar);
    this.predictor = new PathPredictor(
      this.dataCollector.getObservationDim(),
      this.dataCollector.getActionDim()
    );
    
    // Stats
    this.stats = {
      episodesGenerated: 0,
      successfulPaths: 0,
      failedPaths: 0,
      totalSamples: 0,
      trainingLoss: null,
    };
    
    // Callbacks
    this.onProgress = null;
    this.onEpisodeComplete = null;
  }
  
  /**
   * Set forest generator (for when forest is regenerated)
   */
  setForest(forestGenerator) {
    this.forest = forestGenerator;
    this.pathGenerator = new OmniscientPathGenerator(forestGenerator);
  }
  
  /**
   * Generate training data from multiple episodes
   * @param {number} numEpisodes - Number of episodes to generate
   * @param {Object} options - Generation options
   */
  async generateTrainingData(numEpisodes, options = {}) {
    const {
      minDist = TARGET.MIN_DISTANCE,
      maxDist = TARGET.MAX_DISTANCE,
      clearPrevious = true,
    } = options;
    
    if (clearPrevious) {
      this.dataCollector.clear();
    }
    
    let seed = Date.now();
    
    for (let episode = 0; episode < numEpisodes; episode++) {
      seed = (seed * 16807) % 2147483647;
      
      // Generate random start position
      const start = this.generateRandomPosition(seed);
      seed = (seed * 16807) % 2147483647;
      
      // Generate random target position
      const target = this.generateTargetPosition(start.x, start.z, minDist, maxDist, seed);
      
      // Generate omniscient path
      const path = this.pathGenerator.generatePath(
        start.x, start.y, start.z,
        target.x, target.y, target.z
      );
      
      this.stats.episodesGenerated++;
      
      if (path && path.length >= 2) {
        // Collect samples along path
        const samples = this.collectSamplesAlongPath(path, target);
        this.stats.successfulPaths++;
        this.stats.totalSamples = this.dataCollector.getNumSamples();
        
        if (this.onEpisodeComplete) {
          this.onEpisodeComplete({
            episode,
            pathLength: path.length,
            samplesCollected: samples,
            success: true,
          });
        }
      } else {
        this.stats.failedPaths++;
        
        if (this.onEpisodeComplete) {
          this.onEpisodeComplete({
            episode,
            pathLength: 0,
            samplesCollected: 0,
            success: false,
          });
        }
      }
      
      // Progress callback
      if (this.onProgress) {
        this.onProgress({
          episode: episode + 1,
          total: numEpisodes,
          progress: (episode + 1) / numEpisodes,
          stats: { ...this.stats },
        });
      }
      
      // Yield to UI every 10 episodes
      if (episode % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return this.stats;
  }
  
  /**
   * Generate random position in forest
   */
  generateRandomPosition(seed) {
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    const size = FOREST.SIZE * 0.4; // Stay away from edges
    
    // Try to find a clear position
    for (let i = 0; i < 20; i++) {
      const x = (random() - 0.5) * size;
      const z = (random() - 0.5) * size;
      const groundY = this.forest.getTerrainHeight(x, z);
      const y = groundY + FOREST.FLYING_HEIGHT_MIN + random() * 
        (FOREST.FLYING_HEIGHT_MAX - FOREST.FLYING_HEIGHT_MIN);
      
      if (this.pathGenerator.isPositionClear(x, y, z)) {
        return { x, y, z };
      }
    }
    
    // Fallback to center
    const groundY = this.forest.getTerrainHeight(0, 0);
    return { x: 0, y: groundY + 3, z: 0 };
  }
  
  /**
   * Generate target position relative to start
   */
  generateTargetPosition(startX, startZ, minDist, maxDist, seed) {
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    for (let i = 0; i < 20; i++) {
      const angle = random() * Math.PI * 2;
      const dist = minDist + random() * (maxDist - minDist);
      
      const x = startX + Math.cos(angle) * dist;
      const z = startZ + Math.sin(angle) * dist;
      
      // Check bounds
      if (Math.abs(x) > FOREST.SIZE * 0.45 || Math.abs(z) > FOREST.SIZE * 0.45) {
        continue;
      }
      
      const groundY = this.forest.getTerrainHeight(x, z);
      const y = groundY + 1.0 + random() * 2;
      
      if (this.pathGenerator.isPositionClear(x, y, z)) {
        return { x, y, z };
      }
    }
    
    // Fallback
    const groundY = this.forest.getTerrainHeight(startX, startZ - minDist);
    return { x: startX, y: groundY + 2, z: startZ - minDist };
  }
  
  /**
   * Collect training samples along a path
   */
  collectSamplesAlongPath(path, target) {
    let samplesCollected = 0;
    
    // Walk along path segments
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      
      // Calculate segment length
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dz = to.z - from.z;
      const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Number of samples along this segment
      const numSteps = Math.max(1, Math.ceil(segmentLength / STEP_SIZE));
      
      for (let step = 0; step < numSteps; step++) {
        const t = step / numSteps;
        
        // Interpolate position
        const x = from.x + dx * t;
        const y = from.y + dy * t;
        const z = from.z + dz * t;
        
        // Calculate yaw (facing direction of movement)
        const yaw = Math.atan2(-dx, -dz);
        
        // Set drone position for LIDAR scan
        this.drone.setPosition(x, y, z);
        this.drone.setYaw(yaw);
        
        // Perform LIDAR scan
        this.lidar.scan();
        
        // Get drone state
        const droneState = {
          x, y, z,
          vx: 0, vy: 0, vz: 0, // Not moving during data collection
          yaw,
        };
        
        // Check line of sight to target
        const canSeeTarget = this.lidar.isPathToPointClear(target.x, target.y, target.z, 0.5);
        
        // Next waypoint is the end of current segment (or next waypoint)
        const nextWaypoint = to;
        
        // Collect sample
        this.dataCollector.collectSample(droneState, target, nextWaypoint, canSeeTarget);
        samplesCollected++;
      }
    }
    
    return samplesCollected;
  }
  
  /**
   * Train the predictor model on collected data
   */
  async trainModel(options = {}) {
    const samples = this.dataCollector.getSamples();
    
    if (samples.length === 0) {
      throw new Error('No training samples. Generate data first.');
    }
    
    // Build model if not already built
    if (!this.predictor.isReady()) {
      this.predictor.build();
    }
    
    console.log(`Training on ${samples.length} samples...`);
    
    const history = await this.predictor.train(samples, {
      ...options,
      onEpochEnd: (epoch, logs) => {
        this.stats.trainingLoss = logs.loss;
        
        if (options.onEpochEnd) {
          options.onEpochEnd(epoch, logs);
        }
      },
    });
    
    return history;
  }
  
  /**
   * Get the trained predictor
   */
  getPredictor() {
    return this.predictor;
  }
  
  /**
   * Get data collector
   */
  getDataCollector() {
    return this.dataCollector;
  }
  
  /**
   * Get current stats
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Save model and training data
   */
  async save(modelName = 'path-predictor') {
    await this.predictor.save(modelName);
    
    // Also save training data to localStorage
    const data = this.dataCollector.exportSamples();
    localStorage.setItem(`${modelName}-data`, JSON.stringify(data));
    
    console.log(`Saved model and ${data.numSamples} samples`);
  }
  
  /**
   * Load model and training data
   */
  async load(modelName = 'path-predictor') {
    const loaded = await this.predictor.load(modelName);
    
    // Try to load training data
    const dataStr = localStorage.getItem(`${modelName}-data`);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      this.dataCollector.importSamples(data);
      this.stats.totalSamples = data.numSamples;
      console.log(`Loaded ${data.numSamples} samples`);
    }
    
    return loaded;
  }
  
  /**
   * Export everything as downloadable JSON
   */
  exportAll() {
    return {
      stats: this.stats,
      samples: this.dataCollector.exportSamples(),
      modelWeights: this.predictor.isReady() ? this.predictor.exportWeights() : null,
    };
  }
}

