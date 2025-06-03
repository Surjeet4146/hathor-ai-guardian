import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const useWebSocket = (url = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000') => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [analyticsUpdates, setAnalyticsUpdates] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      toast.success('Real-time monitoring connected');

      // Subscribe to fraud alerts
      newSocket.emit('subscribe_alerts');
      
      // Subscribe to analytics updates
      newSocket.emit('subscribe_analytics');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      toast.error('Real-time monitoring disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      toast.error('Failed to connect to real-time monitoring');
    });

    // Fraud alert handlers
    newSocket.on('fraud_alert', (alert) => {
      console.log('New fraud alert:', alert);
      setAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts
      
      // Show toast notification based on alert level
      const alertMessage = `Fraud detected: ${alert.tx_hash.substring(0, 10)}...`;
      
      switch (alert.alert_level) {
        case 'critical':
          toast.error(alertMessage, {
            duration: 8000,
            icon: '🚨'
          });
          break;
        case 'high':
          toast.error(alertMessage, {
            duration: 6000,
            icon: '⚠️'
          });
          break;
        case 'medium':
          toast(alertMessage, {
            duration: 4000,
            icon: '⚡'
          });
          break;
        default:
          toast(alertMessage, {
            duration: 3000,
            icon: 'ℹ️'
          });
      }
    });

    // Analytics update handlers
    newSocket.on('analytics_update', (data) => {
      console.log('Analytics update:', data);
      setAnalyticsUpdates(data);
    });

    newSocket.on('system_status', (status) => {
      console.log('System status update:', status);
      
      if (status.status === 'error') {
        toast.error(`System alert: ${status.message}`);
      } else if (status.status === 'warning') {
        toast(`System notice: ${status.message}`, {
          icon: '⚠️'
        });
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [url]);

  // Helper functions
  const subscribeToAlerts = () => {
    if (socket && isConnected) {
      socket.emit('subscribe_alerts');
    }
  };

  const subscribeToAnalytics = () => {
    if (socket && isConnected) {
      socket.emit('subscribe_analytics');
    }
  };

  const unsubscribeFromAlerts = () => {
    if (socket && isConnected) {
      socket.emit('unsubscribe_alerts');
    }
  };

  const unsubscribeFromAnalytics = () => {
    if (socket && isConnected) {
      socket.emit('unsubscribe_analytics');
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const removeAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.alert_id !== alertId));
  };

  const sendMessage = (event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot send message:', event, data);
    }
  };

  return {
    socket,
    isConnected,
    alerts,
    analyticsUpdates,
    subscribeToAlerts,
    subscribeToAnalytics,
    unsubscribeFromAlerts,
    unsubscribeFromAnalytics,
    clearAlerts,
    removeAlert,
    sendMessage
  };
};

export default useWebSocket;