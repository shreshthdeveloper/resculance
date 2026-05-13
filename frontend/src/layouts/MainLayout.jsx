import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Users,
  Ambulance,
  UserSquare2,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Plus,
  RefreshCw,
  Wrench,
  ClipboardList,
  Moon,
  Sun,
  Shield,
} from 'lucide-react';
import useWithGlobalLoader from '../hooks/useWithGlobalLoader';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import socketService from '../services/socketService.js';
import { Loader } from '../components/ui';
import Tooltip from '../components/ui/Tooltip';
import { useToast, ToastProvider } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { formatRoleName } from '../utils/roleUtils';
import { getAllowedSidebarItems } from '../utils/permissions';
import notificationService from '../services/notificationService';
import logo from '../assets/logo.png';

const Sidebar = ({ isOpen, toggleSidebar, collapsed, toggleCollapse, isDesktop }) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  // All possible menu items
  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home', key: 'dashboard' },
    { path: '/organizations', icon: Building2, label: 'Organizations', key: 'organizations' },
    { path: '/users', icon: Users, label: 'Users', key: 'users' },
    { path: '/ambulances', icon: Ambulance, label: 'Ambulances', key: 'ambulances' },
    { path: '/patients', icon: UserSquare2, label: 'Patients', key: 'patients' },
    { path: '/onboarding', icon: Activity, label: 'Onboarding', key: 'onboarding' },
    { path: '/sessions', icon: ClipboardList, label: 'Sessions', key: 'sessions' },
    { path: '/collaborations', icon: Building2, label: 'Partnerships', key: 'collaborations' },
    { path: '/activity', icon: ClipboardList, label: 'Activity Logs', key: 'activity' },
    { path: '/permissions', icon: Shield, label: 'Permissions', key: 'permissions' },
  ];

  // Filter menu items based on user role permissions
  const allowedItems = getAllowedSidebarItems(user?.role || '');
  let menuItems = allMenuItems.filter(item => allowedItems.includes(item.key));
  
  // Filter by search query
  if (searchQuery.trim()) {
    menuItems = menuItems.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Small SidebarLink wrapper to provide anchorRef for the portal tooltip and handle collapsed layout
  const SidebarLink = ({ item }) => {
    const ref = useRef(null);
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <div ref={ref} className={`group ${collapsed ? 'px-0' : ''}`}>
        <Link
          to={item.path}
          onClick={() => !isDesktop && toggleSidebar()}
          aria-label={item.label}
          className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all duration-200 group ${
            isActive
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:bg-background hover:text-text'
          }`}
        >
          <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
          {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
        </Link>
        {collapsed && isDesktop && <Tooltip anchorRef={ref} label={item.label} />}
      </div>
    );
  };

  // ref for settings link tooltip when sidebar is collapsed
  const settingsRef = useRef(null);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-background-card shadow-xl z-30 transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-16' : 'w-64'}`}
      >
        <div className="flex flex-col h-full">{/* Logo */}
          <div className="flex items-center justify-between px-3 py-5 border-b border-border">
            <div
              onClick={() => { if (isDesktop) toggleCollapse(); }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                <img src={logo} alt="Resculance Logo" className="w-full h-full object-contain" />
              </div>
              {!collapsed && <span className="text-xl font-display font-bold tracking-tight text-text">Resculance</span>}
            </div>

              <div className="flex items-center gap-2">
                <button onClick={toggleSidebar} className="lg:hidden">
                  <X className="w-6 h-6 text-text" />
                </button>
              </div>
          </div>

          {/* Search (hidden when sidebar is collapsed) */}
          {!collapsed && (
            <div className="px-4 pb-6 pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <SidebarLink key={item.path} item={item} />
              ))}
            </div>
          </nav>

          {/* Bottom Section - Logout */}
          <div className="p-4 border-t border-border">
            <div className="group">
              <Link
                to="/settings"
                ref={settingsRef}
                aria-label="Settings"
                className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 text-text-secondary hover:bg-background hover:text-text rounded-xl transition-all duration-200`}
              >
                <Wrench className="w-5 h-5" />
                {!collapsed && <span className="text-sm font-medium">Settings</span>}
              </Link>
              {collapsed && isDesktop && <Tooltip anchorRef={settingsRef} label="Settings" />}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const Topbar = ({ toggleSidebar }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const { user, logout, token } = useAuthStore();
  const { isDark, toggleTheme } = useTheme();
  const runWithLoader = useWithGlobalLoader();
  const { toast } = useToast();

  // Fetch notifications on mount
  useEffect(() => {
    if (token && user) {
      fetchNotifications();
      fetchUnreadCount();

      // Listen for real-time notifications
      const handleNotification = (notification) => {
        console.log('New notification received:', notification);
        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        // Show toast for new notification
        toast.info(notification.title, 3000);
      };

      socketService.onNotification(handleNotification);

      // Show socket connection errors and successes in the UI so it's easy to diagnose real-time issues
      const handleSocketError = (err) => {
        console.error('Socket connect_error:', err);
        try { toast.error('Real-time connection error. Check server / token / CORS.', 5000); } catch(e) { /* ignore */ }
      };

      const handleSocketConnect = () => {
        try { toast.success('Real-time connected', 2000); } catch(e) { /* ignore */ }
      };

      socketService.on('connect_error', handleSocketError);
      socketService.on('connect', handleSocketConnect);

      return () => {
        socketService.offNotification(handleNotification);
        socketService.off('connect_error', handleSocketError);
        socketService.off('connect', handleSocketConnect);
      };
    }
  }, [token, user, toast]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationService.getNotifications(20);
      setNotifications(response.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationService.getUnreadCount();
      setUnreadCount(response.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications(prev => prev.map(n => 
          n.id === notification.id ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate based on notification type
    if (notification.data) {
      if (notification.data.sessionId) {
        navigate(`/onboarding/${notification.data.sessionId}`);
        setShowNotifications(false);
      } else if (notification.data.ambulanceId) {
        navigate('/ambulances');
        setShowNotifications(false);
      } else if (notification.data.collaborationId) {
        navigate('/collaborations');
        setShowNotifications(false);
      } else if (notification.data.userId) {
        navigate('/users');
        setShowNotifications(false);
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const quickActions = [
    { label: 'New User', path: '/users?create=true', icon: Users },
    { label: 'New Ambulance', path: '/ambulances?create=true', icon: Ambulance },
    { label: 'New Patient', path: '/patients?create=true', icon: UserSquare2 },
    { label: 'New Onboarding', path: '/onboarding', icon: Activity },
  ];

  // refs for click-outside handling
  const quickRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (quickRef.current && !quickRef.current.contains(e.target)) setShowQuickActions(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  // Handler for global cache reset: clears sessionStorage, notifies pages and waits for expected participants
  const handleGlobalReset = async () => {
    // clear sessionStorage caches (keep localStorage intact)
    try { sessionStorage.clear(); } catch (err) { console.warn('Failed to clear sessionStorage', err); }

    // Known pages we expect to refresh (add more as needed)
    const expected = ['dashboard', 'organizations', 'users', 'ambulances', 'patients', 'onboarding', 'collaborations'];

    return new Promise((resolve) => {
      const doneSet = new Set();
      let lastAt = Date.now();

      const onDone = (e) => {
        try {
          const page = e?.detail?.page || 'unknown';
          if (expected.includes(page)) doneSet.add(page);
          lastAt = Date.now();
        } catch (err) { lastAt = Date.now(); }
      };

      window.addEventListener('global:cache-reset-done', onDone);

      // Dispatch reset event
      window.dispatchEvent(new CustomEvent('global:cache-reset'));

      const interval = setInterval(() => {
        const age = Date.now() - lastAt;
        // If we've seen all expected pages report done, finish immediately
        if (expected.every(p => doneSet.has(p))) {
          clearInterval(interval);
          window.removeEventListener('global:cache-reset-done', onDone);
          resolve(Array.from(doneSet));
          return;
        }

        // If we have at least one done and some silence, finish (best-effort)
        if (doneSet.size > 0 && age > 700) {
          clearInterval(interval);
          window.removeEventListener('global:cache-reset-done', onDone);
          resolve(Array.from(doneSet));
          return;
        }

        // Safety timeout of 8s
        if (Date.now() - lastAt > 8000) {
          clearInterval(interval);
          window.removeEventListener('global:cache-reset-done', onDone);
          resolve(Array.from(doneSet));
        }
      }, 200);
    });
  };

  return (
    <header className="bg-background-card shadow-sm border-b border-border -mt-2 h-16 pt-[5px]">
      <div className="max-w-full mx-auto h-16 flex items-center justify-between px-4">
  <div className="flex items-center gap-3 h-full">
          {/* Left-most welcome compact text - hidden on the smallest screens */}
          <div className="hidden sm:flex flex-col mr-2 leading-tight">
            <span className="text-sm font-medium text-text">Welcome, {user?.firstName || 'User'}</span>
            <span className="text-xs text-text-secondary">{formatRoleName(user?.role)}</span>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden p-3 md:p-2 bg-background hover:bg-border rounded-xl transition-colors flex items-center justify-center h-10">
            <Menu className="w-5 h-5 text-text" />
          </button>
          {/* Placeholder for page title or breadcrumbs if needed */}
        </div>

        {/* Right side */}
  <div className="flex items-center gap-3 h-full">
          {/* Add Button */}
          <div className="relative" ref={quickRef}>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-3 md:p-2 bg-background hover:bg-border rounded-xl transition-colors flex items-center justify-center h-10"
                title="Quick Actions"
              >
                <Plus className="w-5 h-5 text-text-secondary" />
              </button>
                <button
                  onClick={() => {
                    // Run global reset with loader and show a toast summary when done
                    runWithLoader(async () => {
                      const done = await handleGlobalReset();
                      try {
                        if (done && done.length) {
                          toast.success(`Data refreshed: ${done.join(', ')}`, 4000);
                        } else {
                          toast.info('No scoped pages refreshed', 4000);
                        }
                      } catch (err) {
                        // swallow toast errors but log
                        console.warn('Toast failed after global reset', err);
                      }
                    }, 'Refreshing data...').catch(err => {
                      console.error(err);
                      try { toast.error('Refresh failed'); } catch (e) { /* ignore */ }
                    });
                  }}
                  className="p-3 md:p-2 bg-background hover:bg-border rounded-xl transition-colors flex items-center justify-center h-10"
                  title="Refresh data (reset caches)"
                >
                  <RefreshCw className="w-5 h-5 text-text-secondary" />
                </button>
            </div>

            {/* Quick Actions Dropdown */}
            {showQuickActions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-56 max-w-[90vw] bg-background-card rounded-2xl shadow-lg border border-border overflow-hidden z-50"
              >
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Quick Actions</p>
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.path}
                        to={action.path}
                        onClick={() => setShowQuickActions(false)}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-background rounded-xl transition-colors"
                      >
                        <Icon className="w-4 h-4 text-text-secondary" />
                        <span className="text-sm text-text">{action.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-3 md:p-2 bg-background hover:bg-border rounded-xl transition-colors flex items-center justify-center h-10"
            >
              <Bell className="w-5 h-5 text-text-secondary" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-56 md:w-72 max-w-[94vw] bg-background-card rounded-2xl shadow-lg border border-border overflow-hidden z-50"
              >
                <div className="p-3 md:p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                      <h3 className="text-sm md:text-base font-semibold text-text">Notifications</h3>
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-xs md:text-sm text-primary hover:text-primary-hover"
                      >
                        Mark all read
                      </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto nice-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-2 md:p-4 border-b border-border hover:bg-background cursor-pointer ${
                          !notif.is_read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notif.is_read && <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm md:text-base font-medium text-text truncate">{notif.title}</p>
                            <p className="text-xs md:text-sm text-text-secondary mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-text-secondary mt-1">
                              {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-text-secondary">
                      <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  )}
                </div>
                <div className="p-2 md:p-3 border-t border-border text-center">
                  <button
                    onClick={() => { navigate('/notifications'); setShowNotifications(false); }}
                    className="text-xs text-primary hover:text-primary-hover font-medium"
                  >
                    View all notifications
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 bg-background hover:bg-border rounded-xl transition-colors flex items-center justify-center h-10"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-warning" />
            ) : (
              <Moon className="w-5 h-5 text-text-secondary" />
            )}
          </button>

          {/* Profile */}
          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 p-2 md:p-1 hover:bg-background rounded-xl transition-colors h-10"
            >
                <img
                  src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=14b8a6&color=fff&bold=true`}
                  alt="Profile"
                  className="w-8 h-8 rounded-full ring-1 ring-border object-cover"
                  onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=14b8a6&color=fff&bold=true`; }}
                />
            </button>

            {/* Profile dropdown */}
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                // ensure the profile menu sits above other panels (sidebar, modals)
                className="absolute right-0 mt-2 w-56 bg-background-card rounded-2xl shadow-lg border border-border overflow-hidden z-50"
              >
                <div className="p-4 border-b border-border">
                  <p className="text-sm font-semibold text-text">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-text-secondary">{user?.email}</p>
                  <p className="text-xs text-primary mt-1">{formatRoleName(user?.role)}</p>
                </div>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <Settings className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm text-text">Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-error/10 transition-colors text-error border-t border-border"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { token } = useAuthStore();

  // Track desktop/mobile breakpoint to control collapse behaviour
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024);

  // Initialize socket connection when user is logged in
  useEffect(() => {
    if (token) {
      socketService.connect(token);
      console.log('Socket service initialized');
    }

    return () => {
      // Cleanup socket on unmount
      socketService.disconnect();
    };
  }, [token]);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored) setSidebarCollapsed(stored === 'true');
  }, []);

  // Update isDesktop on resize and force-expanding sidebar on mobile
  useEffect(() => {
    const onResize = () => {
      const nextIsDesktop = window.innerWidth >= 1024;
      setIsDesktop(nextIsDesktop);
      if (!nextIsDesktop) {
        // force expanded state on mobile to avoid collapsed icons off-canvas
        setSidebarCollapsed(false);
      }
    };

    window.addEventListener('resize', onResize);
    // initialize
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next.toString());
      return next;
    });
  };

  // Keyboard shortcut: Ctrl/Cmd + B toggles sidebar collapse
  useEffect(() => {
    const handler = (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for collapse-sidebar event from onboarding details page
  useEffect(() => {
    const handleCollapseSidebar = () => {
      setSidebarCollapsed(true);
      if (isDesktop) {
        localStorage.setItem('sidebarCollapsed', 'true');
      }
    };

    window.addEventListener('collapse-sidebar', handleCollapseSidebar);
    return () => window.removeEventListener('collapse-sidebar', handleCollapseSidebar);
  }, [isDesktop]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background transition-colors duration-200">
        <Loader />
          <div className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
          <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} collapsed={sidebarCollapsed} toggleCollapse={toggleCollapse} isDesktop={isDesktop} />
          <Topbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

          <main className="pt-1 px-4 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>

        {/* Global toast container (single instance) */}
        <MainToasts />
      </div>
    </ToastProvider>
  );
};

// Small component to render the ToastContainer by consuming the provider
const MainToasts = () => {
  const { toasts, removeToast } = useToast();
  return <ToastContainer toasts={toasts} removeToast={removeToast} />;
};
