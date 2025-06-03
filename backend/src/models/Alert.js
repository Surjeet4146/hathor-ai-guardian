const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alert_id: {
    type: String,
    required: true,
    unique: true,
    default: () => `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  tx_hash: {
    type: String,
    required: true,
    index: true
  },
  alert_level: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  risk_factors: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'false_positive'],
    default: 'active',
    index: true
  },
  
  // Associated transaction details
  transaction_details: {
    amount: Number,
    sender: String,
    receiver: String,
    network: String,
    timestamp: Date
  },

  // Alert metadata
  triggered_by: {
    type: String,
    enum: ['fraud_model', 'rule_engine', 'manual', 'external_feed'],
    default: 'fraud_model'
  },
  model_version: String,
  
  // Resolution tracking
  resolved_by: String,
  resolved_at: Date,
  resolution_notes: String,
  
  // Notification tracking
  notifications_sent: [{
    channel: {
      type: String,
      enum: ['email', 'slack', 'webhook', 'sms']
    },
    recipient: String,
    sent_at: Date,
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
alertSchema.index({ createdAt: -1 });
alertSchema.index({ alert_level: 1, status: 1 });
alertSchema.index({ status: 1, createdAt: -1 });

// Virtual for alert age
alertSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for is_critical
alertSchema.virtual('is_critical').get(function() {
  return this.alert_level === 'critical' || this.confidence > 0.9;
});

// Static methods
alertSchema.statics.getActiveAlerts = function(level = null) {
  const query = { status: 'active' };
  if (level) query.alert_level = level;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('transaction_details');
};

alertSchema.statics.getStatsByLevel = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$alert_level',
        count: { $sum: 1 },
        avg_confidence: { $avg: '$confidence' }
      }
    }
  ]);
};

// Instance methods
alertSchema.methods.acknowledge = function(userId, notes = '') {
  this.status = 'acknowledged';
  this.resolved_by = userId;
  this.resolved_at = new Date();
  this.resolution_notes = notes;
  return this.save();
};

alertSchema.methods.resolve = function(userId, notes = '') {
  this.status = 'resolved';
  this.resolved_by = userId;
  this.resolved_at = new Date();
  this.resolution_notes = notes;
  return this.save();
};

alertSchema.methods.markFalsePositive = function(userId, notes = '') {
  this.status = 'false_positive';
  this.resolved_by = userId;
  this.resolved_at = new Date();
  this.resolution_notes = notes;
  return this.save();
};

module.exports = mongoose.model('Alert', alertSchema);