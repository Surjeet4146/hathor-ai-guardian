import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

// Components
import StatsCard from '../components/dashboard/StatsCard';
import AlertsOverview from '../components/dashboard/AlertsOverview';
import TransactionChart from '../components/dashboard/TransactionChart';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import NetworkHealth from '../components/dashboard/NetworkHealth';
import ThreatMap from '../components/dashboard/ThreatMap';

// Services
import { getDashboardStats, getRecentAlerts, getNetworkHealth } from '../services/api';

// Hooks
import { useSocket } from '../hooks/useSocket';

const Dashboard = () => {
  const [realTimeStats, setRealTimeStats] = useState(null);
  const { connected, lastMessage } = useSocket();

  // Fetch dashboard data
  const { data: dashboardData, isLoading: statsLoading, refetch: refetchStats } = useQuery(
    'dashboardStats',
    getDashboardStats,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery(
    'recentAlerts',
    getRecentAlerts,
    {
      refetchInterval: 15000, // Refetch every 15 seconds
    }
  );

  const { data: networkData, isLoading: networkLoading } = useQuery(
    'networkHealth',
    getNetworkHealth,
    {
      refetchInterval: 60000, // Refetch every minute
    }
  );

  // Handle real-time updates via WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'dashboard_update') {
      setRealTimeStats(lastMessage.data);
      // Optionally refetch data to ensure consistency
      refetchStats();
      refetchAlerts();
    }
  }, [lastMessage, refetchStats, refetchAlerts]);

  // Combine real-time data with fetched data
  const stats = realTimeStats || dashboardData?.stats || {};
  const alerts = alertsData?.alerts || [];
  const networkHealth = networkData?.health || {};

  const statsCards = [
    {
      title: 'Total Transactions',
      value: stats.total_transactions?.toLocaleString() || '0',
      change: stats.transactions_change || 0,
      icon: ChartBarIcon,
      color: 'blue'
    },
    {
      title: 'Fraud Detected',
      value: stats.fraud_detected?.toLocaleString() || '0',
      change: stats.fraud_change || 0,
      icon: ShieldCheckIcon,
      color: 'red'
    },
    {
      title: 'Risk Score',
      value: `${(stats.avg_risk_score * 100).toFixed(1)}%` || '0%',
      change: stats.risk_change || 0,
      icon: ExclamationTriangleIcon,
      color: 'yellow'
    },
    {
      title: 'Active Alerts',
      value: stats.active_alerts?.toLocaleString() || '0',
      change: stats.alerts_change || 0,
      icon: ExclamationTriangleIcon,
      color: 'orange'
    },
    {
      title: 'Detection Rate',
      value: `${(stats.detection_rate * 100).toFixed(1)}%` || '0%',
      change: stats.detection_change || 0,
      icon: CpuChipIcon,
      color: 'green'
    },
    {
      title: 'Response Time',
      value: `${stats.avg_response_time || 0}ms`,
      change: stats.response_change || 0,
      icon: ClockIcon,
      color: 'purple'
    }
  ];

  if (statsLoading && !realTimeStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            HATHOR AI Guardian Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time fraud detection and blockchain security monitoring
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
            connected 
              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
              : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          
          {/* Last Update */}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statsCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <StatsCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Transaction Chart */}
        <motion.div
          className="xl:col-span-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <TransactionChart data={stats.transaction_history} />
        </motion.div>

        {/* Alerts Overview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <AlertsOverview 
            alerts={alerts} 
            loading={alertsLoading}
          />
        </motion.div>

        {/* Network Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <NetworkHealth 
            data={networkHealth} 
            loading={networkLoading}
          />
        </motion.div>

        {/* Recent Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <RecentAlerts 
            alerts={alerts.slice(0, 5)} 
            loading={alertsLoading}
          />
        </motion.div>

        {/* Threat Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <ThreatMap data={stats.threat_locations} />
        </motion.div>
      </div>

      {/* System Status Footer */}
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                System Status: Operational
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All monitoring systems are functioning normally
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Uptime: 99.9%
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {stats.uptime_days || 0} days, {stats.uptime_hours || 0} hours
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;