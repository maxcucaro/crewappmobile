import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-7 w-7 text-green-500" />;
      case 'error':
        return <XCircle className="h-7 w-7 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-7 w-7 text-yellow-500" />;
      case 'info':
        return <Info className="h-7 w-7 text-blue-500" />;
      default:
        return <Info className="h-7 w-7 text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-white border-green-300 shadow-green-100';
      case 'error':
        return 'bg-white border-red-300 shadow-red-100';
      case 'warning':
        return 'bg-white border-yellow-300 shadow-yellow-100';
      case 'info':
        return 'bg-white border-blue-300 shadow-blue-100';
      default:
        return 'bg-white border-blue-300 shadow-blue-100';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      case 'info':
        return 'text-blue-700';
      default:
        return 'text-blue-700';
    }
  };

  return (
    <div className={`min-w-96 max-w-lg w-full border-2 rounded-xl shadow-2xl pointer-events-auto ${getBackgroundColor()} mx-auto transform transition-all duration-300 ease-out`}>
      <div className="p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-4 w-0 flex-1">
            <p className={`text-lg font-semibold ${getTextColor()} leading-tight`}>
              {toast.title}
            </p>
            {toast.message && (
              <p className={`mt-3 text-base ${getTextColor()} opacity-90 leading-relaxed`}>
                {toast.message}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className={`rounded-full inline-flex ${getTextColor()} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 p-2 transition-all duration-200 hover:bg-white hover:bg-opacity-20`}
              onClick={() => onRemove(toast.id)}
            >
              <span className="sr-only">Chiudi</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;