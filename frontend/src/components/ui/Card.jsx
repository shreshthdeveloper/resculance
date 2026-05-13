import { motion } from 'framer-motion';

export const Card = ({ 
  children, 
  className = '', 
  hover = true,
  ...props 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { y: -2, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)' } : {}}
      className={`card ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};
