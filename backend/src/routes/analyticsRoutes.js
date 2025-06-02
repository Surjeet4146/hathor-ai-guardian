const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

// Analytics summary endpoint
router.get('/summary', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    // Get analytics data from AI engine
    const aiResponse = await axios.get(`http://localhost:8001/model/stats`);
    const modelStats = aiResponse.data;

    // Mock analytics data (replace with actual database queries)
    const summary = {
      timeframe,
      totalTransactions: 15420,
      fraudDetected: 89,
      fraudRate: 0.0058,
      avgConfidence: modelStats.recent_stats?.avg_confidence || 0.75,
      modelAccuracy: 0.94,
      
      trends: {
        transactionVolume: [
          { time: '00:00', value: 1200 },
          { time: '04:00', value: 800 },
          { time: '08:00', value: 2100 },
          { time: '12:00', value: 2800 },
          { time: '16:00', value: 3200 },
          { time: '20:00', value: 2300 }
        ],
        fraudDetection: [
          { time: '00:00', value: 5 },
          { time: '04:00', value: 2 },
          { time: '08:00', value: 12 },
          { time: '12:00', value: 18 },
          { time: '16:00', value: 25 },
          { time: '20:00', value: 15 }
        ]
      },

      topRiskFactors: [
        { factor: 'High transaction amount', count: 23 },
        { factor: 'Unusual time pattern', count: 18 },
        { factor: 'New address interaction', count: 15 },
        { factor: 'Multiple rapid transactions', count: 12 },
        { factor: 'Cross-chain activity', count: 8 }
      ],

      networkStats: {
        hathor: { transactions: 8500, fraudRate: 0.004 },
        ethereum: { transactions: 4200, fraudRate: 0.008 },
        bitcoin: { transactions: 2100, fraudRate: 0.003 },
        polygon: { transactions: 620, fraudRate: 0.012 }
      },

      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Analytics summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics summary'
    });
  }
});

// Real-time metrics endpoint
router.get('/metrics/realtime', async (req, res) => {
  try {
    const metrics = {
      activeTransactions: 247,
      processingQueue: 12,
      avgProcessingTime: 1.2,
      systemLoad: 0.65,
      modelStatus: 'active',
      lastUpdate: new Date().toISOString()
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Real-time metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real-time metrics'
    });
  }
});

// Feature importance endpoint
router.get('/features/importance', async (req, res) => {
  try {
    const aiResponse = await axios.get(`http://localhost:8001/model/stats`);
    const featureData = aiResponse.data.feature_importance || {};

    res.json({
      success: true,
      data: {
        features: featureData,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Feature importance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feature importance data'
    });
  }
});

module.exports = router;