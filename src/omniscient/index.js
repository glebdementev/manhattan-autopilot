/**
 * Omniscient Path Module
 * 
 * Two navigation modes:
 * 1. OmniscientController - Follows perfect A* paths (has full knowledge)
 * 2. PathFollowingController - Neural network that follows given paths
 */

// Core pathfinding
export { MinHeap } from './MinHeap.js';
export { ObstacleGrid } from './ObstacleGrid.js';
export { AStarPathfinder } from './AStarPathfinder.js';
export { PathSmoother } from './PathSmoother.js';
export { OmniscientPathGenerator } from './OmniscientPathGenerator.js';

// Controllers
export { OmniscientController } from './OmniscientController.js';
export { PathFollowingController } from './PathFollowingController.js';

// Training (path-following approach)
export { PathFollowingDataCollector } from './PathFollowingDataCollector.js';
export { PathPredictor } from './PathPredictor.js';
export { TrainingOrchestrator } from './TrainingOrchestrator.js';
export { ReportGenerator } from './ReportGenerator.js';
