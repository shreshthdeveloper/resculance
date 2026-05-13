import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion } from 'framer-motion';
import { Activity, Mail, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import logo from '../../assets/logo.png';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      console.log('Attempting login with:', data.email);
      const response = await login(data.email, data.password);
      console.log('Login successful, response:', response);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      // Prefer backend 'error' field (from server error handler), then 'message', then axios message
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Login failed. Please try again.';
      setError(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-background-card rounded-3xl shadow-hover p-8 border border-border">
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
            <h1 className="text-3xl font-display font-bold text-text mb-2">Welcome Back</h1>
            <p className="text-text-secondary text-center">
              Sign in to access your Resculance dashboard
            </p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-2xl mb-6"
            >
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="Email address"
                  className={`input pl-12 ${errors.email ? 'border-error' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-error">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="Password"
                  className={`input pl-12 ${errors.password ? 'border-error' : ''}`}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-error">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border" />
                <span className="text-sm text-text-secondary">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-primary hover:opacity-80 transition-opacity">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-text-secondary text-sm mt-6">
          © 2025 Resculance. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};
