import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
};

const toastColors = {
  success: 'bg-success text-white',
  error: 'bg-error text-white',
  warning: 'bg-warning text-white',
  info: 'bg-info text-white',
};

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  const Icon = toastIcons[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${toastColors[type]} min-w-[300px] max-w-md`}
    >
        <Icon className="w-5 h-5 flex-shrink-0 text-white" />
        <p className="flex-1 text-sm font-medium text-white">{message}</p>
        <button
          onClick={onClose}
          className="p-1 hover:opacity-90 rounded transition-opacity"
        >
          <X className="w-4 h-4 text-white" />
        </button>
    </motion.div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    // Ensure toasts render above modals and overlays by using a very high z-index
    <div className="fixed top-4 right-4 z-[11000] space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            duration={toast.duration}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
