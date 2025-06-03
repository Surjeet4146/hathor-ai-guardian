import React from 'react';
import { 
  ExclamationTriangleIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

const AlertCard = ({ alert, onDismiss, onViewDetails }) => {
  const getAlertConfig = (level) => {
    switch (level) {
      case 'critical':
        return {
          icon: ExclamationTriangleIcon,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-400',
          textColor: 'text-red-800',
          titleColor: 'text-red-900'
        };
      case 'high':
        return {
          icon: ExclamationCircleIcon,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          iconColor: 'text-orange-400',
          textColor: 'text-orange-800',
          titleColor: 'text-orange-900'
        };
      case 'medium':
        return {
          icon: InformationCircleIcon,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-400',
          textColor: 'text-yellow-800',
          titleColor: 'text-yellow-900'
        };
      case 'low':
        return {
          icon: CheckCircleIcon,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-400',
          textColor: 'text-blue-800',
          titleColor: 'text-blue-900'
        };
      default:
        return {
          icon: InformationCircleIcon,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-400',
          textColor: 'text-gray-800',
          titleColor: 'text-gray-900'
        };
    }
  };

  const config = getAlertConfig(alert.alert_level);
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${config.titleColor}`}>
              Fraud Alert - {alert.alert_level.toUpperCase()}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
              </span>
              {alert.status === 'active' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              )}
            </div>
          </div>

          <div className={`mt-2 text-sm ${config.textColor}`}>
            <p>
              Transaction <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                {alert.tx_hash.substring(0, 10)}...{alert.tx_hash.slice(-6)}
              </code> flagged with {(alert.confidence * 100).toFixed(1)}% confidence
            </p>

            {alert.risk_factors && alert.risk_factors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium mb-1">Risk Factors:</p>
                <div className="flex flex-wrap gap-1">
                  {alert.risk_factors.map((factor, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white bg-opacity-50"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => onViewDetails(alert)}
              className={`text-xs font-medium ${config.textColor} hover:underline`}
            >
              View Details
            </button>
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.alert_id)}
                className="text-xs font-medium text-gray-600 hover:text-gray-800 hover:underline"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertCard;