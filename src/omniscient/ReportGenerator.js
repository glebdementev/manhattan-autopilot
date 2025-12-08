/**
 * ReportGenerator - Creates downloadable training reports
 */

export class ReportGenerator {
  /**
   * Generate a comprehensive training report
   * @param {Object} stats - Training statistics
   * @param {Array} trainingHistory - Epoch-by-epoch loss history
   * @param {Object} modelInfo - Model architecture info
   */
  static generate(stats, trainingHistory = [], modelInfo = {}) {
    const timestamp = new Date().toISOString();
    
    const report = {
      meta: {
        generatedAt: timestamp,
        version: '1.0',
      },
      summary: {
        totalEpisodes: stats.episodesGenerated || 0,
        successfulPaths: stats.successfulPaths || 0,
        failedPaths: stats.failedPaths || 0,
        successRate: stats.episodesGenerated > 0
          ? ((stats.successfulPaths / stats.episodesGenerated) * 100).toFixed(1) + '%'
          : 'N/A',
        totalSamples: stats.totalSamples || 0,
        uniqueScenes: stats.uniqueScenes || 0,
        finalLoss: stats.trainingLoss?.toFixed(6) ?? 'N/A',
      },
      model: {
        observationDim: modelInfo.observationDim || 'N/A',
        actionDim: modelInfo.actionDim || 'N/A',
        architecture: modelInfo.architecture || 'MLP',
      },
      trainingHistory: trainingHistory.map(h => ({
        epoch: h.epoch,
        loss: h.loss?.toFixed(6),
        valLoss: h.valLoss?.toFixed(6),
      })),
    };

    return report;
  }

  /**
   * Download the report as JSON
   */
  static download(report, filename = 'training-report') {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

