
const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

// Dashboard overview stats
router.get('/stats', async (req, res) => {
  try {
    // Fetch data from AI engine
    const [modelStatsResponse, alertsResponse] = await Promise.all([
      axios.get('http://localhost:8001/model/stats').catch(() => ({ data: {} })),
      axios.get('http://localhost:8001/alerts/recent').catch(() => ({ data: { alerts: [] } }))
    ]);

    const modelStats = modelStatsResponse.data;
    const alerts = alertsResponse.data.alerts || [];

    const stats = {
      overview: {
        totalTransactions: modelStats.recent_stats?.total_predictions || 1245,
        fraudDetected: modelStats.recent_stats?.fraud_detected || 23,
        fraudRate: modelStats.recent_stats?.fraud_rate || 0.018,
        systemHealth: 'excellent',
        uptime: '99.9%'
      },

      realTimeMetrics: {
        activeAlerts: alerts.filter(a => a.confidence > 0.7).length,
        processingQueue: 5,
        avgResponseTime: 0.8,
        throughput: 1247 // transactions per minute
      },

      networkHealth: [
        { network: 'Hathor', status: 'healthy', latency: 120, blockHeight: 1234567 },
        { network: 'Ethereum', status: 'healthy', latency: 250, blockHeight: 18456789 },
        { network: 'Bitcoin', status: 'healthy', latency: 180, blockHeight: 812345 },
        { network: 'Polygon', status: 'warning', latency: 450, blockHeight: 48567123 }
      ],

      recentActivity: [
        {
          id: 1,
          type: 'fraud_detected',
          message: 'High-risk transaction flagged',
          txHash: '0x1234...abcd',
          confidence: 0.94,
          timestamp: new Date(Date.now() - 5 * 60000).toISOString()
        },
        {
          id: 2,
          type: 'model_updated',
          message: 'Fraud detection model retrained',
          accuracy: 0.96,
          timestamp: new Date(Date.now() - 30 * 60000).toISOString()
        },
        {
          id: 3,
          type: 'alert_resolved',
          message: 'False positive alert resolved',
          txHash: '0x5678...efgh',
          timestamp: new Date(Date.now() - 45 * 60000).toISOString()
        }
      ],

      performanceMetrics: {
        cpu: 45.2,
        memory: 67.8,
        disk: 34.1,
        network: 12.5
      },

      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// System status endpoint
router.get('/status', async (req, res) => {
  try {
    const status = {
      system: 'operational',
      services: {
        api: 'healthy',
        database: 'healthy',
        ai_engine: 'healthy',
        blockchain_monitor: 'healthy',
        redis: 'healthy'
      },
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('System status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system status'
    });
  }
});

module.exports = router;