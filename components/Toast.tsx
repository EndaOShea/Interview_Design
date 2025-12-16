import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />;
      case 'success':
        return <CheckCircle size={18} className="text-green-400" />;
      case 'info':
        return <Info size={18} className="text-blue-400" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'error':
        return 'bg-red-900/90 border-red-700 text-red-100';
      case 'success':
        return 'bg-green-900/90 border-green-700 text-green-100';
      case 'info':
        return 'bg-blue-900/90 border-blue-700 text-blue-100';
    }
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${getStyles()} shadow-lg backdrop-blur-sm animate-slideIn min-w-[320px] max-w-[480px]`}>
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <p className="flex-1 text-sm leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

export default Toast;
