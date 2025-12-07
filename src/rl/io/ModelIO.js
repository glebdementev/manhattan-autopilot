/**
 * Model Import/Export utilities for RL Agent
 * Handles saving and loading trained models
 */

import * as tf from '@tensorflow/tfjs';
import { RL_CONFIG } from '../../config.js';

export class ModelIO {
  /**
   * Export agent state to JSON file
   * @param {Object} policyNetwork - Policy network with getWeights()
   * @param {Object} valueNetwork - Value network with getWeights()
   * @param {Object} trainingHistory - Training history object
   * @param {number} trainingStep - Current training step
   * @param {number} explorationRate - Current exploration rate
   * @param {number} observationSize - Observation size
   * @param {number} actionSize - Action size
   * @returns {Promise<boolean>} - Success status
   */
  static async exportToFile(
    policyNetwork,
    valueNetwork,
    trainingHistory,
    trainingStep,
    explorationRate,
    observationSize,
    actionSize
  ) {
    if (!policyNetwork || !valueNetwork) {
      console.warn('No model to export');
      return false;
    }
    
    try {
      const exportData = {
        version: 1,
        type: 'drone-rl-agent',
        timestamp: Date.now(),
        config: {
          observationSize,
          actionSize,
          hiddenUnits: RL_CONFIG.HIDDEN_UNITS,
        },
        policyWeights: policyNetwork.getWeights(),
        valueWeights: valueNetwork.getWeights(),
        trainingHistory,
        trainingStep,
        explorationRate,
      };
      
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drone-rl-agent-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('RL Agent exported successfully');
      return true;
    } catch (error) {
      console.error('Export error:', error);
      return false;
    }
  }
  
  /**
   * Import agent state from file
   * @param {File} file - File object to import
   * @param {Object} policyNetwork - Policy network with setWeights()
   * @param {Object} valueNetwork - Value network with setWeights()
   * @returns {Promise<Object|null>} - Imported state or null on error
   */
  static async importFromFile(file, policyNetwork, valueNetwork) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.version || !importData.policyWeights) {
        throw new Error('Invalid model file format');
      }
      
      // Load policy weights
      if (policyNetwork && importData.policyWeights) {
        policyNetwork.setWeights(importData.policyWeights);
      }
      
      // Load value weights
      if (valueNetwork && importData.valueWeights) {
        valueNetwork.setWeights(importData.valueWeights);
      }
      
      console.log('RL Agent imported successfully');
      
      return {
        trainingHistory: importData.trainingHistory || {},
        trainingStep: importData.trainingStep || 0,
        explorationRate: importData.explorationRate || RL_CONFIG.INITIAL_EXPLORATION,
        config: importData.config || {},
      };
    } catch (error) {
      console.error('Import error:', error);
      return null;
    }
  }
  
  /**
   * Create a download link for data
   * @param {Object} data - Data to download
   * @param {string} filename - Filename for download
   */
  static downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /**
   * Read file as JSON
   * @param {File} file - File to read
   * @returns {Promise<Object>} - Parsed JSON
   */
  static async readJSONFile(file) {
    const text = await file.text();
    return JSON.parse(text);
  }
}

