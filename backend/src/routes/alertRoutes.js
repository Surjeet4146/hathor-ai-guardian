const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

// Get recent alerts
router.get('/', async (req, res) => {
  try {
    const { limit = 50, severity, status = 'active' } = req.query;
    
    const aiResponse = await axios.get(`http://localhost:8001/alerts/recent`);
    let alerts = aiResponse.data.alerts || [];

    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter(alert => {
        if (alert.confidence > 0.9) return severity === 'critical';
        if (alert.confidence > 0.8) return severity === 'high';
        if (alert.confidence > 0.6) return severity === 'medium';
        return severity === 'low';
      });
    }

    // Transform alerts to match frontend expectations
    const transformedAlerts = alerts.slice(0, parseInt(limit)).map(alert => ({
      id: alert.tx_hash,
      txHash: alert.tx_hash,
      severity: alert.confidence > 0.9 ? 'critical' : 
                alert.confidence > 0.8 ? 'high' :
                alert.confidence > 0.6 ? 'medium' : 'low',
      confidence: alert.confidence,
      riskScore: alert.risk_score,
      timestamp: alert.timestamp,
      status: status,
      description: `High-risk transaction detected with ${(alert.confidence * 100).toFixed(1)}% confidence`,
      riskFactors: [
        'Unusual transaction pattern',
        'High amount transfer',
        'New address interaction'
      ]
    }));

    res.json({
      success: true,
      data: {
        alerts: transformedAlerts,
        total: transformedAlerts.length,
        summary: {
          critical: transformedAlerts.filter(a => a.severity === 'critical').length,
          high: transformedAlerts.filter(a => a.severity === 'high').length,
          medium: transformedAlerts.filter(a => a.severity === 'medium').length,
          low: transformedAlerts.filter(a => a.severity === 'low').length
        }
      }
    });

  } catch (error) {
    logger.error('Alerts fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

// Update alert status
router.patch('/:alertId/status', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { status, notes } = req.body;

    // In a real application, update the alert in the database
    logger.info(`Alert ${alertId} status updated to ${status}`, { notes });

    // Emit real-time update
    const io = req.app.get('socketio');
    io.to('fraud_alerts').emit('alert_updated', {
      alertId,
      status,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Alert status updated successfully',
      data: { alertId, status, updatedAt: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Alert update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert status'
    });
  }
});

// Get alert statistics
router.get('/stats', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;

    const stats = {
      timeframe,
      totalAlerts: 89,
      criticalAlerts: 12,
      highAlerts: 28,
      mediumAlerts: 35,
      lowAlerts: 14,
      resolvedAlerts: 67,
      avgResponseTime: 4.2, // minutes
      
      trends: [
        { time: '00:00', alerts: 3 },
        { time: '04:00', alerts: 1 },
        { time: '08:00', alerts: 8 },
        { time: '12:00', alerts: 15 },
        { time: '16:00', alerts: 22 },
        { time: '20:00', alerts: 18 }
      ],

      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Alert stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics'
    });
  }
});

module.exports = router;