import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import Select from '../../components/ui/Select';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import {
  Handshake,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Calendar,
  Search,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { collaborationService, organizationService } from '../../services';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import getErrorMessage from '../../utils/getErrorMessage';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';

// --- Validation Schema ---

// Org IDs are Mongo ObjectId strings (24-char hex) — NOT numbers. The
// original schema used `yup.number()` from the MySQL era when IDs were
// integers. That now fails with
//   "hospitalId must be a `number` type, but the final value was: `NaN`
//    (cast from the value `"6a037a8831a7964b2059520f"`)"
// because Yup calls Number(hex) → NaN. We validate as 24-char hex strings
// so a missing pick still fails (empty string → required message) but a
// valid ObjectId passes through.
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const objectId = (label) => yup
  .string()
  .trim()
  .matches(OBJECT_ID_RE, { message: `${label} is required`, excludeEmptyString: true });

// Two valid submit shapes:
//   1. Superadmin path: { hospitalId, fleetId } — both required, no targetOrgId.
//   2. Hospital/Fleet admin path: { targetOrgId } — single field (the counterpart org).
//
// We could branch with `.when('$isSuper', ...)` but that depends on the
// resolver context being live, and stale context has bitten us before.
// Instead, mark every ID `notRequired()` at the field level and enforce
// the "must have one shape OR the other" rule in a single object-level
// `.test()`. That makes validation work even if the context is missing,
// and the test attaches the error to the field the user actually sees
// blank so the inline message is helpful.
const collaborationSchema = yup.object({
  targetOrgId: objectId('Organization'),
  hospitalId: objectId('Hospital'),
  fleetId: objectId('Fleet'),
  terms: yup.string().required('Terms are required'),
  duration: yup.number().typeError('Duration must be a number').required('Duration is required').positive('Duration must be positive'),
}).test('partner-fields', 'Pick a counterpart organization', function (values) {
  const ctx = this.options.context || {};
  const isSuper = !!ctx.isSuper;
  const v = values || {};

  if (isSuper) {
    if (!v.hospitalId && !v.fleetId) {
      return this.createError({ path: 'hospitalId', message: 'Hospital is required' });
    }
    if (!v.hospitalId) {
      return this.createError({ path: 'hospitalId', message: 'Hospital is required' });
    }
    if (!v.fleetId) {
      return this.createError({ path: 'fleetId', message: 'Fleet is required' });
    }
    return true;
  }

  // hospital_admin / fleet_admin: must pick the single counterpart org.
  if (!v.targetOrgId) {
    return this.createError({ path: 'targetOrgId', message: 'Organization is required' });
  }
  return true;
});

// --- Main Application Component (Collaborations) ---

export const Collaborations = () => {
  const [collaborations, setCollaborations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [fleetOwners, setFleetOwners] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false); // For Create Modal
  const { toast } = useToast();
  const runWithLoader = useWithGlobalLoader();
  
  // State for the Action Confirmation Modal
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: '', // 'accept', 'reject', 'cancel'
    collabId: null,
    reason: '', // For rejection
  });

  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuthStore();
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
    resolver: yupResolver(collaborationSchema),
    // Pass `context` here (not as a second arg to yupResolver) so it's
    // re-read on every validation call. The previous version captured
    // `user?.role` at hook-init time — if the Zustand auth store hadn't
    // rehydrated yet, `user` was null, `isSuper` was frozen as `false`,
    // and superadmin submits failed with "Organization is required" even
    // though they had picked both Hospital and Fleet.
    context: { isSuper: user?.role === 'superadmin' },
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Global cache reset handler
  useEffect(() => {
    const handler = async () => {
      try {
        await fetchData();
      } catch (err) {
        console.error('Global reset handler failed for collaborations', err);
      } finally {
        window.dispatchEvent(new CustomEvent('global:cache-reset-done', { detail: { page: 'collaborations' } }));
      }
    };
    window.addEventListener('global:cache-reset', handler);
    return () => window.removeEventListener('global:cache-reset', handler);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await runWithLoader(async () => {
        // Decide what organizations to fetch for dropdowns:
        // - superadmin: fetch all organizations
        // - hospital admin: fetch all fleet_owner orgs (so hospital can pick a fleet)
        // - fleet admin: fetch all hospital orgs (so fleet can pick a hospital)
        const collabsPromise = collaborationService.getAll();
        let orgsPromise;
        if (user?.role === 'superadmin') {
          orgsPromise = organizationService.getAll();
        } else if (user?.organizationType === 'hospital') {
          orgsPromise = organizationService.getAll({ type: 'fleet_owner', is_active: true, limit: 500 });
        } else if (user?.organizationType === 'fleet_owner') {
          orgsPromise = organizationService.getAll({ type: 'hospital', is_active: true, limit: 500 });
        } else {
          orgsPromise = organizationService.getAll();
        }

        const [collabsRes, orgsAllRes] = await Promise.all([collabsPromise, orgsPromise]);

      // Backend returns { success: true, data: { requests: [...] } } or similar
      const collabData = collabsRes.data?.data?.requests || collabsRes.data?.requests || collabsRes.data || [];
  const orgData = orgsAllRes.data?.data?.organizations || orgsAllRes.data?.organizations || orgsAllRes.data || [];

  // orgData may already be filtered by backend for non-superadmin callers
  let fleets = Array.isArray(orgData) ? orgData.filter(o => (o.type || '').toString().toLowerCase() === 'fleet_owner') : [];
  let hosps = Array.isArray(orgData) ? orgData.filter(o => (o.type || '').toString().toLowerCase() === 'hospital') : [];

  // If the backend returned only the requested type for non-superadmin, map accordingly
  if (user?.role !== 'superadmin') {
    if (user.organizationType === 'hospital') {
      // orgData contains fleet owners for hospital admins
      fleets = Array.isArray(orgData) ? orgData : [];
      // hospitals should include the caller's own org for context
      hosps = Array.isArray(orgData) ? orgData.filter(o => (o.type || '').toString().toLowerCase() === 'hospital') : [];
      // ensure hospital list includes current org
      if (!hosps || hosps.length === 0) {
        // we can add the user's org into hosps for UI display by fetching it if needed
        // but collaborations table already shows hospital info from collaboration records
      }
    }
    if (user.organizationType === 'fleet_owner') {
      // orgData contains hospitals for fleet admins
      hosps = Array.isArray(orgData) ? orgData : [];
      fleets = Array.isArray(orgData) ? orgData.filter(o => (o.type || '').toString().toLowerCase() === 'fleet_owner') : [];
    }
  }

  // If superadmin has an organization attached, remove it from the selectable lists.
  // Normalise via String() to match the equality pattern used elsewhere in this
  // file (e.g. the exclude-already-collaborated logic below) — both sides are
  // hex ObjectId strings emitted by the backend's shapeOrg helper, but String()
  // is cheap insurance against future populated-ref leaks.
  if (user?.role === 'superadmin' && user?.organizationId) {
    fleets = fleets.filter(o => String(o.id) !== String(user.organizationId));
    hosps = hosps.filter(o => String(o.id) !== String(user.organizationId));
  }

  setCollaborations(Array.isArray(collabData) ? collabData : []);
  setOrganizations(Array.isArray(orgData) ? orgData : []);
  setFleetOwners(fleets);
  setHospitals(hosps);

      }, 'Loading collaborations...');
    } catch (error) {
      console.error('Failed to fetch data:', error);
  const msg = getErrorMessage(error, 'Failed to load collaborations');
      toast.error(msg);
      setCollaborations([]);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      // Prepare payload based on user role - always send both hospitalId and fleetId
      const payloadBase = { requestType: 'partnership' };
      payloadBase.terms = data.terms;
      payloadBase.message = data.message || '';
      payloadBase.duration = data.duration;

      if (user?.role === 'superadmin') {
        // Superadmin must specify both organizations
        if (!data.hospitalId || !data.fleetId) {
          toast.error('Please select both Hospital and Fleet for the partnership');
          setLoading(false);
          return;
        }
        payloadBase.hospitalId = data.hospitalId;
        payloadBase.fleetId = data.fleetId;
      } else if (user?.organizationType === 'hospital') {
        // Hospital admin selecting a fleet - hospital is requester, fleet is target
        if (!data.targetOrgId) {
          toast.error('Please select a Fleet Owner for the partnership');
          setLoading(false);
          return;
        }
        payloadBase.hospitalId = user.organizationId; // Requester
        payloadBase.fleetId = data.targetOrgId; // Target
      } else if (user?.organizationType === 'fleet_owner') {
        // Fleet admin selecting a hospital - fleet is requester, hospital is target
        if (!data.targetOrgId) {
          toast.error('Please select a Hospital for the partnership');
          setLoading(false);
          return;
        }
        payloadBase.fleetId = user.organizationId; // Requester
        payloadBase.hospitalId = data.targetOrgId; // Target
      }

      await collaborationService.create(payloadBase);
      toast.success('Collaboration request created successfully');
      await fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to create collaboration:', error);
  const msg = getErrorMessage(error, 'Failed to create collaboration request');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // onInvalid handler extracted so we can call it and also log clicks
  const onInvalidHandler = (formErrors) => {
    try {
      const firstKey = Object.keys(formErrors)[0];
      const firstErr = firstKey ? formErrors[firstKey]?.message : 'Please fix the form errors';
      toast.error(firstErr || 'Please fix the form errors');
      console.error('Collaboration form validation errors:', formErrors);
    } catch (e) {
      console.error('Error handling form validation errors', e);
    }
  };

  const submitHandler = handleSubmit(onSubmit, onInvalidHandler);

  // Action Handlers (Triggering the Action Modal)
  const handleAcceptPrompt = (id) => setActionModal({ isOpen: true, type: 'accept', collabId: id, reason: '' });
  const handleRejectPrompt = (id) => setActionModal({ isOpen: true, type: 'reject', collabId: id, reason: '' });
  const handleCancelPrompt = (id) => setActionModal({ isOpen: true, type: 'cancel', collabId: id, reason: '' });
  
  const closeActionModal = () => setActionModal({ isOpen: false, type: '', collabId: null, reason: '' });
  
  const executeAction = async () => {
    const { type, collabId, reason } = actionModal;
    if (!collabId) return;

    // Reject requires a reason
    if (type === 'reject' && !reason.trim()) {
      toast.warning("Rejection reason is required");
      return;
    }

    try {
      setLoading(true);
      if (type === 'accept') {
        await collaborationService.accept(collabId, {
          approvedBy: user.id,
          approvalDate: new Date().toISOString(),
        });
        toast.success('Collaboration request accepted');
      } else if (type === 'reject') {
        await collaborationService.reject(collabId, {
          rejectedBy: user.id,
          rejectionReason: reason,
        });
        toast.success('Collaboration request rejected');
      } else if (type === 'cancel') {
        await collaborationService.cancel(collabId);
        toast.success('Collaboration request cancelled');
      }
      
      await fetchData();
      closeActionModal();
    } catch (error) {
      console.error(`Failed to ${type} collaboration:`, error);
      toast.error(`Failed to ${type} collaboration request`);
    } finally {
      setLoading(false);
    }
  };


  const handleCloseModal = () => {
    setShowModal(false);
    reset();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-300';
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const filteredCollaborations = collaborations.filter((collab) => {
    const matchesTab = activeTab === 'all' || collab.status?.toLowerCase() === activeTab;
    const hospitalName = collab.hospital_name || collab.hospitalName || '';
    const fleetName = collab.fleet_name || collab.fleetName || '';
    const matchesSearch =
      hospitalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fleetName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const statsData = {
    total: collaborations.length,
    pending: collaborations.filter((c) => c.status?.toLowerCase() === 'pending').length,
    approved: collaborations.filter((c) => c.status?.toLowerCase() === 'approved').length,
    rejected: collaborations.filter((c) => c.status?.toLowerCase() === 'rejected').length,
  };

  const columns = [
    {
      header: 'Hospital',
      accessor: 'hospital',
      render: (collab) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{collab.hospital_name || collab.hospitalName || 'N/A'}</div>
            <div className="text-sm text-gray-500">{collab.hospital_code || collab.hospitalCode || ''}</div>
            <div className="text-xs text-gray-400">{collab.hospital_city || collab.hospitalCity || ''}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Fleet Owner',
      accessor: 'fleet',
      render: (collab) => {
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{collab.fleet_name || collab.fleetName || 'N/A'}</div>
              <div className="text-sm text-gray-500">{collab.fleet_code || collab.fleetCode || ''}</div>
              <div className="text-xs text-gray-400">{collab.fleet_city || collab.fleetCity || ''}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Message',
      accessor: 'message',
      render: (collab) => (
        <div className="text-sm text-gray-700 max-w-xs truncate" title={collab.message || collab.terms}>
          {collab.message || collab.terms || 'N/A'}
        </div>
      ),
    },
    {
      header: 'Request Type',
      accessor: 'request_type',
      render: (collab) => (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Handshake className="w-4 h-4 text-gray-400" />
          <span className="capitalize">{collab.request_type || collab.requestType || 'Partnership'}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (collab) => (
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${getStatusColor(collab.status)}`}>
          {getStatusIcon(collab.status)}
          {collab.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (collab) => {
          const status = (collab.status || '').toLowerCase();
          const isSuper = user?.role === 'superadmin';

          // All IDs that flow through here originate from the backend
          // collaboration `shapeRequest` helper (which already maps populated
          // refs to hex strings) and the auth payload (also a string). But
          // unwrap-then-String() defensively so a populated `{ _id, ... }`
          // ever leaking through can't silently break the action-button
          // gating (which would hide the Accept/Cancel buttons from the
          // recipient).
          const norm = (ref) => {
            if (!ref) return '';
            if (typeof ref === 'string') return ref;
            return String(ref._id || ref.id || ref);
          };

          // Determine requester and recipient organizations
          const requesterOrgId = norm(collab.requester_organization_id || collab.requesterOrganizationId);
          const collabHospitalId = norm(collab.hospital_id || collab.hospitalId);
          const collabFleetId = norm(collab.fleet_id || collab.fleetId);
          const myOrgId = norm(user?.organizationId);

          const isRequesterHospital = requesterOrgId && requesterOrgId === collabHospitalId;
          const recipientOrgId = isRequesterHospital ? collabFleetId : collabHospitalId;

          // Only the RECIPIENT can approve/reject (or superadmin)
          const isRecipient = myOrgId && myOrgId === recipientOrgId;
          const canAcceptOrReject = status === 'pending' && (isSuper || isRecipient);

          // Any party involved can cancel
          const isRequesterOrg = myOrgId && myOrgId === requesterOrgId;
          const isFleetOwner = myOrgId && myOrgId === collabFleetId;
          const isHospitalOwner = myOrgId && myOrgId === collabHospitalId;
          const canCancel = (status === 'pending' && (isSuper || isRequesterOrg || isFleetOwner || isHospitalOwner)) ||
                           (status === 'approved' && (isSuper || isRequesterOrg || isFleetOwner || isHospitalOwner));

          return (
            <div className="flex items-center gap-2">
              {canAcceptOrReject && (
                <>
                  <Button size="sm" variant="success" onClick={() => handleAcceptPrompt(collab.id)}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleRejectPrompt(collab.id)}>
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}

              {canCancel && (
                <Button size="sm" variant="secondary" onClick={() => handleCancelPrompt(collab.id)}>
                  Cancel
                </Button>
              )}
            </div>
          );
        },
    },
  ];

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];
  
  const currentActionCollab = actionModal.collabId
    ? collaborations.find(c => String(c.id) === String(actionModal.collabId))
    : null;
  const actionTitle = actionModal.type === 'accept' ? 'Confirm Acceptance' :
                      actionModal.type === 'reject' ? 'Confirm Rejection' :
                      actionModal.type === 'cancel' ? 'Confirm Cancellation' : '';

  return (
    <div className="space-y-6">
      
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-display font-bold mt-5 mb-2 bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Partnership Management
          </h1>
          <p className="text-gray-600">Manage hospital-fleet collaborations and partnerships</p>
          
          {/* User guidance */}
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                {user?.role === 'superadmin' && (
                  <p>As a superadmin, you can create partnerships between any hospital and fleet, and manage all partnership requests.</p>
                )}
                {user?.organizationType === 'hospital' && (
                  <p>As a hospital admin, you can send partnership requests to fleet owners and manage your existing partnerships.</p>
                )}
                {user?.organizationType === 'fleet_owner' && (
                  <p>As a fleet admin, you can send partnership requests to hospitals and manage your existing partnerships.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-5 h-5" />
          New Partnership
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 bg-gradient-to-br from-white to-gray-50 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.total}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Handshake className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{statsData.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Approved</p>
                <p className="text-2xl font-bold text-green-900">{statsData.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4 bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 mb-1">Rejected</p>
                <p className="text-2xl font-bold text-red-900">{statsData.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Tabs & Search */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search partnerships..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 w-full lg:w-64"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading collaborations...</div>
          ) : (
            <Table columns={columns} data={filteredCollaborations} />
          )}
        </Card>
      </motion.div>

      {/* Create Modal (New Partnership) */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={`Create New Partnership ${user?.organizationType === 'hospital' ? 'with Fleet' : user?.organizationType === 'fleet_owner' ? 'with Hospital' : ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={() => { console.log('Create Partnership clicked'); submitHandler(); }} loading={loading}>
              Create Partnership
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          {user?.role === 'superadmin' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hospital</label>
                <Controller
                  name="hospitalId"
                  control={control}
                  defaultValue={''}
                  render={({ field }) => {
                    const options = hospitals.map(o => ({ 
                      value: o.id, 
                      label: `${o.name} (${o.code})`, 
                      details: `${o.city || 'N/A'}, ${o.state || ''} • ${o.phone || 'No phone'}` 
                    }));
                    const value = options.find(o => o.value === field.value) || null;
                    return (
                      <Select
                        classNamePrefix="react-select"
                        options={options}
                        value={value}
                        onChange={(opt) => field.onChange(opt ? opt.value : '')}
                        placeholder="Select Hospital"
                        isClearable
                        formatOptionLabel={(option, { context }) => (
                          <div>
                            <div className="font-medium">{option.label}</div>
                            {context === 'menu' && (
                              <div className="text-xs text-gray-500 mt-1">{option.details}</div>
                            )}
                          </div>
                        )}
                      />
                    );
                  }}
                />
                    {errors.hospitalId && (
                      <p className="mt-1 text-sm text-red-500">{errors.hospitalId.message}</p>
                    )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fleet Owner</label>
                <Controller
                  name="fleetId"
                  control={control}
                  defaultValue={''}
                  render={({ field }) => {
                    const options = fleetOwners.map(o => ({ 
                      value: o.id, 
                      label: `${o.name} (${o.code})`, 
                      details: `${o.city || 'N/A'}, ${o.state || ''} • ${o.phone || 'No phone'}` 
                    }));
                    const value = options.find(o => o.value === field.value) || null;
                    return (
                      <Select
                        classNamePrefix="react-select"
                        options={options}
                        value={value}
                        onChange={(opt) => field.onChange(opt ? opt.value : '')}
                        placeholder="Select Fleet Owner"
                        isClearable
                        formatOptionLabel={(option, { context }) => (
                          <div>
                            <div className="font-medium">{option.label}</div>
                            {context === 'menu' && (
                              <div className="text-xs text-gray-500 mt-1">{option.details}</div>
                            )}
                          </div>
                        )}
                      />
                    );
                  }}
                />
                {errors.fleetId && (
                  <p className="mt-1 text-sm text-red-500">{errors.fleetId.message}</p>
                )}
              </div>
            </div>
          )}

          {(user?.organizationType === 'hospital' || user?.organizationType === 'fleet_owner') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {user?.organizationType === 'hospital' ? 'Fleet Owner' : 'Hospital'}
              </label>
              <Controller
                name="targetOrgId"
                control={control}
                defaultValue={''}
                  render={({ field }) => {
                    // Base options depending on org type
                    const baseOptions = user?.organizationType === 'hospital'
                      ? fleetOwners.map(o => ({ 
                          value: o.id, 
                          label: `${o.name} (${o.code})`, 
                          details: `${o.city || 'N/A'}, ${o.state || ''} • ${o.phone || 'No phone'}` 
                        }))
                      : hospitals.map(o => ({ 
                          value: o.id, 
                          label: `${o.name} (${o.code})`, 
                          details: `${o.city || 'N/A'}, ${o.state || ''} • ${o.phone || 'No phone'}` 
                        }));

                    // Build a set of org ids that already have a pending or approved collaboration
                    // between the current user's org and the potential target org.
                    const excludedOrgIds = new Set();
                    collaborations.forEach(c => {
                      const status = c.status || c.request_status || c.requestStatus || c.state || '';
                      // only exclude pending or approved (allow if rejected)
                      if (!status) return;
                      const normalizedStatus = String(status).toLowerCase();
                      if (normalizedStatus !== 'pending' && normalizedStatus !== 'approved') return;

                      const fleetId = c.fleet_id || c.fleetId || c.fleet || null;
                      const hospitalId = c.hospital_id || c.hospitalId || c.hospital || null;

                      if (user?.organizationType === 'hospital') {
                        // hospital should not see fleets already collaborated/pending with their hospital
                        if (String(hospitalId) === String(user.organizationId) && fleetId) {
                          excludedOrgIds.add(String(fleetId));
                        }
                      } else if (user?.organizationType === 'fleet_owner') {
                        // fleet should not see hospitals already collaborated/pending with their fleet
                        if (String(fleetId) === String(user.organizationId) && hospitalId) {
                          excludedOrgIds.add(String(hospitalId));
                        }
                      }
                    });

                    const options = baseOptions.filter(opt => !excludedOrgIds.has(String(opt.value)));
                    const value = options.find(o => o.value === field.value) || null;
                    return (
                      <Select
                        classNamePrefix="react-select"
                        options={options}
                        value={value}
                        onChange={(opt) => field.onChange(opt ? opt.value : '')}
                        placeholder={`Select ${user?.organizationType === 'hospital' ? 'Fleet Owner' : 'Hospital'}`}
                        formatOptionLabel={(option, { context }) => (
                          <div>
                            <div className="font-medium">{option.label}</div>
                            {context === 'menu' && (
                              <div className="text-xs text-gray-500 mt-1">{option.details}</div>
                            )}
                          </div>
                        )}
                      />
                    );
                  }}
              />
              {errors.targetOrgId && (
                <p className="mt-1 text-sm text-red-500">{errors.targetOrgId.message}</p>
              )}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Terms & Conditions
            </label>
            <textarea
              {...register('terms')}
              rows={4}
              placeholder="Enter partnership terms and conditions..."
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            {errors.terms && (
              <p className="mt-1 text-sm text-red-500">{errors.terms.message}</p>
            )}
          </div>
          
          <Input
            label="Duration (months)"
            type="number"
            {...register('duration')}
            placeholder="12"
            error={errors.duration?.message}
          />
        </form>
      </Modal>

      {/* Action Confirmation Modal (Accept, Reject, Cancel) */}
      <Modal
        isOpen={actionModal.isOpen}
        onClose={closeActionModal}
        title={actionTitle}
        footer={
          <>
            <Button variant="secondary" onClick={closeActionModal}>
              Cancel
            </Button>
            <Button 
              onClick={executeAction} 
              loading={loading}
              variant={actionModal.type === 'accept' ? 'success' : actionModal.type === 'cancel' ? 'danger' : 'primary'}
            >
              {actionModal.type === 'accept' ? 'Yes, Accept' : actionModal.type === 'cancel' ? 'Yes, Cancel' : 'Confirm Rejection'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-gray-700">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
            Are you sure you want to **{actionModal.type}** the partnership request 
            {currentActionCollab && (
              <>
                {' '}from <strong>{currentActionCollab.hospital_name || currentActionCollab.hospitalName || 'Unknown Hospital'}</strong> 
                to <strong>{currentActionCollab.fleet_name || currentActionCollab.fleetName || 'Unknown Fleet'}</strong>
              </>
            )}?
            This action cannot be undone.
          </p>
          
          {actionModal.type === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
                Rejection Reason (Required)
              </label>
              <textarea
                value={actionModal.reason}
                onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
                placeholder="Explain why you are rejecting this collaboration..."
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
