import io from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  // Connect to WebSocket server
  connect(url = process.env.REACT_APP_WS_URL || 'http://localhost:5000') {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventListeners();
    return this;
  }

  // Setup default event listeners
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('connection_status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });

    // Fraud detection events
    this.socket.on('fraud_alert', (data) => {
      this.emit('fraud_alert', data);
    });

    this.socket.on('fraud_analysis_complete', (data) => {
      this.emit('fraud_analysis_complete', data);
    });

    // Analytics events
    this.socket.on('analytics_update', (data) => {
      this.emit('analytics_update', data);
    });

    this.socket.on('dashboard_stats_update', (data) => {
      this.emit('dashboard_stats_update', data);
    });

    // System events
    this.socket.on('system_alert', (data) => {
      this.emit('system_alert', data);
    });

    this.socket.on('model_retrain_complete', (data) => {
      this.emit('model_retrain_complete', data);
    });
  }

  // Handle reconnection
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.socket.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connection_failed', { 
        attempts: this.reconnectAttempts 
      });
    }
  }

  // Subscribe to specific channels
  subscribeToAlerts() {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe_alerts');
      console.log('Subscribed to fraud alerts');
    }
  }

  subscribeToAnalytics() {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe_analytics');
      console.log('Subscribed to analytics updates');
    }
  }

  // Add event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return this;
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
    return this;
  }

  // Emit event to listeners
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Send message to server
  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, message not sent:', event, data);
    }
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Request fraud analysis
  requestFraudAnalysis(transactionData) {
    this.send('analyze_transaction', transactionData);
  }

  // Request batch analysis
  requestBatchAnalysis(transactions) {
    this.send('batch_analyze', { transactions });
  }

  // Request dashboard update
  requestDashboardUpdate() {
    this.send('request_dashboard_update');
  }

  // Send user preferences
  updateUserPreferences(preferences) {
    this.send('update_preferences', preferences);
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;