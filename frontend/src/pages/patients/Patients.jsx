import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import Select from '../../components/ui/Select';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  UserSquare2,
  Plus,
  Edit,
  Trash2,
  Search,
  Activity,
  Heart,
  AlertCircle,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Ambulance as AmbulanceIcon,
  MapPin,
  Phone,
  Mail,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { patientService, organizationService } from '../../services';
import { Tabs } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import getErrorMessage from '../../utils/getErrorMessage';

const patientSchema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().nullable(),
  // Age is an optional numeric field (years). allow empty => null
  age: yup.number().transform((value, originalValue) => (originalValue === '' ? null : value)).nullable().min(0).max(150),
  gender: yup.string().nullable(),
  bloodGroup: yup.string().nullable(),
  phone: yup.string().nullable(),
  email: yup.string().email('Invalid email').nullable(),
  address: yup.string().nullable(),
  emergencyContactName: yup.string().nullable(),
  emergencyContactPhone: yup.string().nullable(),
  emergencyContactRelation: yup.string().nullable(),
});

export const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [selectedTab, setSelectedTab] = useState('new');
  const [activePatientIds, setActivePatientIds] = useState(new Set());
  const [offboardedPatientIds, setOffboardedPatientIds] = useState(new Set());
  const [patientsCache, setPatientsCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [orgTypeFilter, setOrgTypeFilter] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedOrgInfo, setSelectedOrgInfo] = useState(null);
  // Separate state for modal organization selection
  const [modalOrgTypeFilter, setModalOrgTypeFilter] = useState('');
  const [modalSelectedOrgId, setModalSelectedOrgId] = useState(null);
  const [modalSelectedOrgInfo, setModalSelectedOrgInfo] = useState(null);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const runWithLoader = useWithGlobalLoader();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open create modal if coming from quick actions
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowModal(true);
      // Remove the param from URL
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(patientSchema),
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    // Only fetch patients when scope (selectedOrgId/user) changes. Do NOT refetch on every tab change.
    const doFetch = async () => {
      // clear current patients while loading to avoid stale data
      setPatients([]);
      await runWithLoader(async () => {
        if (user?.role === 'superadmin') {
          if (selectedOrgId) {
            await fetchPatients();
          }
        } else {
          await fetchPatients();
        }
      }, 'Loading patients...');
    };

    doFetch().catch((err) => {
      // error already handled in fetchPatients but ensure loader hidden
      console.error('Error fetching patients with loader', err);
    });
  }, [selectedOrgId, user]);

  // When user switches to inactive tab, fetch inclusive dataset if not cached
  useEffect(() => {
    if (selectedTab === 'inactive') {
      const scopeKey = user?.role === 'superadmin' ? `org:${selectedOrgId || 'none'}` : `org:${user?.organizationId || 'own'}`;
      const cached = patientsCache[scopeKey] || {};
      if (!cached.all) {
        runWithLoader(async () => {
          await fetchPatients(false, true);
        }, 'Loading inactive patients...').catch(err => console.error(err));
      } else {
        // ensure UI shows cached all
        setPatients(cached.all);
      }
    }
  }, [selectedTab, selectedOrgId, user]);

  const fetchOrganizations = async () => {
    try {
      const resp = await organizationService.getAll();
      const raw = resp.data?.data?.organizations || resp.data?.organizations || resp.data || [];
      setOrganizations(raw);
    } catch (err) {
      console.error('Failed to load organizations', err);
    }
  };

  // Global cache reset handler
  useEffect(() => {
    const handler = async () => {
      try {
        // No persistent cache used here, just force refetch
        await fetchPatients();
      } catch (err) {
        console.error('Global reset handler failed for patients', err);
      } finally {
        window.dispatchEvent(new CustomEvent('global:cache-reset-done', { detail: { page: 'patients' } }));
      }
    };
    window.addEventListener('global:cache-reset', handler);
    return () => window.removeEventListener('global:cache-reset', handler);
  }, []);

  const fetchPatients = async (force = false, includeInactive = false) => {
    try {
      setLoading(true);

      const scopeKey = user?.role === 'superadmin' ? `org:${selectedOrgId || 'none'}` : `org:${user?.organizationId || 'own'}`;
      const cached = patientsCache[scopeKey] || {};

      // If not forcing and we have cached data use it
      if (!force) {
        if (includeInactive && cached.all) {
          setPatients(cached.all);
          computeSessionSetsFromPatients(cached.all);
          setLoading(false);
          return;
        }
        if (!includeInactive && cached.active) {
          setPatients(cached.active);
          computeSessionSetsFromPatients(cached.active);
          setLoading(false);
          return;
        }
      }

      const params = {};
      if (user?.role === 'superadmin' && selectedOrgId) params.organizationId = selectedOrgId;
      if (includeInactive) params.includeInactive = true;

      const response = await patientService.getAll(params);
      const fetched = response.data?.data?.patients || response.data?.patients || response.data || [];

      setPatientsCache(prev => {
        const next = { ...prev };
        next[scopeKey] = next[scopeKey] || {};
        if (includeInactive) {
          next[scopeKey].all = fetched;
    next[scopeKey].active = fetched.filter(p => !(Number(p.is_active) === 0 || Number(p.isActive) === 0));
        } else {
          next[scopeKey].active = fetched;
        }
        next[scopeKey].ts = Date.now();
        return next;
      });

      setPatients(fetched);
      computeSessionSetsFromPatients(fetched);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      const msg = getErrorMessage(error, 'Failed to load patients');
      toast.error(msg);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const computeSessionSetsFromPatients = (fetched) => {
    try {
      const activeSet = new Set();
      const offSet = new Set();
      fetched.forEach(p => {
        const status = (p.latestSessionStatus || '').toLowerCase();
        if (['active', 'onboarded', 'in_transit'].includes(status)) activeSet.add(p.id);
        if (status === 'offboarded') offSet.add(p.id);
      });
      setActivePatientIds(activeSet);
      setOffboardedPatientIds(offSet);
    } catch (e) {
      setActivePatientIds(new Set());
      setOffboardedPatientIds(new Set());
    }
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


  const fetchSessions = async (patientId) => {
    try {
      const response = await patientService.getSessions(patientId);
      // Backend returns sessions array directly or nested in .data
      const sessionsData = response.data?.data?.sessions || response.data?.sessions || response.data || [];
      // Some endpoints return an object or an error; guard against non-array
      setSessions(Array.isArray(sessionsData) ? sessionsData : (Array.isArray(response.data?.data) ? response.data.data : []));
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
  const msg = getErrorMessage(error, 'Failed to load sessions');
      toast.error(msg);
      setSessions([]);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      
      // Only handle organization assignment when creating a new patient
      if (!editingPatient) {
        // Ensure an organization is associated with the patient
        if (user?.role === 'superadmin') {
          // prefer organization selected in the modal, or fallback to data.organizationId
          data.organizationId = data.organizationId || modalSelectedOrgId || null;
          if (!data.organizationId) {
            toast.error('Please select an Organization for this patient');
            setLoading(false);
            return;
          }
        } else {
          // non-superadmins: backend will attach req.user.organizationId, but include for clarity
          data.organizationId = user?.organizationId || data.organizationId || null;
        }
      }

  // Ensure empty age is sent as null
  if (data.age === '') data.age = null;

      if (editingPatient) {
        await patientService.update(editingPatient.id, data);
        toast.success('Patient updated successfully');
      } else {
        await patientService.create(data);
        toast.success('Patient created successfully');
      }
      await fetchPatients(true);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save patient:', error);
  const msg = getErrorMessage(error, editingPatient ? 'Failed to update patient' : 'Failed to create patient');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (patient) => {
    setEditingPatient(patient);
    // Pre-fill organization selection if present
    reset(patient);
    const orgId = patient.organization_id || patient.organizationId || null;
    setModalSelectedOrgId(orgId);
    if (orgId) {
      const info = organizations.find(o => String(o.id) === String(orgId));
      setModalSelectedOrgInfo(info || null);
      setModalOrgTypeFilter(info?.type || '');
    } else {
      setModalSelectedOrgInfo(null);
      setModalOrgTypeFilter('');
    }
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this patient?')) {
      try {
        await patientService.delete(id);
        toast.success('Patient deactivated successfully');
        await fetchPatients(true);
      } catch (error) {
        console.error('Failed to deactivate patient:', error);
  const msg = getErrorMessage(error, 'Failed to deactivate patient');
        toast.error(msg);
      }
    }
  };

  const handleActivate = async (id) => {
    if (window.confirm('Are you sure you want to activate this patient?')) {
      try {
        await patientService.activate(id);
        toast.success('Patient activated successfully');
        await fetchPatients();
      } catch (error) {
        console.error('Failed to activate patient:', error);
  const msg = getErrorMessage(error, 'Failed to activate patient');
        toast.error(msg);
      }
    }
  };

  const handleViewDetails = async (patient) => {
    setSelectedPatient(patient);
    await fetchSessions(patient.id);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPatient(null);
    reset();
    setModalSelectedOrgId(null);
    setModalSelectedOrgInfo(null);
    setModalOrgTypeFilter('');
  };

  const filteredPatients = patients.filter((patient) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      patient.firstName?.toLowerCase().includes(searchLower) ||
      patient.lastName?.toLowerCase().includes(searchLower) ||
      patient.phone?.includes(searchQuery) ||
      patient.email?.toLowerCase().includes(searchLower)
    );
  });

  // Tab filtering
  const tabFilteredPatients = (() => {
    // Rules:
    // - new: patients that haven't onboarded yet (no sessions / no latestSessionStatus)
    // - onboarded: patients currently onboarded (statuses like active, onboarded, in_transit)
    // - offboarded: patients whose latest session status is offboarded
    // - inactive: patients with is_active === false

    if (selectedTab === 'new') {
      return filteredPatients.filter(p => !p.latestSessionStatus);
    }

    if (selectedTab === 'onboarded') {
      return filteredPatients.filter(p => {
        const status = (p.latestSessionStatus || '').toLowerCase();
        return ['active', 'onboarded', 'in_transit'].includes(status);
      });
    }

    if (selectedTab === 'offboarded') {
      return filteredPatients.filter(p => {
        const status = (p.latestSessionStatus || '').toLowerCase();
        // Exclude patients that are inactive (is_active stored as numeric 0/1 or camelCase variants)
        const isInactive = Number(p.is_active) === 0 || Number(p.isActive) === 0;
        return status === 'offboarded' && !isInactive;
      });
    }

    if (selectedTab === 'inactive') {
      return filteredPatients.filter(p => Number(p.is_active) === 0 || Number(p.isActive) === 0);
    }

    return filteredPatients;
  })();

  const columns = [
    {
      header: 'Patient Name',
      accessor: 'name',
      render: (patient) => (
        <div>
          <div className="font-medium">
            {patient.firstName || patient.first_name} {patient.lastName || patient.last_name}
          </div>
          <div className="text-sm text-secondary">{patient.email || patient.contact_phone || ''}</div>
        </div>
      ),
    },
    {
      header: 'Age/Gender',
      accessor: 'age',
      render: (patient) => {
        const age = patient.age || 'N/A';
        return `${age} / ${patient.gender || 'N/A'}`;
      },
    },
    {
      header: 'Blood Group',
      accessor: 'bloodGroup',
      render: (patient) => (
        <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium">
          {patient.bloodGroup || patient.blood_group || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Phone',
      accessor: 'phone',
      render: (patient) => patient.phone || patient.contact_phone || 'N/A',
    },
    {
      header: 'Emergency Contact',
      accessor: 'emergency',
      render: (patient) => (
        <div>
          <div className="font-medium text-sm">
            {patient.emergencyContactName || patient.emergency_contact_name || 'N/A'}
          </div>
          <div className="text-xs text-secondary">
            {patient.emergencyContactPhone || patient.emergency_contact_phone || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (patient) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewDetails(patient)}
          >
            <Activity className="w-4 h-4 mr-1" />
            Details
          </Button>
          {(user?.role === 'superadmin' || /doctor|paramedic|admin/.test(String(user?.role || '').toLowerCase())) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(patient)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          )}
          {!(Number(patient.is_active) === 0 || Number(patient.isActive) === 0) ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(patient.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              onClick={() => handleActivate(patient.id)}
            >
              Activate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mt-5 mb-2">Patients Management</h1>
          <p className="text-secondary">Manage patient records and medical history</p>
        </div>
        {hasPermission(user?.role, PERMISSIONS.CREATE_PATIENT) && (
        <Button onClick={() => {
          // prepare modal for create
          reset();
          setEditingPatient(null);
          if (user?.role !== 'superadmin') {
            setModalSelectedOrgId(user?.organizationId || null);
            const info = organizations.find(o => String(o.id) === String(user?.organizationId));
            setModalSelectedOrgInfo(info || null);
          } else {
            setModalSelectedOrgId(null);
            setModalSelectedOrgInfo(null);
            setModalOrgTypeFilter('');
          }
          setShowModal(true);
        }}>
          <Plus className="w-5 h-5 mr-2" />
          Add Patient
        </Button>
        )}
      </div>

      {/* Organization Filters (Superadmin only) */}
      {user?.role === 'superadmin' && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Organization Type</label>
              <Select
                isClearable
                value={orgTypeFilter ? { value: orgTypeFilter, label: orgTypeFilter === 'hospital' ? 'Hospital' : 'Fleet Owner' } : null}
                onChange={(opt) => {
                  const v = opt?.value || '';
                  setOrgTypeFilter(v);
                  setSelectedOrgId(null);
                  setSelectedOrgInfo(null);
                }}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'hospital', label: 'Hospital' },
                  { value: 'fleet_owner', label: 'Fleet Owner' }
                ]}
                placeholder="Select organization type"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Organization</label>
              <Select
                isDisabled={!orgTypeFilter}
                isClearable
                placeholder={orgTypeFilter ? 'Select an organization' : 'Select a type first'}
                options={organizations
                  .filter(o => !orgTypeFilter || o.type === orgTypeFilter)
                  .map(o => ({ value: o.id, label: `${o.name} (${o.code})` }))}
                value={selectedOrgId ? {
                  value: selectedOrgId,
                  label: `${selectedOrgInfo?.name || ''} (${selectedOrgInfo?.code || ''})`
                } : null}
                onChange={(opt) => {
                  if (opt) {
                    setSelectedOrgId(opt.value);
                    const info = organizations.find(o => o.id === opt.value) || null;
                    setSelectedOrgInfo(info);
                  } else {
                    setSelectedOrgId(null);
                    setSelectedOrgInfo(null);
                  }
                }}
                classNamePrefix="react-select"
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <UserSquare2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-secondary">Total Patients</p>
              <p className="text-2xl font-bold">{patients.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-2xl">
              <Activity className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-secondary">Active Sessions</p>
              <p className="text-2xl font-bold">
                {Array.isArray(sessions) ? sessions.filter(s => s.status === 'active').length : 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-2xl">
              <Heart className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-secondary">Critical Cases</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-secondary">Pending Reviews</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Show message if superadmin hasn't selected org yet */}
      {user?.role === 'superadmin' && !selectedOrgId && (
        <Card className="p-8 text-center">
          <UserSquare2 className="w-12 h-12 text-secondary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select an Organization</h3>
          <p className="text-secondary">
            Please select an organization type and organization above to view patients.
          </p>
        </Card>
      )}

      {/* Tabs + Search */}
      {(user?.role !== 'superadmin' || selectedOrgId) && (
        <Card className="p-3 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Tabs
                tabs={[
                  { key: 'new', label: 'New' },
                  { key: 'onboarded', label: 'Onboarded' },
                  { key: 'offboarded', label: 'Offboarded' },
                  { key: 'inactive', label: 'Inactive' }
                ]}
                activeKey={selectedTab}
                onChange={(k) => setSelectedTab(k)}
              />
            </div>

            <div className="w-full md:w-1/3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                  type="text"
                  placeholder="Search patients by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input w-full pl-10 pr-4 py-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-secondary"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Patients Table */}
      {(user?.role !== 'superadmin' || selectedOrgId) && (
        <Card>
          <div className="p-6">
            <Table
              columns={columns}
              data={tabFilteredPatients}
              loading={loading}
              onRowClick={handleViewDetails}
              onRefresh={() => fetchPatients(true, selectedTab === 'inactive')}
              isRefreshing={loading}
            />
          </div>
        </Card>
      )}

      {/* Add/Edit Patient Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingPatient ? 'Edit Patient' : 'Add New Patient'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Organization selectors: only shown for superadmin when creating new patient */}
          {!editingPatient && user?.role === 'superadmin' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Organization Type</label>
                <Select
                  isClearable
                  value={modalOrgTypeFilter ? { value: modalOrgTypeFilter, label: modalOrgTypeFilter === 'hospital' ? 'Hospital' : 'Fleet Owner' } : null}
                  onChange={(opt) => { const v = opt?.value || ''; setModalOrgTypeFilter(v); setModalSelectedOrgId(null); setModalSelectedOrgInfo(null); }}
                  options={[{ value: '', label: 'All Types' }, { value: 'hospital', label: 'Hospital' }, { value: 'fleet_owner', label: 'Fleet Owner' }]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Organization</label>
                <Select
                  isDisabled={!modalOrgTypeFilter}
                  placeholder={modalOrgTypeFilter ? 'Type to search or pick an organization' : 'Select an organization type first'}
                  options={organizations.filter(o => (!modalOrgTypeFilter || o.type === modalOrgTypeFilter)).map(o => ({ value: o.id, label: `${o.name} (${o.code})` }))}
                  value={modalSelectedOrgId ? { value: modalSelectedOrgId, label: `${modalSelectedOrgInfo?.name || ''} (${modalSelectedOrgInfo?.code || ''})` } : null}
                  onChange={(opt) => {
                    if (opt) {
                      setModalSelectedOrgId(opt.value);
                      const info = organizations.find(o => o.id === opt.value) || null;
                      setModalSelectedOrgInfo(info);
                    } else {
                      setModalSelectedOrgId(null);
                      setModalSelectedOrgInfo(null);
                    }
                  }}
                  classNamePrefix="react-select"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  menuPosition="fixed"
                />
              </div>
            </div>
          ) : !editingPatient ? (
            <div>
              <label className="block text-sm font-medium mb-2">Organization</label>
              <div className="py-2 text-sm text-secondary">{modalSelectedOrgInfo?.name || organizations.find(o => String(o.id) === String(user?.organizationId))?.name || '—'}</div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              {...register('firstName')}
              error={errors.firstName?.message}
            />
            <Input
              label="Last Name"
              {...register('lastName')}
              error={errors.lastName?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Age (years)"
              type="number"
              {...register('age')}
              error={errors.age?.message}
            />
            <div>
              <label className="block text-sm font-medium mb-2">Gender</label>
              <Controller
                name="gender"
                control={control}
                defaultValue={''}
                render={({ field }) => {
                  const options = [
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ];
                  const value = options.find(o => o.value === field.value) || null;
                  return (
                    <Select
                      classNamePrefix="react-select"
                      options={options}
                      value={value}
                      onChange={(opt) => field.onChange(opt ? opt.value : '')}
                      placeholder="Select Gender"
                    />
                  );
                }}
              />
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Blood Group</label>
              <Controller
                name="bloodGroup"
                control={control}
                defaultValue={''}
                render={({ field }) => {
                  const options = [
                    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
                  ].map(v => ({ value: v, label: v }));
                  const value = options.find(o => o.value === field.value) || null;
                  return (
                    <Select
                      classNamePrefix="react-select"
                      options={options}
                      value={value}
                      onChange={(opt) => field.onChange(opt ? opt.value : '')}
                      placeholder="Select Blood Group"
                    />
                  );
                }}
              />
              {errors.bloodGroup && (
                <p className="mt-1 text-sm text-red-600">{errors.bloodGroup.message}</p>
              )}
            </div>
            <Input
              label="Phone"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </div>

          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
          />

          <Input
            label="Address"
            {...register('address')}
            error={errors.address?.message}
          />

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-4">Emergency Contact</h3>
            <div className="space-y-4">
              <Input
                label="Contact Name"
                {...register('emergencyContactName')}
                error={errors.emergencyContactName?.message}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Contact Phone"
                  {...register('emergencyContactPhone')}
                  error={errors.emergencyContactPhone?.message}
                />
                <Input
                  label="Relation"
                  {...register('emergencyContactRelation')}
                  error={errors.emergencyContactRelation?.message}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-4">Medical Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Medical History</label>
                <textarea
                  {...register('medicalHistory')}
                  rows="3"
                  className="w-full px-4 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter medical history..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Allergies</label>
                <textarea
                  {...register('allergies')}
                  rows="2"
                  className="w-full px-4 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter allergies..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Current Medications</label>
                <textarea
                  {...register('currentMedications')}
                  rows="2"
                  className="w-full px-4 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter current medications..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {editingPatient ? 'Update Patient' : 'Add Patient'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Patient Details Modal */}
      {showDetailsModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailsModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-5xl max-h-[90vh] bg-background rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            >
            {selectedPatient && (
              <div className="flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5 flex-shrink-0">
                  <div className="">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                          {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-1">
                            {selectedPatient.firstName} {selectedPatient.lastName}
                          </h2>
                          <p className="text-sm text-white/80 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {selectedPatient.email}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDetailsModal(false)}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors group"
                      >
                        <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Stats Bar */}
                <div className="bg-background-card border-b border-border px-6 py-4 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs font-medium text-text-secondary mb-1">Blood Group</p>
                    <p className="text-2xl font-bold text-primary">{selectedPatient.bloodGroup || selectedPatient.blood_group || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-text-secondary mb-1">Age</p>
                    <p className="text-2xl font-bold text-text">{selectedPatient.age || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-text-secondary mb-1">Gender</p>
                    <p className="text-2xl font-bold text-text">{selectedPatient.gender || 'N/A'}</p>
                  </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                  {/* Contact Information */}
                  <div className="bg-background-card rounded-2xl p-5 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-primary" />
                      Contact Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-background rounded-xl">
                        <Phone className="w-5 h-5 text-text-secondary" />
                        <div className="flex-1">
                          <p className="text-xs text-text-secondary">Phone Number</p>
                          <p className="text-sm font-semibold text-text">{selectedPatient.phone || 'Not provided'}</p>
                        </div>
                      </div>
                      {selectedPatient.address && (
                        <div className="flex items-start gap-3 p-3 bg-background rounded-xl">
                          <MapPin className="w-5 h-5 text-text-secondary mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-text-secondary">Address</p>
                            <p className="text-sm font-medium text-text leading-relaxed">{selectedPatient.address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  {(selectedPatient.emergencyContactName || selectedPatient.emergency_contact_name) && (
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-2xl p-5 border border-red-200 dark:border-red-900/30 shadow-sm">
                      <h3 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        Emergency Contact
                      </h3>
                      <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-base font-bold text-text">
                              {selectedPatient.emergencyContactName || selectedPatient.emergency_contact_name}
                            </p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {selectedPatient.emergencyContactRelation || selectedPatient.emergency_contact_relation || 'Relation not specified'}
                            </p>
                          </div>
                          <a 
                            href={`tel:${selectedPatient.emergencyContactPhone || selectedPatient.emergency_contact_phone}`}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </a>
                        </div>
                        <div className="pt-2 border-t border-red-200 dark:border-red-900/30">
                          <p className="text-sm font-mono font-semibold text-text">
                            {selectedPatient.emergencyContactPhone || selectedPatient.emergency_contact_phone || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sessions History */}
                  <div className="bg-background-card rounded-2xl p-5 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Patient Sessions
                      <span className="ml-auto text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                        {Array.isArray(sessions) ? sessions.length : 0}
                      </span>
                    </h3>
                    
                    <div className="space-y-3">
                      {(!Array.isArray(sessions) || sessions.length === 0) ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Activity className="w-8 h-8 text-text-secondary opacity-50" />
                          </div>
                          <p className="text-sm text-text-secondary">No sessions found for this patient</p>
                        </div>
                      ) : (
                        sessions.map((session) => {
                          const start = session.onboarded_at || session.onboardedAt || session.created_at || session.createdAt;
                          const end = session.offboarded_at || session.offboardedAt || session.actual_arrival_time;
                          const duration = formatDuration(start, end);
                          const ambulanceLabel = session.registration_number || session.ambulance_code || session.ambulance?.registration_number || 'N/A';
                          return (
                            <div 
                              key={session.id} 
                              className="bg-background rounded-xl p-4 border border-border hover:border-primary/50 transition-all group"
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                                  <AmbulanceIcon className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-text mb-0.5">{ambulanceLabel}</p>
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(session.status)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-background-card rounded-lg p-2">
                                  <p className="text-xs text-text-secondary mb-0.5">Duration</p>
                                  <p className="text-sm font-semibold text-text">{duration}</p>
                                </div>
                                <div className="bg-background-card rounded-lg p-2">
                                  <p className="text-xs text-text-secondary mb-0.5">Onboarded</p>
                                  <p className="text-sm font-semibold text-text">
                                    {start ? new Date(start).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                              </div>
                              
                              <Button 
                                size="sm" 
                                className="w-full"
                                onClick={() => window.open(`/sessions/${session.id}`, '_blank')}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Session Details
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
          </div>
        </>
      )}
    </div>
  );
};
