import React from 'react';
import { BellIcon, UserCircleIcon, CogIcon } from '@heroicons/react/24/outline';

const Header = ({ title, onNotificationClick, unreadCount = 0 }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Title */}
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              {title || 'HATHOR AI Guardian'}
            </h1>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              onClick={onNotificationClick}
              className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
            >
              <BellIcon className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Settings */}
            <button className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full">
              <CogIcon className="h-6 w-6" />
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <UserCircleIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">Admin</div>
                <div className="text-sm text-gray-500">System Monitor</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;