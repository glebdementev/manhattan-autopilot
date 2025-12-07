/**
 * Reinforcement Learning Module
 * 
 * Main exports for the RL system
 */

import * as tf from '@tensorflow/tfjs';

// Initialize TensorFlow.js with optimal settings
tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use half-precision for speed

// Log backend info
tf.ready().then(() => {
  console.log(`TensorFlow.js backend: ${tf.getBackend()}`);
});

// Main classes
export { RLAgent } from './RLAgent.js';
export { RLEnvironment } from './RLEnvironment.js';
export { OfflineTrainer } from './OfflineTrainer.js';

// Networks
export { PolicyNetwork, ValueNetwork } from './networks/index.js';

// Training
export { ExperienceBuffer, AdvantageCalculator, TrainingManager } from './training/index.js';

// Environment components
export {
  ObservationBuilder,
  RewardCalculator,
  TargetManager,
  TerminationChecker,
  EpisodeStats,
} from './environment/index.js';

// Exploration
export { ExplorationManager } from './exploration/index.js';

// I/O
export { ModelIO } from './io/index.js';

