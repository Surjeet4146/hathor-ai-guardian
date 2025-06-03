import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// AI Engine API instance
const aiApi = axios.create({
  baseURL: process.env.REACT_APP_AI_API_URL || 'http://localhost:8001',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    
    if (error.response?.status === 429) {
      toast.error('Rate limit exceeded. Please try again later.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.status === 404) {
      toast.error('Resource not found.');
    } else {
      toast.error(message);
    }
    
    console.error('API Response Error:', error);
    return Promise.reject(error);
  }
);

// AI API interceptors
aiApi.interceptors.request.use(
  (config) => {
    console.log(`AI API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('AI API Request Error:', error);
    return Promise.reject(error);
  }
);

aiApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.detail || error.message || 'AI service error';
    toast.error(message);
    console.error('AI API Response Error:', error);
    return Promise.reject(error);
  }
);

// Backend API endpoints
export const backendApi = {
  // Health check
  health: () => api.get('/health'),
  
  // Fraud detection
  analyzeSingleTransaction: (data) => api.post('/api/fraud/analyze', data),
  batchAnalyze: (data) => api.post('/api/fraud/batch-analyze', data),
  
  // Analytics
  getAnalyticsSummary: (params = {}) => api.get('/api/analytics/summary', { params }),
  getTrendData: (params = {}) => api.get('/api/analytics/trends', { params }),
  getRiskMetrics: (params = {}) => api.get('/api/analytics/risk-metrics', { params }),
  
  // Alerts
  getAlerts: (params = {}) => api.get('/api/alerts', { params }),
  getAlert: (id) => api.get(`/api/alerts/${id}`),
  updateAlert: (id, data) => api.put(`/api/alerts/${id}`, data),
  deleteAlert: (id) => api.delete(`/api/alerts/${id}`),
  
  // Dashboard
  getDashboardStats: () => api.get('/api/dashboard/stats'),
  getRecentTransactions: (params = {}) => api.get('/api/dashboard/recent-transactions', { params }),
  getNetworkHealth: () => api.get('/api/dashboard/network-health'),
};

// AI Engine API endpoints
export const aiEngineApi = {
  // Health check
  health: () => aiApi.get('/health'),
  
  // Fraud prediction
  predict: (data) => aiApi.post('/predict', data),
  batchPredict: (data) => aiApi.post('/batch-predict', data),
  
  // Model management
  getModelStats: () => aiApi.get('/model/stats'),
  retrainModel: () => aiApi.post('/model/retrain'),
  
  // Alerts
  getRecentAlerts: () => aiApi.get('/alerts/recent'),
};

// Utility functions
export const apiUtils = {
  // Format error message
  formatError: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    return error.message || 'An unexpected error occurred';
  },
  
  // Check if error is network related
  isNetworkError: (error) => {
    return !error.response && error.code === 'NETWORK_ERROR';
  },
  
  // Check if error is timeout
  isTimeoutError: (error) => {
    return error.code === 'ECONNABORTED';
  },
  
  // Retry helper
  retry: async (fn, retries = 3, delay = 1000) => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && (apiUtils.isNetworkError(error) || apiUtils.isTimeoutError(error))) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiUtils.retry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }
};

// Custom hooks for API calls
export const useApiCall = (apiFunction, options = {}) => {
  const { onSuccess, onError, retry = false } = options;
  
  return async (...args) => {
    try {
      const response = retry 
        ? await apiUtils.retry(() => apiFunction(...args))
        : await apiFunction(...args);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      return response.data;
    } catch (error) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  };
};

export default api;