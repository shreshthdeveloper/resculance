import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Search,
  Filter,
  Calendar,
  Eye,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Ambulance as AmbulanceIcon,
  User,
  MapPin
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { sessionService, organizationService } from '../../services';
import Select from '../../components/ui/Select';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';
import socketService from '../../services/socketService';

export default function Sessions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const runWithLoader = useWithGlobalLoader();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [orgTypeFilter, setOrgTypeFilter] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedOrgInfo, setSelectedOrgInfo] = useState(null);
  const [orgSearchInput, setOrgSearchInput] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 20 });

  useEffect(() => {
    // Only fetch when not superadmin or when superadmin has selected an organization
    if (user?.role === 'superadmin') {
      if (selectedOrgId) {
        fetchSessions();
        fetchStats();
      } else {
        // Clear data when no org selected to avoid accidental leaks
        setSessions([]);
        setStats(null);
      }
    } else {
      fetchSessions();
      fetchStats();
    }
  }, [page, statusFilter, startDate, endDate, selectedOrgId]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchSessions();
      } else {
        setPage(1); // Reset to page 1 on search
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    // load organizations for superadmin org selector
    const loadOrgs = async () => {
      try {
        const resp = await organizationService.getAll();
        const orgs = resp.data?.data?.organizations || resp.data?.organizations || resp.data || [];
        setOrganizations(orgs);
      } catch (err) {
        console.error('Failed to load organizations', err);
      }
    };
    if (user?.role === 'superadmin') loadOrgs();
  }, [user?.role]);

  // Socket listener for real-time session updates
  useEffect(() => {
    // Listen for patient_onboarded event to refresh sessions list
    const handlePatientOnboarded = (data) => {
      console.log('Patient onboarded event received:', data);
      // Refresh sessions list to show the new session
      fetchSessions();
      fetchStats();
    };

    socketService.on('patient_onboarded', handlePatientOnboarded);

    // Cleanup
    return () => {
      socketService.off('patient_onboarded', handlePatientOnboarded);
    };
  }, [user, selectedOrgId, page, statusFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    if (selectedOrgId) {
      const org = organizations.find(o => String(o.id) === String(selectedOrgId));
      setSelectedOrgInfo(org || null);
    } else {
      setSelectedOrgInfo(null);
    }
  }, [selectedOrgId, organizations]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      // Prevent superadmin from fetching without selecting an organization
      if (user?.role === 'superadmin' && !selectedOrgId) {
        setSessions([]);
        setPagination({ total: 0, totalPages: 0, limit: 20 });
        setLoading(false);
        return;
      }

      if (user?.role === 'superadmin' && selectedOrgId) {
        params.organizationId = selectedOrgId;
      }

      const response = await sessionService.getAll(params);
      const data = response.data?.data || {};
      setSessions(data.sessions || []);
      setPagination(data.pagination || { total: 0, totalPages: 0, limit: 20 });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Prevent superadmin from fetching global stats without selecting an organization
      if (user?.role === 'superadmin' && !selectedOrgId) {
        setStats(null);
        return;
      }

      const params = {};
      if (user?.role === 'superadmin' && selectedOrgId) params.organizationId = selectedOrgId;
      const response = await sessionService.getStats(params);
      setStats(response.data?.data?.stats || null);
    } catch (error) {
      console.error('Failed to fetch session stats:', error);
    }
  };

  const handleViewSession = (session) => {
    navigate(`/sessions/${session.id}`);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      onboarded: { color: 'bg-blue-100 text-blue-800', icon: Activity, label: 'Onboarded' },
      in_transit: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'In Transit' },
      offboarded: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Offboarded' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
    };
    const config = statusConfig[status?.toLowerCase()] || statusConfig.onboarded;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const formatDuration = (onboardedAt, offboardedAt) => {
    if (!onboardedAt) return 'N/A';
    const start = new Date(onboardedAt);
    const end = offboardedAt ? new Date(offboardedAt) : new Date();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const columns = [
    {
      header: 'Session Code',
      accessor: 'session_code',
      render: (row) => (
        <div className="font-mono text-sm font-semibold text-primary">{row.session_code}</div>
      ),
    },
    {
      header: 'Patient',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-sm">
              {row.patient_first_name} {row.patient_last_name}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Ambulance',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <AmbulanceIcon className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="font-medium text-sm">{row.ambulance_code || row.registration_number}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      header: 'Destination',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-secondary">
          <MapPin className="w-3.5 h-3.5" />
          <span>{row.destination_hospital_name || 'N/A'}</span>
        </div>
      ),
    },
    {
      header: 'Duration',
      render: (row) => (
        <div className="text-sm text-secondary">
          {formatDuration(row.onboarded_at, row.offboarded_at)}
        </div>
      ),
    },
    {
      header: 'Onboarded',
      render: (row) => (
        <div className="text-sm text-secondary">
          {new Date(row.onboarded_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => handleViewSession(row)}>
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mt-5 mb-2">Session History</h1>
          <p className="text-secondary">View and audit all patient transport sessions</p>
        </div>
      </div>
      {/* Superadmin org selector panel */}
      {user?.role === 'superadmin' && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-text mb-0">Organization Type</label>
              <Select
                isClearable
                value={orgTypeFilter ? { value: orgTypeFilter, label: orgTypeFilter === 'hospital' ? 'Hospital' : 'Fleet Owner' } : null}
                onChange={(opt) => { const v = opt?.value || ''; setOrgTypeFilter(v); setSelectedOrgId(null); setOrgSearchInput(''); }}
                options={[{ value: '', label: 'All Types' }, { value: 'hospital', label: 'Hospital' }, { value: 'fleet_owner', label: 'Fleet Owner' }]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text mb-0">Select Organization</label>
              <div title={!orgTypeFilter ? 'Please select an Organization Type first' : ''}>
                <Select
                  isDisabled={!orgTypeFilter}
                  placeholder={orgTypeFilter ? 'Type to search or pick an organization' : 'Select an organization type first'}
                  options={organizations.filter(o => (!orgTypeFilter || o.type === orgTypeFilter)).map(o => ({ value: o.id, label: `${o.name} (${o.code})` }))}
                  value={selectedOrgId ? { value: selectedOrgId, label: `${selectedOrgInfo?.name || ''} (${selectedOrgInfo?.code || ''})` } : null}
                  onChange={(opt) => {
                    if (opt) {
                      setSelectedOrgId(opt.value);
                      setOrgSearchInput(opt.label);
                    } else {
                      setSelectedOrgId(null);
                      setOrgSearchInput('');
                    }
                  }}
                  classNamePrefix="react-select"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <div className="text-right">
                {selectedOrgInfo ? (
                  <>
                    <p className="font-semibold">{selectedOrgInfo.name} <span className="text-sm text-secondary">({selectedOrgInfo.code})</span></p>
                    <p className="text-sm text-secondary">Type: {selectedOrgInfo.type}</p>
                    <div>
                      <button onClick={() => { setSelectedOrgId(null); setOrgTypeFilter(''); setOrgSearchInput(''); }} className="text-sm text-primary underline">Clear selection</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-secondary">Select an organization to load sessions for that organization.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary mb-1">Total Sessions</p>
                  <p className="text-2xl font-bold">{stats.total_sessions || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary mb-1">Onboarded</p>
                  <p className="text-2xl font-bold">{stats.onboarded || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary mb-1">In Transit</p>
                  <p className="text-2xl font-bold">{stats.in_transit || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary mb-1">Completed</p>
                  <p className="text-2xl font-bold">{stats.offboarded || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary mb-1">Avg Duration</p>
                  <p className="text-2xl font-bold">
                    {stats.avg_duration_minutes 
                      ? `${Math.round(stats.avg_duration_minutes)}m` 
                      : 'N/A'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-12 w-full"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Statuses</option>
            <option value="onboarded">Onboarded</option>
            <option value="in_transit">In Transit</option>
            <option value="offboarded">Offboarded</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input pl-12 w-full"
              placeholder="Start Date"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input pl-12 w-full"
              placeholder="End Date"
            />
          </div>
        </div>
      </Card>

      {/* Sessions Table */}
      {loading ? (
        <Card className="p-8 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-secondary">Loading sessions...</p>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-secondary opacity-50" />
          <p className="text-secondary">No sessions found</p>
        </Card>
      ) : (
        <>
          <Table columns={columns} data={sessions} />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-secondary">
                  Showing {sessions.length} of {pagination.total} sessions
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
