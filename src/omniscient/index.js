/**
 * Omniscient Path Module
 * 
 * Two navigation modes:
 * 1. OmniscientController - Follows perfect A* paths (has full knowledge)
 * 2. LearnedController - Uses neural network trained on omniscient paths
 */

// Core pathfinding
export { MinHeap } from './MinHeap.js';
export { ObstacleGrid } from './ObstacleGrid.js';
export { AStarPathfinder } from './AStarPathfinder.js';
export { PathSmoother } from './PathSmoother.js';
export { OmniscientPathGenerator } from './OmniscientPathGenerator.js';

// Controllers
export { OmniscientController } from './OmniscientController.js';
export { LearnedController } from './LearnedController.js';

// Training
export { TrainingDataCollector } from './TrainingDataCollector.js';
export { PathPredictor } from './PathPredictor.js';
export { TrainingOrchestrator } from './TrainingOrchestrator.js';
