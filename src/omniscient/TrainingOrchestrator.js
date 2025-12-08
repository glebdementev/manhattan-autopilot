/**
 * TrainingOrchestrator - Runs episodes to collect training data
 * 
 * Uses ForestGenerator as single source of truth for position generation.
 * Supports scene variation (unique forests per episode batch).
 * 
 * Uses path-following approach: model receives path waypoints in observation.
 */
import { OmniscientPathGenerator } from './OmniscientPathGenerator.js';
import { PathFollowingDataCollector } from './PathFollowingDataCollector.js';
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
    
    // Components - using path-following approach (no LIDAR needed)
    this.pathGenerator = new OmniscientPathGenerator(forestGenerator);
    this.dataCollector = new PathFollowingDataCollector();
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
      
      // Search for a target that is both collision-free and has a valid omniscient path
      const MAX_TARGET_ATTEMPTS = 50;
      let target = null;
      let path = null;
      
      for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt++) {
        seed = this.nextSeed(seed);
        
        const candidate = this.forest.generateTargetPosition(
          start.x, start.z,
          minDist, maxDist,
          seed
        );
        
        // Forest could not find a non-intersecting target for this seed
        if (!candidate) {
          continue;
        }
        
        // Verify minimum distance is enforced (extra safety)
        const actualDist = Math.sqrt(
          (candidate.x - start.x) ** 2 + (candidate.z - start.z) ** 2
        );
        if (actualDist < minDist) {
          continue;
        }
        
        // Generate omniscient path for this candidate
        const candidatePath = this.pathGenerator.generatePath(
          start.x, start.y, start.z,
          candidate.x, candidate.y, candidate.z
        );
        
        if (candidatePath && candidatePath.length >= 2) {
          target = candidate;
          path = candidatePath;
          break;
        }
      }
      
      if (!target || !path) {
        this.stats.failedPaths++;
        continue;
      }
      
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
   * Collect training samples along a path (path-following approach)
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
        
        // Drone state (only position needed for this simple collector)
        const droneState = { x, y, z };
        
        // Next waypoint is the end of current segment
        const nextWaypoint = to;
        
        // Collect sample (direction to next waypoint)
        this.dataCollector.collectSample(droneState, nextWaypoint);
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
   * Save model only (samples are ephemeral)
   */
  async save(modelName = 'path-predictor') {
    await this.predictor.save(modelName);
    console.log(`Saved model`);
  }
  
  /**
   * Save model to downloadable files
   */
  async saveToFiles(modelName = 'path-predictor') {
    await this.predictor.download(modelName);
    console.log(`Saved model to files`);
  }

  /**
   * Load model from IndexedDB
   */
  async load(modelName = 'path-predictor') {
    return await this.predictor.load(modelName);
  }

  /**
   * Load default model from bundled file
   */
  async loadDefaultModel(url = './default-model.json') {
    return await this.predictor.loadFromURL(url);
  }

  /**
   * Load model from local files
   */
  async loadFromFiles(files) {
    return await this.predictor.loadFromFiles(files);
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

