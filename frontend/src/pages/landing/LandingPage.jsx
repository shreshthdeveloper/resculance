import { motion } from 'framer-motion';
import { 
  Ambulance, 
  Heart, 
  Users, 
  Activity, 
  Shield, 
  Zap, 
  MapPin, 
  Clock,
  ArrowRight,
  CheckCircle,
  Building2,
  Phone,
  Mail,
  Sparkles,
  TrendingUp,
  Globe,
  Star
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export const LandingPage = () => {
  const features = [
    {
      icon: Activity,
      title: 'Real-Time Monitoring',
      description: 'Track patient vitals and ambulance locations in real-time with live updates and alerts.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Users,
      title: 'Seamless Collaboration',
      description: 'Connect hospitals, fleet owners, and medical professionals for coordinated emergency response.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Shield,
      title: 'Secure & Compliant',
      description: 'HIPAA-compliant platform ensuring patient data privacy and security at every step.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Zap,
      title: 'Instant Dispatch',
      description: 'Automated ambulance assignment and routing for fastest emergency response times.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: MapPin,
      title: 'GPS Tracking',
      description: 'Live ambulance tracking with optimized routing and ETA predictions.',
      color: 'from-red-500 to-rose-500'
    },
    {
      icon: Clock,
      title: '24/7 Operations',
      description: 'Round-the-clock system availability with 99.9% uptime guarantee.',
      color: 'from-indigo-500 to-violet-500'
    }
  ];

  const stats = [
    { value: '10K+', label: 'Lives Saved', icon: Heart },
    { value: '500+', label: 'Ambulances', icon: Ambulance },
    { value: '50+', label: 'Hospitals', icon: Building2 },
    { value: '99.9%', label: 'Uptime', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/70 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <img 
                src="/favicon.ico" 
                alt="Resculance" 
                className="w-12 h-12 relative rounded-xl shadow-2xl transform group-hover:scale-110 transition-transform"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-red-200 to-white bg-clip-text text-transparent">
                Resculance
              </h1>
              <p className="text-xs text-gray-400">Emergency Care Platform</p>
            </div>
          </motion.div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                Login
              </Button>
            </Link>
            <a href="#contact">
              <Button size="sm" className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-lg shadow-red-500/50">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto relative z-10"
          >
            {/* Floating Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full mb-8 border border-red-500/30 backdrop-blur-xl shadow-lg shadow-red-500/20"
            >
              <Sparkles className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-sm font-bold bg-gradient-to-r from-red-300 to-rose-300 bg-clip-text text-transparent">
                Saving Lives, One Second at a Time
              </span>
              <Star className="w-4 h-4 text-rose-400 animate-pulse" />
            </motion.div>
            
            {/* Main Headline */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight"
            >
              <span className="text-white">Emergency Care,</span>
              <br />
              <span className="bg-gradient-to-r from-red-500 via-rose-500 to-red-500 bg-clip-text text-transparent animate-gradient">
                Redefined
              </span>
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed"
            >
              The next-generation emergency medical services platform connecting hospitals, ambulances, 
              and medical professionals for <span className="text-red-400 font-semibold">faster, smarter</span> emergency response.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <a href="#contact">
                <Button 
                  size="lg" 
                  className="text-lg px-10 py-6 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-2xl shadow-red-500/50 hover:shadow-red-500/70 transition-all transform hover:scale-105"
                >
                  Request Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
              <a href="#features">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-10 py-6 border-2 border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-xl text-white"
                >
                  Learn More
                </Button>
              </a>
            </motion.div>

            {/* Stats Grid - Glassmorphism Cards */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            >
              {stats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 + idx * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                    <div className="relative p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-red-500/50 transition-all">
                      <Icon className="w-8 h-8 text-red-400 mb-3 mx-auto" />
                      <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-400 font-medium">{stat.label}</div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>

        {/* Floating Favicon Elements */}
        <div className="absolute top-40 left-20 opacity-10 animate-float">
          <img src="/favicon.ico" alt="" className="w-24 h-24" />
        </div>
        <div className="absolute bottom-40 right-20 opacity-10 animate-float" style={{ animationDelay: '1s' }}>
          <img src="/favicon.ico" alt="" className="w-32 h-32" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <div className="inline-block px-4 py-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full mb-4 border border-red-500/30">
              <span className="text-sm font-bold text-red-400">Features</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              Powerful Features for
              <br />
              <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
                Critical Moments
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Every feature designed to save time, improve coordination, and ultimately save lives.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  whileHover={{ y: -10, scale: 1.02 }}
                  className="relative group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 rounded-3xl blur-xl transition-all duration-500`}></div>
                  <div className="relative p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 group-hover:border-white/20 transition-all duration-300 h-full">
                    <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-2xl transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-red-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-6 h-6 text-red-400" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="inline-block px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full mb-4 border border-blue-500/30">
              <span className="text-sm font-bold text-blue-400">Process</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              How Resculance Works
            </h2>
            <p className="text-xl text-gray-400">
              Streamlined emergency response in four simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-500 rounded-full opacity-30"></div>
            
            {[
              { step: '01', title: 'Emergency Call', desc: 'Patient onboarding and triage', icon: Phone, color: 'from-red-500 to-rose-500' },
              { step: '02', title: 'Dispatch', desc: 'Automatic ambulance assignment', icon: Zap, color: 'from-orange-500 to-amber-500' },
              { step: '03', title: 'Transit', desc: 'Real-time monitoring & updates', icon: Activity, color: 'from-blue-500 to-cyan-500' },
              { step: '04', title: 'Handoff', desc: 'Seamless hospital transfer', icon: CheckCircle, color: 'from-green-500 to-emerald-500' }
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  className="relative text-center group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-20 rounded-3xl blur-2xl transition-all duration-500`}></div>
                  
                  <div className="relative">
                    {/* Step Number Circle */}
                    <div className="relative mx-auto mb-6 w-24 h-24">
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-full blur-lg opacity-50 group-hover:opacity-100 transition-all duration-300`}></div>
                      <div className={`relative w-24 h-24 bg-gradient-to-br ${item.color} rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300`}>
                        <span className="text-white font-black text-2xl">{item.step}</span>
                      </div>
                      {/* Icon Badge */}
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white/20 shadow-lg">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    {/* Content Card */}
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 group-hover:border-white/30 transition-all">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="relative py-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJWMGgydjMwem0wIDMwaDJWMzBoLTJ2MzB6TTAgMzZ2LTJoMzB2MnpNNjAgMzZoLTMwdjJoMzB2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {/* Favicon Hero */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 100 }}
              className="relative inline-block mb-8"
            >
              <div className="absolute inset-0 bg-white rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
              <img 
                src="/favicon.ico" 
                alt="Resculance" 
                className="relative w-24 h-24 md:w-32 md:h-32 rounded-3xl shadow-2xl"
              />
            </motion.div>

            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              Ready to Transform
              <br />
              <span className="text-red-100">Emergency Care?</span>
            </h2>
            <p className="text-xl md:text-2xl text-red-100 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join leading hospitals and fleet operators using Resculance to save more lives every day.
            </p>
            
            {/* Contact Cards */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
              <motion.a
                href="tel:+15551234567"
                whileHover={{ scale: 1.05, y: -5 }}
                className="group"
              >
                <div className="flex items-center gap-4 px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Phone className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-red-100 font-medium">Call Us</div>
                    <div className="text-lg font-bold text-white">+1 (555) 123-4567</div>
                  </div>
                </div>
              </motion.a>
              
              <motion.a
                href="mailto:hello@resculance.com"
                whileHover={{ scale: 1.05, y: -5 }}
                className="group"
              >
                <div className="flex items-center gap-4 px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-red-100 font-medium">Email Us</div>
                    <div className="text-lg font-bold text-white">hello@resculance.com</div>
                  </div>
                </div>
              </motion.a>
            </div>

            <Link to="/login">
              <Button 
                size="lg" 
                className="bg-white text-red-600 hover:bg-red-50 border-0 text-lg px-10 py-6 shadow-2xl hover:shadow-white/50 transition-all transform hover:scale-105 font-bold"
              >
                Sign In to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <img 
                  src="/favicon.ico" 
                  alt="Resculance" 
                  className="relative w-12 h-12 rounded-xl shadow-2xl"
                />
              </div>
              <div>
                <div className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Resculance
                </div>
                <div className="text-sm text-gray-400">Emergency Care Platform</div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-center md:text-right"
            >
              <p className="text-gray-400 text-sm">
                © 2025 Resculance. All rights reserved.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Saving lives through technology and coordination
              </p>
            </motion.div>
          </div>
        </div>
      </footer>
    </div>
  );
};
