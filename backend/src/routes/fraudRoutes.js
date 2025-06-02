const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const logger = require('../utils/logger');

const router = express.Router();

// AI Engine URL
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

// Validation middleware
const validateTransaction = [
  body('tx_hash').notEmpty().withMessage('Transaction hash is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('sender').notEmpty().withMessage('Sender address is required'),
  body('receiver').notEmpty().withMessage('Receiver address is required'),
  body('network').isIn(['hathor', 'ethereum', 'bitcoin', 'polygon']).withMessage('Invalid network'),
];

// @route   POST /api/fraud/analyze
// @desc    Analyze a single transaction for fraud
// @access  Public
router.post('/analyze', validateTransaction, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const transactionData = req.body;
    
    // Add timestamp if not provided
    if (!transactionData.timestamp) {
      transactionData.timestamp = Date.now() / 1000;
    }

    logger.info(`Analyzing transaction: ${transactionData.tx_hash}`);

    // Call AI Engine for fraud detection
    const aiResponse = await axios.post(`${AI_ENGINE_URL}/predict`, transactionData, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const prediction = aiResponse.data;

    // Save transaction to database
    const transaction = new Transaction({
      ...transactionData,
      fraud_prediction: prediction,
      analyzed_at: new Date()
    });

    await transaction.save();

    // Create alert if high risk
    if (prediction.is_fraud && prediction.confidence > 0.7) {
      const alert = new Alert({
        transaction_id: transaction._id,
        tx_hash: transactionData.tx_hash,
        alert_level: prediction.alert_level,
        confidence: prediction.confidence,
        risk_factors: extractRiskFactors(prediction),
        status: 'active'
      });

      await alert.save();

      // Emit real-time alert via Socket.IO
      const io = req.app.get('socketio');
      io.to('fraud_alerts').emit('new_fraud_alert', {
        alert_id: alert._id,
        tx_hash: transactionData.tx_hash,
        confidence: prediction.confidence,
        alert_level: prediction.alert_level,
        timestamp: new Date().toISOString()
      });

      logger.warn(`Fraud alert created for transaction: ${transactionData.tx_hash}`);
    }

    res.json({
      success: true,
      data: {
        transaction_id: transaction._id,
        prediction: prediction,
        alert_created: prediction.is_fraud && prediction.confidence > 0.7
      }
    });

  } catch (error) {
    logger.error('Fraud analysis error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'AI Engine unavailable'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   POST /api/fraud/batch-analyze
// @desc    Analyze multiple transactions for fraud
// @access  Public
router.post('/batch-analyze', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transactions array is required'
      });
    }

    if (transactions.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 transactions per batch'
      });
    }

    logger.info(`Batch analyzing ${transactions.length} transactions`);

    // Call AI Engine for batch prediction
    const aiResponse = await axios.post(`${AI_ENGINE_URL}/batch-predict`, transactions, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const batchResults = aiResponse.data;
    const savedTransactions = [];
    const alertsCreated = [];

    // Process each result
    for (let i = 0; i < batchResults.results.length; i++) {
      const prediction = batchResults.results[i];
      const originalTx = transactions[i];

      // Save transaction
      const transaction = new Transaction({
        ...originalTx,
        fraud_prediction: prediction,
        analyzed_at: new Date()
      });

      await transaction.save();
      savedTransactions.push(transaction._id);

      // Create alert if high risk
      if (prediction.is_fraud && prediction.confidence > 0.7) {
        const alert = new Alert({
          transaction_id: transaction._id,
          tx_hash: originalTx.tx_hash,
          alert_level: prediction.alert_level,
          confidence: prediction.confidence,
          risk_factors: extractRiskFactors(prediction),
          status: 'active'
        });

        await alert.save();
        alertsCreated.push(alert._id);
      }
    }

    // Emit batch alert summary
    if (alertsCreated.length > 0) {
      const io = req.app.get('socketio');
      io.to('fraud_alerts').emit('batch_fraud_alerts', {
        batch_id: batchResults.batch_id,
        total_alerts: alertsCreated.length,
        high_risk_count: alertsCreated.length,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        batch_id: batchResults.batch_id,
        total_processed: transactions.length,
        fraud_detected: batchResults.fraud_detected,
        transactions_saved: savedTransactions.length,
        alerts_created: alertsCreated.length,
        results: batchResults.results
      }
    });

  } catch (error) {
    logger.error('Batch fraud analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/fraud/history/:tx_hash
// @desc    Get fraud analysis history for a transaction
// @access  Public
router.get('/history/:tx_hash', async (req, res) => {
  try {
    const { tx_hash } = req.params;

    const transaction = await Transaction.findOne({ tx_hash })
      .populate('alerts')
      .sort({ analyzed_at: -1 });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    logger.error('Transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/fraud/stats
// @desc    Get fraud detection statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    let startDate;
    switch (timeframe) {
      case '1h':
        startDate = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const [totalTransactions, fraudulentTransactions, alerts] = await Promise.all([
      Transaction.countDocuments({ analyzed_at: { $gte: startDate } }),
      Transaction.countDocuments({ 
        analyzed_at: { $gte: startDate },
        'fraud_prediction.is_fraud': true 
      }),
      Alert.countDocuments({ created_at: { $gte: startDate } })
    ]);

    // Get AI Engine model stats
    let modelStats = {};
    try {
      const aiStatsResponse = await axios.get(`${AI_ENGINE_URL}/model/stats`);
      modelStats = aiStatsResponse.data;
    } catch (error) {
      logger.warn('Could not fetch AI model stats:', error.message);
    }

    res.json({
      success: true,
      data: {
        timeframe,
        total_transactions: totalTransactions,
        fraudulent_transactions: fraudulentTransactions,
        fraud_rate: totalTransactions > 0 ? (fraudulentTransactions / totalTransactions) : 0,
        alerts_generated: alerts,
        model_stats: modelStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Fraud stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   POST /api/fraud/feedback
// @desc    Submit feedback for fraud detection improvement
// @access  Public
router.post('/feedback', async (req, res) => {
  try {
    const { tx_hash, is_fraud_actual, confidence, notes } = req.body;

    if (!tx_hash || typeof is_fraud_actual !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash and actual fraud status are required'
      });
    }

    // Find the transaction
    const transaction = await Transaction.findOne({ tx_hash });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Update transaction with feedback
    transaction.feedback = {
      is_fraud_actual,
      confidence: confidence || 1.0,
      notes: notes || '',
      submitted_at: new Date()
    };

    await transaction.save();

    logger.info(`Feedback submitted for transaction: ${tx_hash}`);

    res.json({
      success: true,
      data: {
        message: 'Feedback submitted successfully',
        tx_hash,
        feedback: transaction.feedback
      }
    });

  } catch (error) {
    logger.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Helper function to extract risk factors from prediction
function extractRiskFactors(prediction) {
  const riskFactors = [];

  if (prediction.confidence > 0.9) {
    riskFactors.push('Very high confidence fraud detection');
  }

  if (prediction.models.isolation_forest.prediction === 'anomaly') {
    riskFactors.push('Anomalous transaction pattern');
  }

  if (prediction.models.random_forest.probability > 0.8) {
    riskFactors.push('High random forest fraud probability');
  }

  if (prediction.models.neural_network.probability > 0.8) {
    riskFactors.push('High neural network fraud probability');
  }

  // Check specific features
  const features = prediction.features_used;
  if (features.amount > 10000) {
    riskFactors.push('Large transaction amount');
  }

  if (features.sender_risk_score > 0.7) {
    riskFactors.push('High sender risk score');
  }

  if (features.receiver_risk_score > 0.7) {
    riskFactors.push('High receiver risk score');
  }

  return riskFactors;
}

module.exports = router;