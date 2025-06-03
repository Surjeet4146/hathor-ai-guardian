const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  network: {
    type: String,
    enum: ['hathor', 'ethereum', 'bitcoin', 'polygon'],
    required: true,
    index: true
  },
  
  // Risk assessment
  risk_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
    index: true
  },
  reputation_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  
  // Transaction statistics
  transaction_count: {
    type: Number,
    default: 0
  },
  total_volume_sent: {
    type: Number,
    default: 0
  },
  total_volume_received: {
    type: Number,
    default: 0
  },
  
  // Activity tracking
  first_seen: {
    type: Date,
    index: true
  },
  last_seen: {
    type: Date,
    index: true
  },
  last_activity: {
    type: Date,
    default: Date.now
  },
  
  // Risk factors
  risk_factors: [{
    factor: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    detected_at: Date,
    confidence: Number
  }],
  
  // Classification flags
  is_exchange: {
    type: Boolean,
    default: false
  },
  is_mixer: {
    type: Boolean,
    default: false
  },
  is_gambling: {
    type: Boolean,
    default: false
  },
  is_sanctioned: {
    type: Boolean,
    default: false,
    index: true
  },
  is_darknet: {
    type: Boolean,
    default: false
  },
  
  // Labels and tags
  labels: [{
    type: String
  }],
  tags: [{
    name: String,
    source: String,
    confidence: Number,
    added_at: Date
  }],
  
  // Behavioral patterns
  behavioral_patterns: {
    avg_transaction_amount: Number,
    transaction_frequency: Number, // transactions per day
    active_hours: [Number], // hours of day when active
    preferred_recipients: [String],
    unusual_activity_flags: [String]
  },
  
  // External data
  external_sources: [{
    source: String,
    data: mongoose.Schema.Types.Mixed,
    last_updated: Date
  }],
  
  // Monitoring settings
  is_monitored: {
    type: Boolean,
    default: false
  },
  alert_threshold: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
addressSchema.index({ network: 1, risk_score: -1 });
addressSchema.index({ is_sanctioned: 1, network: 1 });
addressSchema.index({ last_activity: -1, is_monitored: 1 });

// Virtual for total volume
addressSchema.virtual('total_volume').get(function() {
  return this.total_volume_sent + this.total_volume_received;
});

// Virtual for address age
addressSchema.virtual('age_days').get(function() {
  if (!this.first_seen) return 0;
  return Math.floor((Date.now() - this.first_seen.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for activity level
addressSchema.virtual('activity_level').get(function() {
  const daysSinceLastActivity = Math.floor((Date.now() - this.last_activity.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceLastActivity <= 1) return 'high';
  if (daysSinceLastActivity <= 7) return 'medium';
  if (daysSinceLastActivity <= 30) return 'low';
  return 'inactive';
});

// Static methods
addressSchema.statics.findHighRisk = function(threshold = 0.7) {
  return this.find({ risk_score: { $gte: threshold } })
    .sort({ risk_score: -1 });
};

addressSchema.statics.findSanctioned = function() {
  return this.find({ is_sanctioned: true });
};

addressSchema.statics.getNetworkStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$network',
        total_addresses: { $sum: 1 },
        high_risk_count: {
          $sum: { $cond: [{ $gte: ['$risk_score', 0.7] }, 1, 0] }
        },
        avg_risk_score: { $avg: '$risk_score' },
        sanctioned_count: {
          $sum: { $cond: ['$is_sanctioned', 1, 0] }
        }
      }
    }
  ]);
};

// Instance methods
addressSchema.methods.updateRiskScore = function(newScore, reason = '') {
  const oldScore = this.risk_score;
  this.risk_score = Math.max(0, Math.min(1, newScore));
  
  if (reason) {
    this.risk_factors.push({
      factor: `Risk score updated: ${reason}`,
      severity: newScore > 0.7 ? 'high' : newScore > 0.5 ? 'medium' : 'low',
      detected_at: new Date(),
      confidence: 0.8
    });
  }
  
  return this.save();
};

addressSchema.methods.addRiskFactor = function(factor, severity = 'medium', confidence = 0.5) {
  this.risk_factors.push({
    factor,
    severity,
    detected_at: new Date(),
    confidence
  });
  
  // Adjust risk score based on new factor
  const severityMultiplier = {
    low: 0.1,
    medium: 0.2,
    high: 0.3,
    critical: 0.4
  };
  
  const riskIncrease = severityMultiplier[severity] * confidence;
  this.risk_score = Math.min(1, this.risk_score + riskIncrease);
  
  return this.save();
};

addressSchema.methods.updateActivity = function(transactionData) {
  this.transaction_count += 1;
  this.last_activity = new Date();
  
  if (transactionData.amount) {
    if (transactionData.type === 'sent') {
      this.total_volume_sent += transactionData.amount;
    } else {
      this.total_volume_received += transactionData.amount;
    }
  }
  
  if (!this.first_seen) {
    this.first_seen = new Date();
  }
  this.last_seen = new Date();
  
  return this.save();
};

module.exports = mongoose.model('Address', addressSchema);