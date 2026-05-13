import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useUiStore from '../../store/uiStore';

export const Loader = ({ inline = false, message }) => {
  const { globalLoading, loadingMessage } = useUiStore();

  // Inline small loader (for table rows or inline places)
  if (inline) {
    return (
      <div className="flex items-center justify-center">
        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span className="text-sm text-text-secondary">{message || 'Loading...'}</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {globalLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 25
            }}
            className="relative rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl min-w-[240px] bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 border border-gray-200/50 dark:border-gray-700/50"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary-dark/5 rounded-2xl animate-pulse" />
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary border-r-primary-dark rounded-full"
                style={{
                  background: 'linear-gradient(to right, transparent, transparent)',
                }}
              />
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 m-auto w-4 h-4 bg-gradient-to-br from-primary to-primary-dark rounded-full"
              />
            </div>
            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-sm font-medium text-center text-gray-800 dark:text-gray-100"
              >
                {message || loadingMessage || 'Loading...'}
              </motion.div>
              <motion.div className="flex justify-center gap-1 mt-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut"
                    }}
                    className="w-1.5 h-1.5 bg-primary rounded-full"
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Loader;
