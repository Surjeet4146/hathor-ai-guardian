const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  tx_hash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  sender: {
    type: String,
    required: true,
    index: true
  },
  receiver: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  network: {
    type: String,
    enum: ['hathor', 'ethereum', 'bitcoin', 'polygon'],
    default: 'hathor'
  },
  tx_type: {
    type: String,
    enum: ['transfer', 'contract_call', 'token_mint', 'token_burn', 'swap'],
    default: 'transfer'
  },
  gas_fee: {
    type: Number,
    default: 0
  },
  block_height: {
    type: Number,
    index: true
  },
  confirmations: {
    type: Number,
    default: 0
  },
  
  // Fraud analysis results
  fraud_analysis: {
    is_fraud: {
      type: Boolean,
      default: false
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    risk_score: {
      type: Number,
      min: 0,
      max: 1
    },
    alert_level: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    analyzed_at: Date,
    model_version: String
  },

  // Risk factors
  risk_factors: [{
    type: String
  }],

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'flagged'],
    default: 'pending'
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ 'fraud_analysis.is_fraud': 1, timestamp: -1 });
transactionSchema.index({ sender: 1, timestamp: -1 });
transactionSchema.index({ receiver: 1, timestamp: -1 });
transactionSchema.index({ network: 1, timestamp: -1 });

// Virtual for transaction age
transactionSchema.virtual('age').get(function() {
  return Date.now() - this.timestamp.getTime();
});

// Static method to find fraud transactions
transactionSchema.statics.findFraudulent = function(limit = 50) {
  return this.find({ 'fraud_analysis.is_fraud': true })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Instance method to mark as fraudulent
transactionSchema.methods.markAsFraud = function(analysisData) {
  this.fraud_analysis = {
    ...analysisData,
    analyzed_at: new Date()
  };
  this.status = 'flagged';
  return this.save();
};

module.exports = mongoose.model('Transaction', transactionSchema);