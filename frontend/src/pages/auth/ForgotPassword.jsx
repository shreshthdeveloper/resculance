import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion } from 'framer-motion';
import { Activity, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services';
import logo from '../../assets/logo.png';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
});

export const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    
    try {
      // Call forgot password API when implemented
      await authService.forgotPassword(data.email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-background-card flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-hover p-8 max-w-md text-center"
        >
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Check Your Email</h2>
          <p className="text-secondary mb-6">
            We've sent a password reset link to your email address. Please check your inbox and follow the instructions.
          </p>
          <Link to="/login">
            <Button className="w-full">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Login
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-background-card flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-hover p-8">
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 overflow-hidden"
            >
              <img src={logo} alt="Resculance Logo" className="w-full h-full object-contain" />
            </motion.div>
            <h1 className="text-3xl font-display font-bold mt-5 mb-2">Forgot Password?</h1>
            <p className="text-secondary text-center">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl mb-6"
            >
              {error}
            </motion.div>
          )}

          {/* Forgot Password Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="Email address"
                  className={`input pl-12 ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Send Reset Link
            </Button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-primary hover:underline flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-secondary text-sm mt-6">
          © 2025 Resculance. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};
