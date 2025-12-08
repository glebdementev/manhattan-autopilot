/**
 * TrainingOrchestrator - Runs episodes to collect training data
 * 
 * Uses ForestGenerator as single source of truth for position generation.
 * Supports scene variation (unique forests per episode batch).
 */
import { OmniscientPathGenerator } from './OmniscientPathGenerator.js';
import { TrainingDataCollector } from './TrainingDataCollector.js';
import { PathPredictor } from './PathPredictor.js';
import { TARGET } from '../config.js';

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
      uniqueScenes: 0,
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
   * Uses ForestGenerator for position generation (single source of truth)
   * 
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
      seed = this.nextSeed(seed);
      
      // Use ForestGenerator for spawn position (same as online mode, center spawn)
      const start = this.forest.findSpawnPosition();
      seed = this.nextSeed(seed);
      
      // Use ForestGenerator for target position (same as online mode)
      const target = this.forest.generateTargetPosition(
        start.x, start.z,
        minDist, maxDist,
        seed
      );
      
      // Verify minimum distance is enforced
      const actualDist = Math.sqrt(
        (target.x - start.x) ** 2 + (target.z - start.z) ** 2
      );
      if (actualDist < minDist) {
        console.warn(`Episode ${episode}: Target too close (${actualDist.toFixed(1)}m < ${minDist}m), skipping`);
        this.stats.failedPaths++;
        continue;
      }
      
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
   * Generate training data across multiple unique scenes
   * Each scene has unique terrain (perlin noise), tree distribution, and bushes
   * 
   * @param {number} numScenes - Number of unique forest scenes
   * @param {number} episodesPerScene - Episodes per scene
   * @param {Function} regenerateForest - Callback to regenerate forest with new seed
   */
  async generateMultiSceneData(numScenes, episodesPerScene, regenerateForest) {
    if (!regenerateForest) {
      throw new Error('regenerateForest callback required for multi-scene generation');
    }
    
    let baseSeed = Date.now();
    
    for (let scene = 0; scene < numScenes; scene++) {
      // Generate unique seed for this scene
      const sceneSeed = baseSeed + scene * 1000;
      
      // Regenerate forest with new seed (unique terrain, trees, bushes)
      const newForest = await regenerateForest(sceneSeed);
      this.setForest(newForest);
      this.stats.uniqueScenes++;
      
      console.log(`Scene ${scene + 1}/${numScenes} (seed: ${sceneSeed})`);
      
      // Generate episodes in this scene
      await this.generateTrainingData(episodesPerScene, {
        clearPrevious: false, // Keep accumulating samples
      });
      
      // Yield to UI between scenes
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return this.stats;
  }
  
  /**
   * Advance seed deterministically
   */
  nextSeed(seed) {
    return (seed * 16807) % 2147483647;
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

