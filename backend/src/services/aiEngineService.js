const axios = require('axios');
const logger = require('../utils/logger');

class AIEngineService {
  constructor() {
    this.baseURL = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    this.timeout = 30000; // 30 seconds
    this.retries = 3;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`AI Engine Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('AI Engine Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`AI Engine Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('AI Engine Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Analyze single transaction
  async analyzeFraud(transactionData) {
    try {
      const response = await this.client.post('/predict', transactionData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Fraud analysis error:', error);
      throw new Error(`Fraud analysis failed: ${error.message}`);
    }
  }

  // Batch fraud analysis
  async batchAnalyzeFraud(transactions, batchId = null) {
    try {
      const payload = {
        transactions,
        batch_id: batchId
      };

      const response = await this.client.post('/batch-predict', payload);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Batch fraud analysis error:', error);
      throw new Error(`Batch analysis failed: ${error.message}`);
    }
  }

  // Get model statistics
  async getModelStats() {
    try {
      const response = await this.client.get('/model/stats');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Model stats error:', error);
      throw new Error(`Failed to get model stats: ${error.message}`);
    }
  }

  // Trigger model retraining
  async retrainModel(trainingData = null) {
    try {
      const payload = trainingData ? { training_data: trainingData } : {};
      const response = await this.client.post('/model/retrain', payload);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Model retrain error:', error);
      throw new Error(`Model retraining failed: ${error.message}`);
    }
  }

  // Get recent alerts
  async getRecentAlerts() {
    try {
      const response = await this.client.get('/alerts/recent');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Recent alerts error:', error);
      throw new Error(`Failed to get recent alerts: ${error.message}`);
    }
  }

  // Retry mechanism for failed requests
  async withRetry(operation, maxRetries = this.retries) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`AI Engine request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  // Analyze transaction with retry
  async analyzeFraudWithRetry(transactionData) {
    return this.withRetry(() => this.analyzeFraud(transactionData));
  }

  // Batch analyze with retry
  async batchAnalyzeFraudWithRetry(transactions, batchId = null) {
    return this.withRetry(() => this.batchAnalyzeFraud(transactions, batchId));
  }

  // Get connection status
  async getConnectionStatus() {
    try {
      const health = await this.healthCheck();
      return {
        connected: health.success,
        baseURL: this.baseURL,
        lastChecked: new Date().toISOString(),
        details: health.data
      };
    } catch (error) {
      return {
        connected: false,
        baseURL: this.baseURL,
        lastChecked: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Update configuration
  updateConfig(config) {
    if (config.baseURL) {
      this.baseURL = config.baseURL;
      this.client.defaults.baseURL = config.baseURL;
    }
    
    if (config.timeout) {
      this.timeout = config.timeout;
      this.client.defaults.timeout = config.timeout;
    }
    
    if (config.retries) {
      this.retries = config.retries;
    }

    logger.info('AI Engine service configuration updated', config);
  }
}

// Singleton instance
const aiEngineService = new AIEngineService();

module.exports = aiEngineService;