import { OfflineTrainer } from '../rl/OfflineTrainer.js';

/**
 * TrainingController - Manages RL training lifecycle
 */
export class TrainingController {
  constructor(rlAgent, rlEnvironment, forestGenerator) {
    this.rlAgent = rlAgent;
    this.rlEnvironment = rlEnvironment;
    this.forestGenerator = forestGenerator;
    this.offlineTrainer = null;
    this.isTraining = false;
    this.hasLoadedModel = false;
    
    // Callbacks
    this.onTrainingStart = null;
    this.onTrainingStop = null;
    this.onModelLoaded = null;
  }

  /**
   * Start offline training
   */
  async start(ui) {
    if (this.isTraining) return;
    
    console.log('Starting offline training...');
    this.isTraining = true;
    
    if (this.onTrainingStart) this.onTrainingStart();
    
    // Create trainer
    this.offlineTrainer = new OfflineTrainer(
      this.rlAgent,
      this.rlEnvironment,
      this.forestGenerator
    );
    
    // Setup callbacks
    this.offlineTrainer.onProgress = (stats) => {
      ui.updateTrainingStats(stats);
    };
    
    this.offlineTrainer.onEpisodeEnd = (info) => {
      const msg = info.success 
        ? `Episode ${info.episode}: SUCCESS (reward: ${info.reward.toFixed(1)})`
        : `Episode ${info.episode}: ${info.reward.toFixed(1)} reward, ${info.steps} steps`;
      ui.logTraining(msg, info.success ? 'success' : 'default');
    };
    
    this.offlineTrainer.onComplete = (stats) => {
      ui.logTraining(
        `Training complete! ${stats.episodes} episodes, ${(stats.successRate * 100).toFixed(1)}% success rate`,
        'info'
      );
    };
    
    // Start training
    await this.offlineTrainer.start(1000);
    
    // Training finished
    this.hasLoadedModel = true;
    ui.setModelLoaded(true);
    ui.logTraining('Model ready! Click "Download Model" to save, or "Stop Training" to return.', 'info');
    
    if (this.onModelLoaded) this.onModelLoaded();
  }

  /**
   * Stop training
   */
  stop() {
    if (!this.isTraining) return;
    
    console.log('Stopping training...');
    
    if (this.offlineTrainer) {
      this.offlineTrainer.stop();
    }
    
    this.isTraining = false;
    
    if (this.onTrainingStop) this.onTrainingStop();
  }

  /**
   * Download trained model
   */
  async downloadModel(ui) {
    const success = await this.rlAgent.exportToFile();
    if (success) {
      ui.logTraining('Model downloaded!', 'success');
    } else {
      ui.logTraining('Download failed', 'failure');
    }
  }

  /**
   * Import model from file
   */
  async importModel(file, ui) {
    console.log('Importing model...');
    ui.setModelStatus('Loading...');
    
    const success = await this.rlAgent.importFromFile(file);
    
    if (success) {
      this.hasLoadedModel = true;
      ui.setModelLoaded(true);
      ui.setModelStatus('Loaded');
      console.log('Model imported successfully!');
      
      if (this.onModelLoaded) this.onModelLoaded();
      return true;
    } else {
      ui.setModelStatus('Load failed');
      console.error('Failed to import model');
      return false;
    }
  }
}

