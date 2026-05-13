import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, UserCheck, UserX, User, Ambulance as AmbulanceIcon, Info } from 'lucide-react';
import Tooltip from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui';
import useUiStore from '../../store/uiStore';
import { useForm, Controller } from 'react-hook-form';
import { userService, organizationService, ambulanceService } from '../../services';
import Select from '../../components/ui/Select';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import getErrorMessage from '../../utils/getErrorMessage';
import { hasPermission, PERMISSIONS, needsOrgSelection } from '../../utils/permissions';

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [usersCache, setUsersCache] = useState({});
  const [organizations, setOrganizations] = useState([]);
  const [orgTypeFilter, setOrgTypeFilter] = useState('');
  const [orgSearchInput, setOrgSearchInput] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedOrgInfo, setSelectedOrgInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showLoader, hideLoader } = useUiStore();
  const [activeTab, setActiveTab] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentUser, setAssignmentUser] = useState(null);
  const [availableAmbulances, setAvailableAmbulances] = useState([]);
  const [assignedAmbulances, setAssignedAmbulances] = useState([]);
  const [assigningAmbulanceId, setAssigningAmbulanceId] = useState(null);
  const [unassigningAmbulanceId, setUnassigningAmbulanceId] = useState(null);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open create modal if coming from quick actions
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsModalOpen(true);
      // Remove the param from URL
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { register, control, handleSubmit, reset, setValue, setError, clearErrors, watch, formState: { errors } } = useForm();
  const watchRole = watch('role');
  const [showConfirmSuperadmin, setShowConfirmSuperadmin] = useState(false);
  const roleInfoRef = useRef(null);

  const tabs = [
    { id: 'all', label: 'All Users' },
    { id: 'doctors', label: 'Doctors' },
    { id: 'paramedics', label: 'Paramedics' },
    { id: 'drivers', label: 'Drivers' },
    { id: 'pending', label: 'Pending Approval' },
    ...(user?.role === 'superadmin' ? [{ id: 'superadmins', label: 'Superadmins' }] : []),
  ];

  const mapRoleLabel = (role) => {
    if (!role) return '';
    const key = (role || '').toString();
    const map = {
      superadmin: 'Superadmin',
      SUPERADMIN: 'Superadmin',
      hospital_admin: 'Hospital Admin',
      hospital_staff: 'Hospital Staff',
      hospital_doctor: 'Doctor',
      hospital_paramedic: 'Paramedic',
      fleet_admin: 'Fleet Admin',
      fleet_staff: 'Fleet Staff',
      fleet_doctor: 'Doctor (Fleet)',
      fleet_paramedic: 'Paramedic (Fleet)',
      DOCTOR: 'Doctor',
      PARAMEDIC: 'Paramedic',
      DRIVER: 'Driver',
      ADMIN: 'Admin'
    };
    return map[key] || map[key.toLowerCase?.()] || key;
  };

  useEffect(() => {
    // Only fetch users when scope changes (organization selection) or on mount.
    fetchUsers();
    fetchOrganizations();
    // Note: intentionally not re-fetching on tab changes; tabs will be filtered client-side from cached users.
  }, [selectedOrgId, orgTypeFilter, activeTab]);

  // Listen for global cache reset: clear users cache and force refetch
  useEffect(() => {
    const handler = async () => {
      try {
        setUsersCache({});
        await fetchUsers(true);
        await fetchOrganizations();
      } catch (error) {
        console.error('Failed to fetch users:', error);
  const msg = getErrorMessage(error, 'Failed to load users');
        toast.error(msg);
        setUsers([]);
      } finally {
        window.dispatchEvent(new CustomEvent('global:cache-reset-done', { detail: { page: 'users' } }));
      }
    };
    window.addEventListener('global:cache-reset', handler);
    return () => window.removeEventListener('global:cache-reset', handler);
  }, [selectedOrgId, orgTypeFilter, user, activeTab]);

  

  // When the selected role becomes SUPERADMIN, clear any selected organization fields
  useEffect(() => {
    if ((watchRole || '').toString().toUpperCase() === 'SUPERADMIN') {
      // clear organization selection inputs
      setOrgTypeFilter('');
      setSelectedOrgId(null);
      setOrgSearchInput('');
      setValue('organizationType', '');
      setValue('organizationId', null);
      clearErrors('organizationId');
      clearErrors('organizationType');
    }
  }, [watchRole]);

  useEffect(() => {
    // update selectedOrgInfo when selectedOrgId changes
    if (selectedOrgId) {
      const org = organizations.find(o => String(o.id) === String(selectedOrgId));
      setSelectedOrgInfo(org || null);
    } else {
      setSelectedOrgInfo(null);
    }
  }, [selectedOrgId, organizations]);

  const fetchOrganizations = async () => {
    try {
      const response = await organizationService.getAll();
      setOrganizations(response.data?.data?.organizations || response.data?.organizations || response.data || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
  const msg = getErrorMessage(error, 'Failed to load organizations');
  toast.error(msg);
    }
  };

  const fetchUsers = async (force = false) => {
    setLoading(true);
    showLoader('Loading users...');
    try {
      // Special case: superadmin can view all pending users without organization selection
      const isPendingTabForSuperadmin = user?.role === 'superadmin' && activeTab === 'pending';
      
      // If current user is superadmin and they haven't selected an organization,
      // and they're not viewing pending users, require organization selection
      if (user?.role === 'superadmin' && !selectedOrgId && !isPendingTabForSuperadmin) {
        // clear any previous users and don't call the API
        setUsers([]);
        return;
      }

      // Build a cache key based on organization scope. Non-superadmin users are scoped to their org.
      const scopeKey = user?.role === 'superadmin'
        ? `org:${selectedOrgId || 'none'}:tab:${activeTab}`
        : `org:${user?.organizationId || 'own'}`;

      // If cache exists and not forcing, use it and avoid network call
      if (!force && usersCache[scopeKey]) {
        setUsers(usersCache[scopeKey]);
        return;
      }

      // Build params for the API call. Default to empty.
      const params = {};

      // For non-superadmin users, scope to their organization automatically
      if (user?.role !== 'superadmin') {
        params.organizationId = user?.organizationId;
      }

      // For superadmin users: if they selected an organization, fetch that org's users
      // Or if viewing pending users, don't scope to organization (show all pending)
      if (user?.role === 'superadmin' && selectedOrgId && !isPendingTabForSuperadmin) {
        params.organizationId = selectedOrgId;
      }

      // Add status filter based on active tab
      if (activeTab === 'pending') {
        params.status = 'pending';
      } else if (activeTab === 'active') {
        params.status = 'active';
      } else if (activeTab === 'deactivated') {
        params.status = 'deactivated';
      }

      const response = await userService.getAll(params);
      const usersRaw = response.data?.data?.users || response.data?.users || response.data || [];

      // Normalize
      const normalized = usersRaw.map(u => ({
        ...u,
        profileImageUrl: u.profileImageUrl || u.profile_image_url || null,
        firstName: u.firstName || u.first_name || (u.email ? u.email.split('@')[0] : ''),
        lastName: u.lastName || u.last_name || '',
        organization_name: u.organization_name || u.organizationName || u.organization_name,
        organization_code: u.organization_code || u.organizationCode || u.organization_code,
        role: u.role,
        status: u.status
      }));

      // Cache and set
      setUsersCache(prev => ({ ...prev, [scopeKey]: normalized }));
      setUsers(normalized);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
      hideLoader();
    }
  };

  const handleApprove = async (id) => {
    try {
      await userService.approve(id);
      toast.success('User approved successfully');
      await fetchUsers(true);
    } catch (error) {
      console.error('Failed to approve user:', error);
      toast.error('Failed to approve user');
    }
  };

  const handleReject = async (id) => {
    try {
      await userService.suspend(id);
      toast.success('User rejected successfully');
      fetchUsers();
    } catch (error) {
      console.error('Failed to suspend user:', error);
      toast.error('Failed to reject user');
    }
  };

  const handleDeactivate = async (id) => {
    if (window.confirm('Are you sure you want to suspend this user?')) {
      try {
        await userService.suspend(id);
        toast.success('User suspended successfully');
        await fetchUsers(true);
      } catch (error) {
        console.error('Failed to suspend user:', error);
        toast.error('Failed to suspend user');
      }
    }
  };

  const handleActivate = async (id) => {
    if (window.confirm('Are you sure you want to activate this user?')) {
      try {
        await userService.activate(id);
        toast.success('User activated successfully');
        await fetchUsers(true);
      } catch (error) {
        console.error('Failed to activate user:', error);
        const msg = error?.response?.data?.message || 'Failed to activate user';
        toast.error(msg);
      }
    }
  };

  const handleOpenAssignmentModal = async (userData) => {
    setAssignmentUser(userData);
    
    try {
      // Fetch available ambulances from the same organization
      const ambulancesResponse = await ambulanceService.getAll({
        organizationId: userData.organization_id || userData.organizationId
      });
      const ambulances = ambulancesResponse.data?.data?.ambulances || ambulancesResponse.data?.ambulances || ambulancesResponse.data || [];
      // Filter out ambulances that are not yet approved for assignment
      const filtered = ambulances.filter(a => (a.status || '').toString().toLowerCase() !== 'pending_approval');
      if (ambulances.length !== filtered.length) {
        toast.info('Some ambulances are pending approval and cannot be assigned until approved');
      }

      // Fetch ambulances already assigned to this user (RBAC enforced on backend)
      let assigned = [];
      try {
        const respAssigned = await ambulanceService.getForUser(userData.id);
        assigned = respAssigned.data?.data?.ambulances || respAssigned.data?.ambulances || respAssigned.data || [];
        setAssignedAmbulances(assigned);
      } catch (err) {
        // Not fatal: show no assigned ambulances
        console.warn('Could not fetch assigned ambulances for user', err);
        setAssignedAmbulances([]);
      }

      // Filter available ambulances to exclude those already assigned to the user
      const assignedIds = new Set((assigned || []).map(a => a.id));
      const availableFiltered = filtered.filter(a => !assignedIds.has(a.id));
      setAvailableAmbulances(availableFiltered);
      
    } catch (error) {
      console.error('Failed to fetch ambulances:', error);
      toast.error('Failed to load ambulances for assignment');
      setAvailableAmbulances([]);
    }
    
    setIsAssignmentModalOpen(true);
  };

  const handleCloseAssignmentModal = () => {
    setIsAssignmentModalOpen(false);
    setAssignmentUser(null);
    setAvailableAmbulances([]);
    setAssignedAmbulances([]);
  };

  const handleAssignToAmbulance = async (ambulanceId) => {
    setAssigningAmbulanceId(ambulanceId);
    try {
      await ambulanceService.assign(ambulanceId, assignmentUser.id, assignmentUser.role);
      toast.success('User assigned to ambulance successfully');

      // Update assignedAmbulances locally so modal stays open
      try {
        const resp = await ambulanceService.getForUser(assignmentUser.id);
        const assigned = resp.data?.data?.ambulances || resp.data?.ambulances || resp.data || [];
        setAssignedAmbulances(assigned);

        // Remove from availableAmbulances if assigned
        setAvailableAmbulances(prev => prev.filter(a => a.id !== ambulanceId));
      } catch (err) {
        console.warn('Failed to refresh assigned ambulances after assign', err);
      }
    } catch (error) {
      console.error('Failed to assign user to ambulance:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to assign user to ambulance';
      toast.error(msg);
    } finally {
      setAssigningAmbulanceId(null);
    }
  };

  const handleUnassignFromAmbulance = async (ambulanceId) => {
    if (!assignmentUser) return;
    if (!window.confirm('Are you sure you want to unassign this user from the ambulance?')) return;
    setUnassigningAmbulanceId(ambulanceId);
    try {
      await ambulanceService.unassign(ambulanceId, assignmentUser.id);
      toast.success('User unassigned from ambulance');

      // Remove from assigned list locally
      setAssignedAmbulances(prev => prev.filter(a => a.id !== ambulanceId));

      // Add back to available list if not present
      const removed = assignedAmbulances.find(a => a.id === ambulanceId);
      if (removed) {
        setAvailableAmbulances(prev => {
          const exists = prev.some(p => p.id === removed.id);
          if (exists) return prev;
          return [removed, ...prev];
        });
      }
    } catch (err) {
      console.error('Failed to unassign user from ambulance', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to unassign user from ambulance';
      toast.error(msg);
    } finally {
      setUnassigningAmbulanceId(null);
    }
  };

  const showOrganizationColumn = !selectedOrgId && activeTab !== 'superadmins';

  const columns = [
    {
      header: 'Name',
      accessor: 'firstName',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
            {(row.profileImageUrl || row.profile_image_url) ? (
              <img 
                src={row.profileImageUrl || row.profile_image_url} 
                alt={`${row.firstName} ${row.lastName}`}
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerText = `${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`;
                }}
              />
            ) : (
              <>{row.firstName?.[0]}{row.lastName?.[0]}</>
            )}
          </div>
          <div>
            <p className="font-medium text-text">{row.firstName} {row.lastName}</p>
            <p className="text-sm text-secondary">{row.email}</p>
          </div>
        </div>
      ),
    },
    ...(showOrganizationColumn ? [{
      header: 'Organization',
      accessor: 'organization_name',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.organization_name || 'N/A'}</p>
          <p className="text-xs text-secondary">{row.organization_code || ''}</p>
        </div>
      ),
    }] : []),
    {
      header: 'Role',
      accessor: 'role',
      render: (row) => (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-background-card border border-border text-text">
          {(() => {
            const map = {
              superadmin: 'Superadmin',
              hospital_admin: 'Hospital Admin',
              hospital_staff: 'Hospital Staff',
              hospital_doctor: 'Doctor',
              hospital_paramedic: 'Paramedic',
              fleet_admin: 'Fleet Admin',
              fleet_staff: 'Fleet Staff',
              fleet_doctor: 'Doctor (Fleet)',
              fleet_paramedic: 'Paramedic (Fleet)'
            };
            return map[row.role] || (row.role || '').toString();
          })()}
        </span>
      ),
    },
    {
      header: 'Phone',
      accessor: 'phone',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          row.status === 'active' ? 'bg-green-100 text-green-800' :
          (row.status === 'pending' || row.status === 'pending_approval') ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {row.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => {
        const isSuspended = (row.status || '').toString().toLowerCase() === 'suspended';
        const isPending = row.status === 'pending' || row.status === 'pending_approval';
        const targetRole = (row.role || '').toString().toLowerCase();
        const isTargetAdmin = targetRole.includes('admin');
        const isSuperadmin = user?.role === 'superadmin';
        const isAdmin = targetRole.includes('admin');

        // Suspended users: show only Activate button (superadmin only for admins, org admins can activate their org's users)
        if (isSuspended) {
          const canActivate = isSuperadmin || (!isTargetAdmin && user?.organizationId === row.organization_id);
          return (
            <div className="flex items-center gap-2">
              {canActivate && (
                <Button 
                  size="sm" 
                  variant="success" 
                  onClick={() => handleActivate(row.id)}
                >
                  Activate
                </Button>
              )}
            </div>
          );
        }

        // Check if user was created by an org admin (not by superadmin or self-signup)
        const createdByOrgAdmin = row.creator_role && (
          row.creator_role.toLowerCase().includes('hospital_admin') || 
          row.creator_role.toLowerCase().includes('fleet_admin')
        );

        // Approve/Reject logic: org admins can approve any non-admin (not just doctor/paramedic/driver/staff)
        const canApprove = isSuperadmin || (!isTargetAdmin && user?.organizationId === row.organization_id);

        return (
          <div className="flex items-center gap-2">
            {isPending && canApprove ? (
              <>
                <Button 
                  size="sm" 
                  variant="success" 
                  onClick={() => handleApprove(row.id)}
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="danger" 
                  onClick={() => handleReject(row.id)}
                >
                  <UserX className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </>
            ) : (
            <>
              {/* Edit button - disabled for suspended users */}
              <Button size="sm" variant="secondary" onClick={() => handleOpenModal(row)}>
                Edit
              </Button>
              
              {/* Assign Ambulance button */}
              {((targetRole.includes('doctor') || targetRole.includes('paramedic') || targetRole.includes('driver') || targetRole.includes('staff')) && (
                <Button size="sm" variant="success" onClick={() => handleOpenAssignmentModal(row)}>
                  <AmbulanceIcon className="w-4 h-4 mr-1" />
                  Assign Ambulance
                </Button>
              ))}
              
              {/* Deactivate button */}
              {(() => {
                const isSelf = String(row.id) === String(user?.id);
                const cannotDeactivateAdmin = isTargetAdmin && !isSuperadmin;
                const disabled = isSelf || cannotDeactivateAdmin;
                return (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeactivate(row.id)}
                    disabled={disabled}
                    title={disabled ? (isSelf ? 'You cannot deactivate your own account' : 'Only a superadmin can deactivate admin accounts') : ''}
                  >
                    Deactivate
                  </Button>
                );
              })()}
            </>
          )}
        </div>
        );
      },
    },
  ];

  const handleOpenModal = (userData = null) => {
    setSelectedUser(userData);
    if (userData) {
      reset(userData);
      setAvatarPreview(userData.profileImageUrl || null);
    } else {
      // For non-superadmin, pre-fill organizationId
      const defaultData = user?.role === 'superadmin' ? {} : { organizationId: user?.organizationId };
      reset(defaultData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    reset({});
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      // if superadmin creating non-superadmin users, ensure organization fields are present when required
      if (user?.role === 'superadmin' && activeTab !== 'superadmins') {
        // allow creating SUPERADMIN without selecting an organization; only require org for other roles
        const creatingRole = (data.role || '').toString().toUpperCase();
        if (creatingRole !== 'SUPERADMIN' && !selectedOrgId && !data.organizationId) {
          setError('organizationId', { type: 'required', message: 'Organization is required' });
          setError('organizationType', { type: 'required', message: 'Organization type is required' });
          return;
        }
      }
      // Prepare submit data. For superadmin, allow choosing an organization via UI (selectedOrgId).
      let submitData = { ...data };
      if (user?.role !== 'superadmin') {
        submitData.organizationId = user?.organizationId;
      } else {
        // superadmin creating a user:
        // - if the chosen role is SUPERADMIN, do not attach an organizationId (backend will map to SYSTEM org)
        //   but include organizationType = 'superadmin' so the server can clearly detect intent
        // - otherwise, attach selectedOrgId when present
        if ((submitData.role || '').toString().toUpperCase() === 'SUPERADMIN') {
          // mark explicitly that this is a superadmin creation
          submitData.organizationType = 'superadmin';
          delete submitData.organizationId;
        } else {
          if (selectedOrgId) submitData.organizationId = selectedOrgId;
          else delete submitData.organizationId;
        }
      }
        let newUserId = null;
        if (selectedUser) {
          await userService.update(selectedUser.id, submitData);
          toast.success('User updated successfully');
          newUserId = selectedUser.id;
        } else {
          const resp = await userService.create(submitData);
          toast.success('User created successfully');
          newUserId = resp.data?.data?.userId || null;
        }

        // If avatar file selected, upload it for the created/updated user
        if (avatarFile && newUserId) {
          try {
            const fd = new FormData();
            fd.append('avatar', avatarFile);
            await userService.uploadProfileImage(newUserId, fd);
          } catch (err) {
            console.error('Failed to upload avatar for user:', err);
            toast.error('User saved but avatar upload failed');
          }
        }
        // Force refresh cache after create/update
        await fetchUsers(true);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save user:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || (selectedUser ? 'Failed to update user' : 'Failed to create user');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const matchesTab = (u) => {
    // role may be a string or an array; normalize to lowercase string for matching
    let r = '';
    if (Array.isArray(u.role)) r = u.role.map(x => String(x).toLowerCase()).join(' ');
    else r = (u.role || '').toString().toLowerCase();
    const s = (u.status || '').toString().toLowerCase();

    // Superadmins handling: ONLY show in superadmins tab
    if (r.includes('superadmin')) {
      return activeTab === 'superadmins';
    }

    // All users tab shows everyone EXCEPT superadmins
    if (activeTab === 'all') return true;

    if (activeTab === 'pending') return s === 'pending' || s === 'pending_approval';

    // Specific role tabs
    if (activeTab === 'doctors') return r.includes('doctor');
    if (activeTab === 'paramedics') return r.includes('paramedic');
    if (activeTab === 'drivers') return r.includes('driver');

    // Fallback: try matching tab string
    const tabLower = activeTab.toLowerCase();
    return r.includes(tabLower);
  };

  const filteredUsers = users.filter(user => 
    matchesTab(user) && (
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      
      
      {/* Header */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4 md:pt-0">
      <div>
        <h1 className="text-3xl font-display font-bold mt-5 mb-2">User Management</h1>
          <p className="text-secondary">Manage doctors, paramedics, drivers, and admins</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-2" />
          Add User
        </Button>
      </div>

      {/* Tabs */}
      {/* Tabs + Search (search moved next to tabs) */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-6 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-2xl font-medium text-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-primary text-white' : 'bg-background-card hover:bg-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search input aligned to the right of the tabs */}
          <div className="ml-auto w-full md:w-1/3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-10 pr-3 py-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Organization filters (superadmin only) with selected org info on the right */}
      {user?.role === 'superadmin' && (
        <Card className="p-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
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
                  <p className="text-sm text-secondary">Select an organization to view details here</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* If superadmin and no organization selected (and not viewing superadmins), prompt selection */}
      {user?.role === 'superadmin' && !selectedOrgId && activeTab !== 'superadmins' && (
        <Card>
          <div className="py-3 text-center">
              <p className="text-sm text-secondary">Please select an Organization Type and an Organization above to load users for that organization.</p>
            </div>
          </Card>
      )}

      {/* Users Table */}
  <Table columns={columns} data={filteredUsers} onRefresh={() => fetchUsers(true)} isRefreshing={loading} />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedUser ? 'Edit User' : 'Add User'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button loading={submitting} onClick={() => {
              const roleVal = (watchRole || '').toString().toUpperCase();
              if (roleVal === 'SUPERADMIN') setShowConfirmSuperadmin(true);
              else handleSubmit(onSubmit)();
            }}>
              {selectedUser ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <style>
            {`
              .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: var(--background);
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: var(--primary);
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: var(--primary-dark);
              }
            `}
          </style>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              {...register('firstName', { required: 'First name is required' })}
              error={errors.firstName?.message}
            />
            <Input
              label="Last Name"
              {...register('lastName')}
              error={errors.lastName?.message}
            />
          </div>

          {/* Avatar upload */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">Profile Image</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-background-card rounded-full overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-text-secondary">No image</div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                  setAvatarFile(f);
                  if (f) setAvatarPreview(URL.createObjectURL(f));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email *"
              type="email"
              {...register('email', { required: 'Email is required' })}
              error={errors.email?.message}
            />
            <Input
              label="Phone"
              type="tel"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </div>

          {/* Superadmin-specific organization selection - ONLY when creating new users */}
          {!selectedUser && user?.role === 'superadmin' && ((watchRole || '').toString().toUpperCase() !== 'SUPERADMIN') && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text mb-2">Organization Type *</label>
                <Controller
                  control={control}
                  name="organizationType"
                  defaultValue={orgTypeFilter || ''}
                  rules={{ required: 'Organization type is required' }}
                  render={({ field }) => (
                    <Select
                      isClearable
                      value={field.value ? { value: field.value, label: field.value === 'hospital' ? 'Hospital' : 'Fleet Owner' } : null}
                      onChange={(opt) => {
                        const v = opt?.value || '';
                        field.onChange(v);
                        setOrgTypeFilter(v);
                        setSelectedOrgId(null);
                        setOrgSearchInput('');
                        clearErrors('organizationId');
                      }}
                      options={[{ value: 'hospital', label: 'Hospital' }, { value: 'fleet_owner', label: 'Fleet Owner' }]}
                    />
                  )}
                />
                {errors.organizationType && <p className="mt-1 text-sm text-red-500">{errors.organizationType.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">Organization *</label>
                <Controller
                  control={control}
                  name="organizationId"
                  defaultValue={selectedOrgId || null}
                  rules={{ required: orgTypeFilter && activeTab !== 'superadmins' ? 'Organization is required' : false }}
                  render={({ field }) => (
                    <Select
                      isDisabled={!orgTypeFilter}
                      placeholder={orgTypeFilter ? 'Type to search or pick an organization' : 'Select an organization type first'}
                      options={organizations.filter(o => (!orgTypeFilter || o.type === orgTypeFilter)).map(o => ({ value: o.id, label: `${o.name} (${o.code})` }))}
                      value={field.value ? { value: field.value, label: `${selectedOrgInfo?.name || ''} (${selectedOrgInfo?.code || ''})` } : null}
                      onChange={(opt) => {
                        const v = opt?.value || null;
                        field.onChange(v);
                        if (v) {
                          setSelectedOrgId(v);
                          setOrgSearchInput(opt.label);
                          clearErrors('organizationId');
                        } else {
                          setSelectedOrgId(null);
                          setOrgSearchInput('');
                        }
                      }}
                      classNamePrefix="react-select"
                    />
                  )}
                />
                {errors.organizationId && <p className="mt-1 text-sm text-red-500">{errors.organizationId.message}</p>}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-text mb-2">Role *</label>
              <button ref={roleInfoRef} className="p-1.5 rounded-full hover:bg-gray-50" aria-label="Role info">
                <Info className="w-4 h-4 text-secondary" />
              </button>
              <Tooltip anchorRef={roleInfoRef} label="Superadmins have global access and are not tied to any organization." />
            </div>
            <Controller
              control={control}
              name="role"
              defaultValue={''}
              rules={{ required: 'Role is required' }}
              render={({ field }) => {
                // Build role options. Important: do NOT allow setting SUPERADMIN when editing an existing user.
                const opts = [];
                // Only allow creating a superadmin when creating a new user and current user is a superadmin
                if (!selectedUser && (user?.role || '').toString().toLowerCase() === 'superadmin') {
                  opts.push({ value: 'SUPERADMIN', label: 'Superadmin' });
                }

                // For superadmin: show role options only when org type and org are selected
                // For non-superadmin users (org admins): always show role options (they're creating users for their own org)
                const shouldShowOrgRoles = (user?.role === 'superadmin' && orgTypeFilter && selectedOrgId) || 
                                           (user?.role !== 'superadmin');

                if (shouldShowOrgRoles) {
                  opts.push({ value: 'DOCTOR', label: 'Doctor' });
                  opts.push({ value: 'PARAMEDIC', label: 'Paramedic' });
                  opts.push({ value: 'DRIVER', label: 'Driver' });
                  opts.push({ value: 'ADMIN', label: 'Admin' });
                }

                // Ensure the current value (if any) appears as an option with a humanized label so react-select shows it correctly
                const currentVal = field.value;
                if (currentVal) {
                  const exists = opts.some(o => String(o.value) === String(currentVal));
                  if (!exists) {
                    opts.unshift({ value: currentVal, label: mapRoleLabel(currentVal) });
                  }
                }

                return (
                  <Select
                    placeholder="Select Role"
                    value={field.value ? { value: field.value, label: mapRoleLabel(field.value) } : null}
                    onChange={(opt) => field.onChange(opt?.value || '')}
                    options={opts}
                  />
                );
              }}
            />
            {errors.role && <p className="mt-1 text-sm text-red-500">{errors.role.message}</p>}
          </div>

          {!selectedUser && (
            <Input
              label="Password *"
              type="password"
              {...register('password', { required: !selectedUser && 'Password is required' })}
              error={errors.password?.message}
            />
          )}
        </form>
        </div>
      </Modal>

      {/* Confirm creating Superadmin */}
      <Modal
        isOpen={showConfirmSuperadmin}
        onClose={() => setShowConfirmSuperadmin(false)}
        title="Confirm Superadmin"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfirmSuperadmin(false)}>Cancel</Button>
            <Button loading={submitting} onClick={() => { setShowConfirmSuperadmin(false); handleSubmit(onSubmit)(); }}>Confirm</Button>
          </>
        }
      >
        <div className="py-4">
          <p>You're about to create a <strong>Superadmin</strong>. Superadmins have global access and are not tied to any organization. Are you sure you want to continue?</p>
        </div>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={handleCloseAssignmentModal}
        title={`Assign ${assignmentUser?.firstName} ${assignmentUser?.lastName} (${mapRoleLabel(assignmentUser?.role)}) to Ambulance`}
        size="lg"
      >
        <div className="space-y-4">
            <p className="text-secondary">
              Select an ambulance to assign <strong>{assignmentUser?.firstName} {assignmentUser?.lastName}</strong>
              {assignmentUser?.role ? ` (${mapRoleLabel(assignmentUser?.role)})` : ''} to:
            </p>

            {/* Already-assigned ambulances */}
            <div>
              <h4 className="text-sm font-medium text-text mb-2">Already assigned ambulances</h4>
              {assignedAmbulances.length === 0 ? (
                <p className="text-xs text-secondary">No ambulances are currently assigned to this user.</p>
              ) : (
                <div className="space-y-2">
                  {assignedAmbulances.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 bg-background-card border border-border rounded">
                      <div>
                        <p className="font-medium text-text">{a.registration_number || a.vehicleNumber}</p>
                        <p className="text-xs text-secondary">{a.vehicle_model || a.vehicleModel} • {a.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary">Assigned</span>
                        <Button size="sm" variant="danger" loading={unassigningAmbulanceId === a.id} onClick={() => handleUnassignFromAmbulance(a.id)}>
                          Unassign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          
          {availableAmbulances.length === 0 ? (
            <p className="text-secondary text-center py-8">
              No ambulances available for assignment in this organization.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availableAmbulances.map((ambulance) => (
                <div key={ambulance.id} className="flex items-center justify-between p-4 bg-background-card rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <AmbulanceIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{ambulance.registration_number || ambulance.vehicleNumber}</p>
                      <p className="text-sm text-secondary">{ambulance.vehicle_model || ambulance.vehicleModel}</p>
                      <p className="text-xs text-secondary">{ambulance.vehicle_type || ambulance.vehicleType}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="success"
                    loading={assigningAmbulanceId === ambulance.id}
                    onClick={() => handleAssignToAmbulance(ambulance.id)}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
