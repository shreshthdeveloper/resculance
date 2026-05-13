import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Ambulance, 
  Users, 
  Activity, 
  TrendingUp, 
  ArrowRight,
  Clock,
  MapPin,
  Heart,
  AlertCircle,
  CheckCircle,
  Truck
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { dashboardService, activityService } from '../../services';
import { useToast } from '../../hooks/useToast';
import getErrorMessage from '../../utils/getErrorMessage';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';

// Return a Tailwind text color class for stat icons (icon-only coloring)
const getStatColor = (title) => {
  const key = (title || '').toString().toLowerCase();
  if (key.includes('organization')) return 'text-primary';
  if (key.includes('hospital')) return 'text-success';
  if (key.includes('fleet')) return 'text-purple-500';
  if (key.includes('user')) return 'text-indigo-500';
  if (key.includes('ambulance')) return 'text-rose-500';
  if (key.includes('patient')) return 'text-pink-500';
  if (key.includes('collaboration')) return 'text-yellow-500';
  return 'text-gray-700 dark:text-gray-300';
};

const QuickStatItem = ({ title, value, icon: Icon, to }) => {
  const content = (
    <div className="mb-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className={`w-5 h-5 ${getStatColor(title)}`} />
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-xs font-medium">{title}</p>
          <h3 className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{value}</h3>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </div>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return <div>{content}</div>;
};

export const Dashboard = () => {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const runWithLoader = useWithGlobalLoader();

  const timeAgo = (iso) => {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min${mins>1?'s':''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours>1?'s':''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days>1?'s':''} ago`;
  };

  const getIconForActivity = (activity) => {
    if (!activity) return Building2;
    const key = String(activity).toLowerCase();
    if (key.includes('ambulance') || key.includes('dispatch')) return Ambulance;
    if (key.includes('user') || key.includes('register') || key.includes('invite')) return Users;
    if (key.includes('patient') || key.includes('onboard')) return Heart;
    if (key.includes('collaboration') || key.includes('approve') || key.includes('link')) return Building2;
    return MapPin;
  };

  // Return a Tailwind text color class for activity icons (icon-only coloring)
  const getActivityColor = (activity) => {
    const key = (activity || '').toString().toLowerCase();
    if (key.includes('ambulance') || key.includes('dispatch')) return 'text-rose-500';
    if (key.includes('user') || key.includes('register') || key.includes('invite')) return 'text-indigo-500';
    if (key.includes('patient') || key.includes('onboard')) return 'text-pink-500';
    if (key.includes('collaboration') || key.includes('approve') || key.includes('link')) return 'text-yellow-500';
    if (key.includes('organization') || key.includes('hospital') || key.includes('fleet')) return 'text-primary';
    return 'text-gray-500 dark:text-gray-300';
  };

  useEffect(() => {
    fetchStats();
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    setLoadingActivities(true);
    try {
      const resp = await activityService.getAll({ page: 1, limit: 6 });
      const acts = resp.data?.activities || [];
      setRecentActivities(acts);
    } catch (err) {
      console.error('Failed to load recent activities', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Global cache reset handler
  useEffect(() => {
    const handler = async () => {
      try {
        await fetchStats();
      } catch (err) {
        console.error('Global reset handler failed for dashboard', err);
      } finally {
        window.dispatchEvent(new CustomEvent('global:cache-reset-done', { detail: { page: 'dashboard' } }));
      }
    };
    window.addEventListener('global:cache-reset', handler);
    return () => window.removeEventListener('global:cache-reset', handler);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      await runWithLoader(async () => {
        const response = await dashboardService.getStats();
        if (response.data?.success) {
          setStats(response.data.data);
        }
      }, 'Loading dashboard...');
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      const msg = getErrorMessage(error, 'Failed to load dashboard statistics');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-display font-bold text-text">
          Welcome back, {user?.firstName}! 👋
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Here's your command center for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
        {/* Left Sidebar - Slim Quick Stats */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
          >
            <Card className="h-full p-4 space-y-0 overflow-y-auto">
            <div className="pb-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Quick Stats</h2>
            </div>

            <div className="pt-3">
            {
              (() => {
                const roleKey = (user?.role || '').toString().toLowerCase();
                const orgType = (user?.organizationType || '').toString().toLowerCase();

                const isHospitalOrFleetAdmin = (orgType === 'hospital' || orgType === 'fleet_owner') && roleKey.includes('admin');
                const isStaff = ['doctor', 'paramedic', 'staff', 'driver', 'nurse'].some(k => roleKey.includes(k));

                const nodes = [];

                // Organizations / Hospitals / Fleets: hide for hospital/fleet admins and staff
                if (!isHospitalOrFleetAdmin && !isStaff) {
                  nodes.push(
                    <QuickStatItem
                      key="orgs"
                      title="Organizations"
                      value={loading ? '...' : stats.totalOrganizations || 0}
                      icon={Building2}
                      to="/organizations"
                    />
                  );

                  nodes.push(
                    <QuickStatItem
                      key="hospitals"
                      title="Hospitals"
                      value={loading ? '...' : stats.totalHospitals || 0}
                      icon={Building2}
                      to="/organizations"
                    />
                  );

                  nodes.push(
                    <QuickStatItem
                      key="fleets"
                      title="Fleets"
                      value={loading ? '...' : stats.totalFleets || 0}
                      icon={Truck}
                      to="/organizations"
                    />
                  );
                }

                // Users: hide for staff roles, visible for others (including superadmin and non-org admins)
                if (!isStaff) {
                  nodes.push(
                    <QuickStatItem
                      key="users"
                      title="Users"
                      value={loading ? '...' : stats.totalUsers || 0}
                      icon={Users}
                      to="/users"
                    />
                  );
                }

                return nodes;
              })()
            }

            <QuickStatItem
              title="Ambulances"
              value={loading ? '...' : stats.totalAmbulances || 0}
              icon={Ambulance}
              to="/ambulances"
            />

            <QuickStatItem
              title="Patients"
              value={loading ? '...' : stats.totalPatients || 0}
              icon={Heart}
              to="/patients"
            />

            {
              // Collaborations: hide for staff roles
              (() => {
                const roleKey = (user?.role || '').toString().toLowerCase();
                const isStaff = ['doctor', 'paramedic', 'staff', 'driver', 'nurse'].some(k => roleKey.includes(k));
                if (!isStaff) {
                  return (
                    <QuickStatItem
                      title="Collaborations"
                      value={loading ? '...' : stats.totalCollaborations || 0}
                      icon={Activity}
                      to="/collaborations"
                    />
                  );
                }
                return null;
              })()
            }
            </div>
          </Card>
        </motion.div>

        {/* Main Content Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 space-y-6 overflow-y-auto pr-2"
        >
          {/* Active Operations - Highlight */}
          <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  Active Operations
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Real-time emergency response status</p>
              </div>
              <Link 
                to="/sessions" 
                className="px-4 py-2 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Active Trips</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-gray-900 dark:text-gray-100">{loading ? '...' : stats.activeTrips || 0}</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">live now</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Available Units</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-gray-900 dark:text-gray-100">{loading ? '...' : stats.totalAmbulances || 0}</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">ready</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Response Rate</span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-gray-900 dark:text-gray-100">98%</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">avg</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  Recent Activity
                </h3>
                <Link to="/activities" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium">View all</Link>
              </div>
              <div className="space-y-3">
                {loadingActivities ? (
                  <div className="space-y-2">
                    {[1,2,3].map((n) => (
                      <div key={n} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 dark:bg-gray-800/40 animate-pulse">
                        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 min-w-0">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  (recentActivities.length > 0) ? (
                    recentActivities.map((act) => {
                      const Icon = getIconForActivity(act.activity);
                      return (
                        <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-background dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                          <div className={`w-10 h-10 rounded-lg bg-background-2 dark:bg-gray-800 flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${getActivityColor(act.activity)}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text">{act.activity || act.comments || 'Activity'}</p>
                            <p className="text-xs text-text-secondary truncate">{act.comments || (act.metadata && JSON.stringify(act.metadata)) || act.organization_name || ''}</p>
                            <p className="text-xs text-text-secondary mt-1">{timeAgo(act.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-text-secondary">No recent activity.</div>
                  )
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  Quick Actions
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Link 
                  to="/onboarding" 
                  className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">Start Emergency Session</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Onboard patient & dispatch</p>
                    </div>
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    to="/patients?create=true" 
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 flex flex-col items-start"
                  >
                    <Heart className={`w-8 h-8 mb-2 ${getStatColor('patient')}`} />
                    <p className="font-semibold text-sm">Add Patient</p>
                  </Link>

                  <Link 
                    to="/ambulances?create=true" 
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 flex flex-col items-start"
                  >
                    <Ambulance className={`w-8 h-8 mb-2 ${getStatColor('ambulance')}`} />
                    <p className="font-semibold text-sm">Add Ambulance</p>
                  </Link>

                  <Link 
                    to="/users?create=true" 
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 flex flex-col items-start"
                  >
                    <Users className={`w-8 h-8 mb-2 ${getStatColor('user')}`} />
                    <p className="font-semibold text-sm">Invite User</p>
                  </Link>

                  <Link 
                    to="/collaborations?create=true" 
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 flex flex-col items-start"
                  >
                    <Building2 className={`w-8 h-8 mb-2 ${getStatColor('collaboration')}`} />
                    <p className="font-semibold text-sm">New Collaboration</p>
                  </Link>
                </div>
              </div>
            </Card>
          </div>

          {/* System Health */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                System Health
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'API Status', value: 'Operational', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Database', value: 'Healthy', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Socket.IO', value: 'Connected', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Uptime', value: '99.9%', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800' },
              ].map((item, idx) => (
                <div key={idx} className={`${item.bg} rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700`}>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
