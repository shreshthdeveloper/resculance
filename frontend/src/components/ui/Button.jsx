import { motion } from 'framer-motion';

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  disabled = false,
  className = '', 
  onClick,
  type = 'button',
  ...props 
}) => {
  const baseClasses = 'rounded-2xl font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap';
  
  const variants = {
    primary: 'bg-primary text-white hover:shadow-lg',
    secondary: 'bg-background-card text-text border border-border hover:border-primary hover:bg-background',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
    danger: 'bg-error text-white hover:opacity-90',
    success: 'bg-success text-white hover:opacity-90',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.03 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
};
