const axios = require('axios');
const logger = require('../utils/logger');
const { Alert } = require('../models');

class NotificationService {
  constructor() {
    this.webhookUrls = {
      slack: process.env.SLACK_WEBHOOK_URL,
      discord: process.env.DISCORD_WEBHOOK_URL,
      teams: process.env.TEAMS_WEBHOOK_URL
    };
    this.emailConfig = {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.FROM_EMAIL || 'alerts@hathor-guardian.com'
    };
  }

  async sendFraudAlert(alertData) {
    try {
      const alert = await Alert.findOne({ alert_id: alertData.alert_id });
      if (!alert) {
        throw new Error('Alert not found');
      }

      const notifications = [];

      // Send to configured channels
      if (this.webhookUrls.slack) {
        notifications.push(this.sendSlackAlert(alertData));
      }

      if (this.webhookUrls.discord) {
        notifications.push(this.sendDiscordAlert(alertData));
      }

      // Send email if configured
      if (this.emailConfig.apiKey && process.env.ALERT_EMAIL_RECIPIENTS) {
        notifications.push(this.sendEmailAlert(alertData));
      }

      const results = await Promise.allSettled(notifications);
      
      // Update alert with notification status
      const notificationRecords = results.map((result, index) => ({
        channel: this.getChannelName(index),
        recipient: this.getRecipient(index),
        sent_at: new Date(),
        status: result.status === 'fulfilled' ? 'sent' : 'failed'
      }));

      alert.notifications_sent.push(...notificationRecords);
      await alert.save();

      logger.info(`Fraud alert notifications sent for ${alertData.alert_id}`);
      return { success: true, notifications: notificationRecords };

    } catch (error) {
      logger.error('Failed to send fraud alert:', error);
      throw error;
    }
  }

