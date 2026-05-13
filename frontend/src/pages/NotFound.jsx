import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-background-card flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <AlertCircle className="w-12 h-12 text-red-600" />
        </motion.div>

        <h1 className="text-9xl font-display font-bold mb-4">404</h1>
        <h2 className="text-3xl font-display font-bold mb-4">Page Not Found</h2>
        <p className="text-secondary mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button>
              <Home className="w-5 h-5 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Decorative Elements */}
        <div className="mt-12 text-secondary text-sm">
          <p>If you believe this is a mistake, please contact support.</p>
        </div>
      </motion.div>
    </div>
  );
};
