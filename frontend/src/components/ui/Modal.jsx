import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';
import { createPortal } from 'react-dom';

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  footer,
  size = 'md',
}) => {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  // Render using a portal so the modal and overlay are attached to document.body.
  // This ensures the fixed-position overlay covers the entire viewport even when
  // parent elements have transforms or create stacking contexts.
  return (
    typeof document !== 'undefined' ? createPortal(
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              // use very large z-index to ensure overlay covers any dropdowns/tooltips that may use high z-index
              className="fixed inset-0 bg-black bg-opacity-50 z-[10000]"
            />
            <div
              className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className={`bg-background-card rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[95vh] overflow-hidden`}
              >
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <h2 className="text-2xl font-display font-semibold text-text">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-background rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-text" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(95vh-160px)]">
                  {children}
                </div>
                {footer && (
                  <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-background">
                    {footer}
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>,
      document.body
    ) : (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black bg-opacity-50 z-[10000]"
            />
            <div
              className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className={`bg-background-card rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[95vh] overflow-hidden`}
              >
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <h2 className="text-2xl font-display font-semibold text-text">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-background rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-text" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(95vh-160px)]">
                  {children}
                </div>
                {footer && (
                  <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-background">
                    {footer}
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    )
  );
};
