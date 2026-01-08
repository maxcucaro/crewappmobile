import React from 'react';
import Toast, { ToastMessage } from './Toast';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemoveToast }) => {
  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 space-y-4 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="transform transition-all duration-300 ease-in-out pointer-events-auto">
          <Toast toast={toast} onRemove={onRemoveToast} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;