  async sendSlackAlert(alertData) {
    const color = this.getAlertColor(alertData.alert_level);
    const message = {
      text: "🚨 Fraud Alert Detected",
      attachments: [{
        color: color,
        title: `${alertData.alert_level.toUpperCase()} Risk Transaction Detected`,
        fields: [
          {
            title: "Transaction Hash",
            value: `\`${alertData.tx_hash}\``,
            short: true
          },
          {
            title: "Confidence",
            value: `${(alertData.confidence * 100).toFixed(1)}%`,
            short: true
          },
          {
            title: "Amount",
            value: `${alertData.transaction_details?.amount || 'N/A'}`,
            short: true
          },
          {
            title: "Network",
            value: alertData.transaction_details?.network || 'Unknown',
            short: true
          },
          {
            title: "Sender",
            value: `\`${alertData.transaction_details?.sender || 'N/A'}\``,
            short: false
          },
          {
            title: "Receiver",
            value: `\`${alertData.transaction_details?.receiver || 'N/A'}\``,
            short: false
          },
          {
            title: "Risk Factors",
            value: alertData.risk_factors?.join(', ') || 'None specified',
            short: false
          }
        ],
        footer: "HATHOR AI Guardian",
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    return axios.post(this.webhookUrls.slack, message);
  }

  async sendDiscordAlert(alertData) {
    const color = this.getAlertColorDiscord(alertData.alert_level);
    const message = {
      embeds: [{
        title: "🚨 Fraud Alert Detected",
        description: `**${alertData.alert_level.toUpperCase()}** risk transaction detected`,
        color: color,
        fields: [
          {
            name: "Transaction Hash",
            value: `\`${alertData.tx_hash}\``,
            inline: true
          },
          {
            name: "Confidence",
            value: `${(alertData.confidence * 100).toFixed(1)}%`,
            inline: true
          },
          {
            name: "Amount",
            value: `${alertData.transaction_details?.amount || 'N/A'}`,
            inline: true
          },
          {
            name: "Network",
            value: alertData.transaction_details?.network || 'Unknown',
            inline: true
          },
          {
            name: "Sender",
            value: `\`${alertData.transaction_details?.sender || 'N/A'}\``,
            inline: false
          },
          {
            name: "Receiver",
            value: `\`${alertData.transaction_details?.receiver || 'N/A'}\``,
            inline: false
          },
          {
            name: "Risk Factors",
            value: alertData.risk_factors?.join(', ') || 'None specified',
            inline: false
          }
        ],
        footer: {
          text: "HATHOR AI Guardian"
        },
        timestamp: new Date().toISOString()
      }]
    };

    return axios.post(this.webhookUrls.discord, message);
  }

  async sendEmailAlert(alertData) {
    const recipients = process.env.ALERT_EMAIL_RECIPIENTS.split(',');
    const emailData = {
      personalizations: recipients.map(email => ({ to: [{ email: email.trim() }] })),
      from: { email: this.emailConfig.fromEmail },
      subject: `🚨 ${alertData.alert_level.toUpperCase()} Fraud Alert - ${alertData.tx_hash}`,
      content: [{
        type: "text/html",
        value: this.generateEmailHTML(alertData)
      }]
    };

    return axios.post('https://api.sendgrid.v3/mail/send', emailData, {
      headers: {
        'Authorization': `Bearer ${this.emailConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  generateEmailHTML(alertData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #dc2626; color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
          .alert-level { font-size: 24px; font-weight: bold; text-transform: uppercase; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #6b7280; font-family: monospace; background-color: #f9fafb; padding: 5px; border-radius: 4px; }
          .risk-factors { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 10px; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="alert-level">🚨 ${alertData.alert_level} Fraud Alert</div>
            <div>Suspicious transaction detected</div>
          </div>
          
          <div class="field">
            <div class="label">Transaction Hash:</div>
            <div class="value">${alertData.tx_hash}</div>
          </div>
          
          <div class="field">
            <div class="label">Confidence Level:</div>
            <div class="value">${(alertData.confidence * 100).toFixed(1)}%</div>
          </div>
          
          <div class="field">
            <div class="label">Transaction Amount:</div>
            <div class="value">${alertData.transaction_details?.amount || 'N/A'}</div>
          </div>
          
          <div class="field">
            <div class="label">Network:</div>
            <div class="value">${alertData.transaction_details?.network || 'Unknown'}</div>
          </div>
          
          <div class="field">
            <div class="label">Sender Address:</div>
            <div class="value">${alertData.transaction_details?.sender || 'N/A'}</div>
          </div>
          
          <div class="field">
            <div class="label">Receiver Address:</div>
            <div class="value">${alertData.transaction_details?.receiver || 'N/A'}</div>
          </div>
          
          ${alertData.risk_factors && alertData.risk_factors.length > 0 ? `
          <div class="risk-factors">
            <div class="label">Risk Factors:</div>
            <ul>
              ${alertData.risk_factors.map(factor => `<li>${factor}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="footer">
            <p>This alert was generated by HATHOR AI Guardian at ${new Date().toLocaleString()}</p>
            <p>Please review this transaction immediately and take appropriate action.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAlertColor(level) {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#7c2d12'
    };
    return colors[level] || colors.medium;
  }

  getAlertColorDiscord(level) {
    const colors = {
      low: 0x10b981,
      medium: 0xf59e0b,
      high: 0xef4444,
      critical: 0x7c2d12
    };
    return colors[level] || colors.medium;
  }

  getChannelName(index) {
    const channels = ['slack', 'discord', 'email'];
    return channels[index] || 'unknown';
  }

  getRecipient(index) {
    if (index === 0) return 'slack-channel';
    if (index === 1) return 'discord-channel';
    if (index === 2) return process.env.ALERT_EMAIL_RECIPIENTS?.split(',')[0] || 'email';
    return 'unknown';
  }

  // Method to send system health alerts
  async sendSystemAlert(type, message, severity = 'medium') {
    try {
      const alertData = {
        alert_level: severity,
        tx_hash: 'SYSTEM_ALERT',
        confidence: 1.0,
        risk_factors: [type],
        transaction_details: {
          amount: 'N/A',
          network: 'System',
          sender: 'HATHOR Guardian',
          receiver: 'System Admin'
        }
      };

      // Override message for system alerts
      if (this.webhookUrls.slack) {
        const slackMessage = {
          text: `🔧 System Alert: ${type}`,
          attachments: [{
            color: this.getAlertColor(severity),
            title: `System ${severity.toUpperCase()} Alert`,
            fields: [
              {
                title: "Alert Type",
                value: type,
                short: true
              },
              {
                title: "Severity",
                value: severity.toUpperCase(),
                short: true
              },
              {
                title: "Message",
                value: message,
                short: false
              }
            ],
            footer: "HATHOR AI Guardian - System Monitoring",
            ts: Math.floor(Date.now() / 1000)
          }]
        };

        await axios.post(this.webhookUrls.slack, slackMessage);
      }

      logger.info(`System alert sent: ${type} - ${message}`);
      return { success: true };

    } catch (error) {
      logger.error('Failed to send system alert:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();