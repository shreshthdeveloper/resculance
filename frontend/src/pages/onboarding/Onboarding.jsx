import { useState, useEffect } from 'react';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import Select from '../../components/ui/Select';
import {
  Activity,
  Ambulance as AmbulanceIcon,
  Eye,
  UserPlus,
  Search,
  Power,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { patientService, ambulanceService, organizationService, collaborationService } from '../../services';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';

export const Onboarding = () => {
  const navigate = useNavigate();
  const [ambulances, setAmbulances] = useState([]);
  const [partneredAmbulances, setPartneredAmbulances] = useState([]);
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [partneredHospitals, setPartneredHospitals] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [orgTypeFilter, setOrgTypeFilter] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedOrgInfo, setSelectedOrgInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedAmbulance, setSelectedAmbulance] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [inlineNewPatientMode, setInlineNewPatientMode] = useState(false);
  const [inlineNewPatientName, setInlineNewPatientName] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [destinationHospitalId, setDestinationHospitalId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const runWithLoader = useWithGlobalLoader();

  // Offboard confirmation modal state
  const [showOffboardModal, setShowOffboardModal] = useState(false);
  const [offboardTarget, setOffboardTarget] = useState(null);
  const [offboardSession, setOffboardSession] = useState(null); // Store the actual session
  const [sessionsByAmbulance, setSessionsByAmbulance] = useState({}); // ambulanceId -> session or null

  // Determine if current context is hospital or fleet
  const isHospitalContext = user?.role === 'superadmin' 
    ? selectedOrgInfo?.type === 'hospital'
    : user?.organizationType === 'hospital';
  
  const isFleetContext = user?.role === 'superadmin'
    ? selectedOrgInfo?.type === 'fleet_owner'
    : user?.organizationType === 'fleet_owner';

  useEffect(() => {
    fetchOrganizations();
    fetchHospitals();
  }, []);

  // Offboard handler for table (must be top-level, not inside useEffect)
  const handleOffboardFromTable = async (row) => {
    try {
      // Fetch the active session for this ambulance
      // Request the most recent session for this ambulance (don't pass status='active' —
      // that mixes ambulance and session concepts). This matches the `View` flow which
      // fetches the latest session without status filter.
      const response = await patientService.getAllSessions({
        ambulanceId: row.id,
        limit: 1,
        _ts: Date.now()
      });
      
      const sessions = response.data?.data?.sessions || 
                      response.data?.sessions || 
                      response.data?.data || 
                      (Array.isArray(response.data) ? response.data : []);

      const hasSessionFlag = response.data?.data?.hasSession || response.data?.hasSession || false;

      // If server indicates a session exists but it's redacted for this user, inform them
      if ((Array.isArray(sessions) && sessions.length === 0) && hasSessionFlag) {
        toast.error('This ambulance has an active session but you do not have permission to view it');
        return;
      }

      if (!Array.isArray(sessions) || sessions.length === 0 || !sessions[0].id) {
        toast.error('No active session found for this ambulance');
        return;
      }

      setOffboardTarget(row);
      setOffboardSession(sessions[0]); // Store the session
      setShowOffboardModal(true);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      toast.error('Failed to load session details');
    }
  };

  const handleConfirmOffboard = async () => {
    if (!offboardTarget || !offboardSession) return;
    
    setSubmitting(true);
    try {
      await patientService.offboard(offboardSession.id, { treatmentNotes: 'Patient offboarded from table view' });
      toast.success('Patient offboarded successfully');
      // Refresh ambulances and patients
      await fetchAmbulances();
      await fetchPatients();
    } catch (error) {
      console.error('Failed to offboard patient:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || 'Failed to offboard patient';
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setShowOffboardModal(false);
      setOffboardTarget(null);
      setOffboardSession(null);
    }
  };

  const handleCancelOffboard = () => {
    setShowOffboardModal(false);
    setOffboardTarget(null);
    setOffboardSession(null);
  };

  useEffect(() => {
    // Fetch ambulances and patients when organization is selected
    const doFetch = async () => {
      setAmbulances([]);
      setPatients([]);
      await runWithLoader(async () => {
        if (user?.role === 'superadmin') {
          if (selectedOrgId) {
            await fetchAmbulances();
            await fetchPatients();
            // Fetch partnered hospitals if fleet context
            if (isFleetContext) {
              await fetchPartneredHospitals();
            }
          }
        } else {
          await fetchAmbulances();
          await fetchPatients();
          // Fetch partnered hospitals if fleet context
          if (isFleetContext) {
            await fetchPartneredHospitals();
          }
        }
      }, 'Loading ambulances...');
    };

    doFetch().catch((err) => {
      console.error('Error fetching data', err);
    });
  }, [selectedOrgId, user, isFleetContext]);

  const fetchOrganizations = async () => {
    try {
      const resp = await organizationService.getAll();
      const raw = resp.data?.data?.organizations || resp.data?.organizations || resp.data || [];
      const normalized = raw.map(org => ({
        ...org,
        type: (org.type || '').toString().toLowerCase(),
        name: org.name || org.organization_name,
        code: org.code || org.organization_code
      }));
      setOrganizations(normalized);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      toast.error('Failed to load organizations');
    }
  };

  const fetchHospitals = async () => {
    try {
      // NOTE: Org `type` is stored lowercase in the DB (Mongoose enum is
      // ['hospital', 'fleet_owner', 'superadmin']). The previous code sent
      // `type: 'HOSPITAL'` (a leftover from the MySQL backend, which compared
      // strings case-insensitively). Mongo treats it as a literal mismatch
      // and returns zero docs, which then makes `partneredHospitals` empty
      // even when partnerships exist.
      const resp = await organizationService.getAll({ type: 'hospital' });
      const raw = resp.data?.data?.organizations || resp.data?.organizations || resp.data || [];
      setHospitals(raw);
      return raw;
    } catch (error) {
      console.error('Failed to fetch hospitals:', error);
      return [];
    }
  };

  const fetchPartneredHospitals = async () => {
    try {
      // For fleet owner, fetch their active partnerships and extract hospitals
      const userOrgId = user?.role === 'superadmin' ? selectedOrgId : user?.organizationId;
      if (!userOrgId) return;

      console.log('🏥 Fetching partnered hospitals for fleet org:', userOrgId);

      // Ensure we have the hospitals list (with city/state etc. for the
      // dropdown label). `hospitals` state may not have populated yet on the
      // first render, so re-fetch synchronously when empty.
      let hospitalsList = hospitals;
      if (!hospitalsList || hospitalsList.length === 0) {
        hospitalsList = await fetchHospitals();
      }

      console.log('🏥 All hospitals available:', hospitalsList.map(h => `${h.id}:${h.name}`));

      // Read partnerships from the Partnership model directly via the
      // dedicated endpoint — this is the authoritative source. For non-
      // superadmin fleet users the backend already scopes results to their
      // org. Superadmin gets all partnerships, so we filter by the selected
      // fleet org client-side.
      let partnerships = [];
      try {
        const partResp = await collaborationService.getMyPartnerships();
        partnerships = partResp.data?.data?.partnerships || partResp.data?.partnerships || [];
      } catch (e) {
        // Fall back to deriving from approved CollaborationRequests if the
        // partnerships endpoint isn't reachable for some reason.
        console.warn('🏥 partnerships/my endpoint failed, falling back to collaborations:', e?.message);
        const resp = await collaborationService.getAll({ status: 'approved' });
        const collabData = resp.data?.data?.requests || resp.data?.requests || resp.data || [];
        partnerships = collabData
          .filter(c => (c.status || c.request_status || '').toLowerCase() === 'approved')
          .map(c => ({
            fleet_id: c.fleet_id || c.fleetId,
            hospital_id: c.hospital_id || c.hospitalId,
            status: 'active'
          }));
      }

      console.log('🏥 Partnerships fetched:', partnerships);

      // Pull the hospital id out of a partnership row. The Partnership
      // endpoint populates fleet_id/hospital_id as nested objects; the
      // fallback path produces flat string ids. Handle both.
      const extractId = (ref) => {
        if (!ref) return null;
        if (typeof ref === 'string') return ref;
        return String(ref._id || ref.id || ref);
      };

      const hospitalIds = partnerships
        .filter(p => {
          const status = (p.status || '').toLowerCase();
          if (status && status !== 'active' && status !== 'approved') return false;
          const fleetId = extractId(p.fleet_id || p.fleetId);
          return String(fleetId) === String(userOrgId);
        })
        .map(p => extractId(p.hospital_id || p.hospitalId))
        .filter(Boolean);

      console.log('🏥 Found partnered hospital IDs:', hospitalIds);

      const normalizedHospitalIds = hospitalIds.map(id => String(id));
      const partnered = (hospitalsList || []).filter(h => normalizedHospitalIds.includes(String(h.id)));
      console.log('🏥 Partnered hospitals:', partnered.map(h => h.name));
      setPartneredHospitals(partnered);
    } catch (error) {
      console.error('Failed to fetch partnered hospitals:', error);
      setPartneredHospitals([]);
    }
  };

  const fetchAmbulances = async () => {
    setLoading(true);
    try {
      console.log('🚑 User context:', { role: user?.role, orgId: user?.organizationId, orgType: user?.organizationType });
      
      const params = {};
      if (user?.role === 'superadmin') {
        if (selectedOrgId) params.organizationId = selectedOrgId;
        else {
          console.log('⚠️ Superadmin without selected org - skipping fetch');
          setLoading(false);
          return;
        }
      } else {
        params.organizationId = user?.organizationId;
      }

      console.log('🚑 Fetching ambulances with params:', params);
      const response = await ambulanceService.getAll(params);
      const data = response.data?.data?.ambulances || response.data?.ambulances || response.data?.data || response.data || [];
      console.log('🚑 Fetched ambulances:', data.length);
      const arr = Array.isArray(data) ? data : [];
      setAmbulances(arr);

      // Preload sessions for ambulances that have an in-progress session state so we can determine
      // action availability and show outbound notices. Treat 'active', 'onboarded', and 'in_transit'
      // as in-progress states.
      const inProgressStates = ['active', 'onboarded', 'in_transit'];
      const activeAmbIds = arr.filter(a => inProgressStates.includes((a.status || '').toString().toLowerCase())).map(a => a.id);
      if (activeAmbIds.length > 0) {
        await Promise.all(activeAmbIds.map(id => fetchSessionForAmbulance(id)));
      }

      // For HOSPITAL context, also fetch partnered fleet ambulances
      if (isHospitalContext) {
        console.log('🏥 Hospital context - also fetching partnered fleet ambulances');
        await fetchPartneredAmbulances();
      }
      // For FLEET context, do NOT fetch partnered hospital ambulances (fleets can't use hospital ambulances)
    } catch (error) {
      console.error('❌ Failed to fetch ambulances:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error('Failed to load ambulances');
      setAmbulances([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartneredAmbulances = async () => {
    try {
      const userOrgId = user?.role === 'superadmin' ? selectedOrgId : user?.organizationId;
      if (!userOrgId) return;
      
      console.log('🚑 Fetching partnered ambulances for hospital org:', userOrgId);
      
      // For hospitals (and superadmin acting on behalf of a hospital) the backend
      // exposes a partnered view via ?partnered=true&hospitalId={id}
      // This will fetch ambulances from fleets that have active partnerships with this hospital
      const partneredResp = await ambulanceService.getAll({ partnered: 'true', hospitalId: userOrgId });
      const allPartnered = partneredResp.data?.data?.ambulances || partneredResp.data?.ambulances || partneredResp.data || [];
      console.log('🚑 Fetched partnered ambulances:', allPartnered.length, allPartnered.map(a => `${a.id}:${a.registration_number}:org${a.organization_id}`));

      // Group by fleet organization id
      const grouped = {};
      (allPartnered || []).forEach(a => {
        const fid = a.organization_id || a.organizationId || a.organization || null;
        const key = fid ? String(fid) : 'unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
      });

      const partneredAmbulancesByFleet = Object.keys(grouped).map(fid => {
        const fleetId = fid === 'unknown' ? null : fid;
        // Use the organization_name returned from backend (already joined in the query)
        const firstAmb = grouped[fid][0];
        const fleetName = firstAmb?.organization_name || (organizations.find(o => String(o.id) === String(fleetId))?.name) || (fleetId ? `Fleet ${fleetId}` : 'Unknown Fleet');
        return {
          fleetId,
          fleetName,
          ambulances: grouped[fid]
        };
      });

      console.log('🚑 Partnered ambulances grouped by fleet:', partneredAmbulancesByFleet);
      setPartneredAmbulances(partneredAmbulancesByFleet);

      // Preload sessions for partnered ambulances that are in-progress so the UI can show
      // outbound notices for hospital users. Use the same in-progress states as above.
      const inProgressStates = ['active', 'onboarded', 'in_transit'];
      const partneredActiveIds = (allPartnered || []).filter(a => inProgressStates.includes((a.status || '').toString().toLowerCase())).map(a => a.id);
      if (partneredActiveIds.length > 0) {
        await Promise.all(partneredActiveIds.map(id => fetchSessionForAmbulance(id)));
      }
    } catch (error) {
      console.error('Failed to fetch partnered ambulances:', error);
      setPartneredAmbulances([]);
    }
  };

  const fetchSessionForAmbulance = async (ambulanceId) => {
    try {
      const resp = await patientService.getAllSessions({ ambulanceId, limit: 1, _ts: Date.now() });
      const sessions = resp.data?.data?.sessions || resp.data?.sessions || resp.data?.data || (Array.isArray(resp.data) ? resp.data : []);
      const hasSessionFlag = resp.data?.data?.hasSession || resp.data?.hasSession || false;

      // If server indicates a session exists but the details are omitted for this user,
      // store a sentinel so the UI can show an outbound/limited-access notice.
      if ((Array.isArray(sessions) && sessions.length === 0) && hasSessionFlag) {
        const sentinel = { redacted: true, hasSession: true };
        setSessionsByAmbulance(prev => ({ ...prev, [ambulanceId]: sentinel }));
        return sentinel;
      }

      const session = Array.isArray(sessions) && sessions.length > 0 ? sessions[0] : null;
      setSessionsByAmbulance(prev => ({ ...prev, [ambulanceId]: session }));
      return session;
    } catch (e) {
      console.error('Failed to fetch session for ambulance', ambulanceId, e);
      setSessionsByAmbulance(prev => ({ ...prev, [ambulanceId]: null }));
      return null;
    }
  };

  const fetchPatients = async () => {
    try {
      const params = {};
      if (user?.role === 'superadmin') {
        if (selectedOrgId) params.organizationId = selectedOrgId;
        else return;
      } else {
        params.organizationId = user?.organizationId;
      }

      // **BLAZING FAST DENORMALIZED QUERY**: Get only available patients (no joins, no filtering)
      const response = await patientService.getAvailable(params);
      const patientsData = response.data?.data?.patients || response.data?.patients || response.data || [];
      
      // All patients from this endpoint are guaranteed to be available for onboarding
      const patientsWithStatus = patientsData.map((patient) => ({
        ...patient,
        isOnboarded: false // By definition, these are all available
      }));

      setPatients(patientsWithStatus);
    } catch (error) {
      console.error('Failed to fetch available patients:', error);
      toast.error('Failed to load patients');
    }
  };

  const handleOpenPatientModal = (ambulance) => {
    // **SECURITY CHECK**: Prevent opening modal for ambulances that are inactive, already active or have an active onboarding
    if (ambulance?.status === 'inactive') {
      toast.error('This ambulance is inactive and cannot be used for onboarding');
      return;
    }
    if (ambulance?.status === 'active') {
      toast.info('This ambulance is currently active or already has an active onboarding');
      return;
    }
    setSelectedAmbulance(ambulance);
    setSelectedPatient(null);
    
    // Auto-set destination hospital for hospital context
    if (isHospitalContext) {
      const hospitalId = user?.role === 'superadmin' ? selectedOrgId : user?.organizationId;
      setDestinationHospitalId(hospitalId);
    } else {
      setDestinationHospitalId('');
    }
    
    setShowPatientModal(true);
  };

  const handleClosePatientModal = () => {
    setShowPatientModal(false);
    setSelectedAmbulance(null);
    setSelectedPatient(null);
    setDestinationHospitalId('');
  };

  const handleOnboardPatient = async () => {
    if (!selectedPatient || !selectedAmbulance || !destinationHospitalId) {
      toast.error('Please select a patient and destination hospital');
      return;
    }

    setSubmitting(true);
    try {
      const orgIdForOnboard = user?.role === 'superadmin' ? selectedOrgId : user?.organizationId;
      
      const resp = await patientService.onboard(selectedPatient, {
        ambulanceId: selectedAmbulance.id,
        destinationHospitalId: destinationHospitalId,
        organizationId: orgIdForOnboard,
      });

      // Try to extract the created session from response
      const createdSession = resp.data?.data?.session || resp.data?.session || resp.data || null;

      toast.success('Patient onboarded successfully');
      handleClosePatientModal();

      // Refresh ambulances and patients lists to show updated status
      await fetchAmbulances();
      await fetchPatients();
    } catch (error) {
      console.error('Failed to onboard patient:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || 'Failed to onboard patient';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewOnboarding = async (ambulance) => {
    console.log('🔍 Viewing onboarding for ambulance:', ambulance);
    console.log('🔍 Ambulance status:', ambulance.status);
    console.log('🔍 Ambulance ID:', ambulance.id);
    
    // If ambulance status is 'active', fetch the active session
    // Note: Session status can be 'onboarded' or 'in_transit', but we search without status filter
    // and just get the most recent session for this ambulance
    if (ambulance.status === 'active') {
      try {
        console.log('📡 Fetching session with params:', { ambulanceId: ambulance.id, limit: 1 });
        const response = await patientService.getAllSessions({
          ambulanceId: ambulance.id,
          limit: 1
        });
        
        console.log('📡 Session API response:', response);
        console.log('📡 Response.data:', response.data);
        
        // Try multiple response structures
        const sessions = response.data?.data?.sessions || 
                        response.data?.sessions || 
                        response.data?.data || 
                        (Array.isArray(response.data) ? response.data : []);
        
        console.log('📡 Extracted sessions:', sessions);
        
        if (sessions.length > 0 && sessions[0].id) {
          console.log('✅ Found active session ID:', sessions[0].id);
          navigate(`/onboarding/${sessions[0].id}`);
        } else {
          console.error('❌ No active session found despite ambulance status being active');
          console.error('❌ Sessions array:', sessions);
          console.error('❌ Full response:', JSON.stringify(response, null, 2));
          toast.error('Could not find active session. Please refresh the page.');
        }
      } catch (error) {
        console.error('❌ Failed to fetch active session:', error);
        console.error('❌ Error response:', error.response?.data);
        toast.error('Failed to load session details');
      }
    } else {
      console.warn('⚠️ Ambulance status is not active:', ambulance.status);
      toast.info('No active onboarding for this ambulance');
    }
  };

  // Filter patients that are not currently onboarded
  const availablePatients = patients.filter(p => !p.isOnboarded);
  
  // Filter ambulances based on search
  const filteredAmbulances = (Array.isArray(ambulances) ? ambulances : []).filter(amb => 
    (amb.registration_number || amb.vehicleNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (amb.vehicle_model || amb.vehicleModel || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      header: 'Ambulance',
      accessor: 'registration_number',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <AmbulanceIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium">{row.registration_number || row.vehicleNumber || 'N/A'}</p>
            <p className="text-sm text-secondary">{row.vehicle_model || row.vehicleModel}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'vehicle_type',
      render: (row) => (
        <span className="text-sm">{row.vehicle_type || row.vehicleType}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          row.status === 'active' ? 'bg-green-100 text-green-800' :
          row.status === 'available' ? 'bg-blue-100 text-blue-800' :
          row.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {row.status || 'Unknown'}
        </span>
      ),
    },
    {
      header: 'Onboarding Status',
      render: (row) => (
        <div>
          {row.status === 'active' ? (
            <span className="text-sm text-green-600 font-medium">Active Onboarding</span>
          ) : (
            <span className="text-sm text-gray-500">No Active Onboarding</span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      render: (row) => {
        const isInactive = row.status === 'inactive';
        const isActive = row.status === 'active';
        
        return (
          <div className="flex items-center gap-2">
            {/* **SECURITY**: Disable all actions for inactive ambulances */}
            {isInactive ? (
              <span className="text-xs text-gray-400 italic">Ambulance Inactive</span>
            ) : (
              <>
                {/* Only show onboard if ambulance is available */}
                {!isActive && (
                  <Button 
                    size="sm" 
                    variant="primary"
                    onClick={() => handleOpenPatientModal(row)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Onboard Patient
                  </Button>
                )}

                {isActive && (() => {
                  const session = sessionsByAmbulance[row.id];
                  // While session is being loaded, show a small loader (or disable actions)
                  if (session === undefined) {
                    return <span className="text-sm text-gray-400">Loading...</span>;
                  }

                  // If there is no active session data, show informational text
                  if (!session) {
                    return <span className="text-sm text-gray-500">No active session</span>;
                  }

                  // If the session was redacted for this user (server indicated a session exists
                  // but didn't return details), show the outbound/limited-access notice.
                  if (session && session.redacted) {
                    return <span className="text-sm text-yellow-700">This ambulance is outbound for a different hospital.</span>;
                  }

                  // For hospital users: deny view/offboard if destination is a different hospital
                  const userOrgId = user?.role === 'superadmin' ? selectedOrgId : user?.organizationId;
                  const sessionDestination = session.destination_hospital_id || session.destinationHospitalId;
                  const sessionOwnerOrg = session.organization_id || session.organizationId;

                  // Determine if current user is part of the assigned crew for this session
                  const crew = session.crew || [];
                  const isAssignedCrew = Array.isArray(crew) && crew.some(c => String(c.id) === String(user?.id));

                  // Fleet owners who own the ambulance are allowed
                  const ambulanceOwnerOrg = row.organization_id || row.organizationId;
                  const isFleetOwner = user?.organizationType === 'fleet_owner' && String(ambulanceOwnerOrg) === String(userOrgId);

                  const hospitalDenied = isHospitalContext && sessionDestination && String(sessionDestination) !== String(userOrgId) && String(sessionOwnerOrg) !== String(userOrgId) && !isAssignedCrew;

                  if (hospitalDenied) {
                    return <span className="text-sm text-yellow-700">This ambulance is outbound for a different hospital.</span>;
                  }

                  // Otherwise show View/Offboard
                  return (
                    <>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleViewOnboarding(row)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleOffboardFromTable(row)}
                        className="ml-1"
                      >
                        <Power className="w-4 h-4 mr-1" />
                        Offboard
                      </Button>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold mt-5 mb-2">Patient Onboarding</h1>
        <p className="text-secondary">Select an ambulance and onboard patients</p>
      </div>

      {/* Organization Selector (for superadmin) */}
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
              />
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      {((user?.role === 'superadmin' && selectedOrgId) || user?.role !== 'superadmin') && (
        <>
          <Card>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                  type="text"
                  placeholder="Search ambulances..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-12"
                />
              </div>
            </div>
          </Card>

          {/* Ambulances Table */}
          {loading ? (
            <Card className="p-8 text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-secondary">Loading ambulances...</p>
            </Card>
          ) : filteredAmbulances.length === 0 && partneredAmbulances.length === 0 ? (
            <Card className="p-8 text-center">
              <AmbulanceIcon className="w-12 h-12 mx-auto mb-4 text-secondary opacity-50" />
              <p className="text-secondary">No ambulances found</p>
            </Card>
          ) : (
            <>
              {/* Own Organization Ambulances */}
              {filteredAmbulances.length > 0 && (
                <div>
                  {isHospitalContext && (
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px bg-gray-300 flex-1"></div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        {selectedOrgInfo?.name || 'Your Hospital'} Ambulances
                      </h3>
                      <div className="h-px bg-gray-300 flex-1"></div>
                    </div>
                  )}
                  <Table
                    columns={columns}
                    data={filteredAmbulances}
                    onRefresh={() => { if (user?.role === 'superadmin' && !selectedOrgId) { toast.info('Please select an organization first'); } else fetchAmbulances(true); }}
                    isRefreshing={loading}
                  />
                </div>
              )}

              {/* Partnered Fleet Ambulances (for hospital context) */}
              {isHospitalContext && partneredAmbulances.length > 0 && partneredAmbulances.map(fleetGroup => (
                <div key={fleetGroup.fleetId} className="mt-6">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-px bg-teal-300 flex-1"></div>
                    <h3 className="text-sm font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-2">
                      <AmbulanceIcon className="w-4 h-4" />
                      {fleetGroup.fleetName} (Partner)
                    </h3>
                    <div className="h-px bg-teal-300 flex-1"></div>
                  </div>
                  <Table
                    columns={columns}
                    data={fleetGroup.ambulances.filter(amb => 
                      (amb.registration_number || amb.vehicleNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (amb.vehicle_model || amb.vehicleModel || '').toLowerCase().includes(searchTerm.toLowerCase())
                    )}
                    onRefresh={() => fetchPartneredAmbulances()}
                  />
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Offboard Confirmation Modal */}
      <Modal
        isOpen={showOffboardModal}
        onClose={handleCancelOffboard}
        title="Confirm Patient Offboarding"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancelOffboard}>
              Cancel
            </Button>
            <Button 
              variant="danger" 
              loading={submitting} 
              onClick={handleConfirmOffboard}
            >
              Yes, Offboard Patient
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
              <Power className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Offboard Patient</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                This action will complete the patient session and mark it as offboarded.
              </p>
            </div>
          </div>

          {offboardTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-xs text-secondary mb-1">Ambulance</p>
                  <p className="font-medium">{offboardTarget.registration_number || offboardTarget.vehicleNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary mb-1">Session Code</p>
                  <p className="font-medium">{offboardSession?.session_code || offboardSession?.sessionCode || 'N/A'}</p>
                </div>
              </div>

              <div className="text-sm text-secondary">
                <p>Are you sure you want to offboard this patient? This action cannot be undone.</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Patient Selection Modal */}
      <Modal
        isOpen={showPatientModal}
        onClose={handleClosePatientModal}
        title="Onboard Patient"
        footer={
          <>
            <Button variant="secondary" onClick={handleClosePatientModal}>
              Cancel
            </Button>
            <Button loading={submitting} onClick={handleOnboardPatient}>
              Onboard Patient
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Ambulance:</strong> {selectedAmbulance?.registration_number || selectedAmbulance?.vehicleNumber || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select Patient * <span className="text-xs text-secondary">(or create new)</span></label>
            <div>
              <div>
                <Select
                  placeholder="Select a patient to onboard"
                  options={availablePatients.map(p => ({
                    value: p.id,
                    label: `${p.firstName || p.first_name} ${p.lastName || p.last_name} - ${p.phone}`
                  }))}
                  value={selectedPatient ? {
                    value: selectedPatient,
                    label: availablePatients.find(p => p.id === selectedPatient)
                      ? `${availablePatients.find(p => p.id === selectedPatient)?.firstName || availablePatients.find(p => p.id === selectedPatient)?.first_name} ${availablePatients.find(p => p.id === selectedPatient)?.lastName || availablePatients.find(p => p.id === selectedPatient)?.last_name}`
                      : ''
                  } : null}
                  onChange={(opt) => setSelectedPatient(opt?.value || null)}
                  classNamePrefix="react-select"
                  isDisabled={inlineNewPatientMode}
                />
              </div>

              <div className="mt-3">
                {!inlineNewPatientMode ? (
                  <Button size="sm" variant="outline" onClick={() => { setInlineNewPatientMode(true); setInlineNewPatientName(''); setSelectedPatient(null); }}>
                    New Patient
                  </Button>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name *</label>
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="Enter patient name"
                        value={inlineNewPatientName}
                        onChange={(e) => setInlineNewPatientName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={async () => {
                        setInlineNewPatientMode(false);
                        setInlineNewPatientName('');
                      }}>
                        Cancel
                      </Button>
                      <Button size="sm" loading={inlineSaving} onClick={async () => {
                        const name = (inlineNewPatientName || '').trim();
                        if (!name) {
                          toast.error('Name is required to create a patient');
                          return;
                        }
                        const orgIdForCreate = user?.role === 'superadmin' ? selectedOrgId : user?.organizationId;
                        if (user?.role === 'superadmin' && !orgIdForCreate) {
                          toast.error('Please select an organization before creating a patient');
                          return;
                        }
                        setInlineSaving(true);
                        try {
                          const payload = { firstName: name, lastName: null };
                          if (orgIdForCreate) payload.organizationId = orgIdForCreate;
                          const resp = await patientService.create(payload);
                          const created = resp.data?.data?.patient || resp.data?.patient || resp.data || null;
                          const createdId = created?.id || created?.ID || created?.insertId || resp.data?.data?.patientId || null;
                          await fetchPatients();
                          setSelectedPatient(createdId || null);
                          setInlineNewPatientMode(false);
                          setInlineNewPatientName('');
                          toast.success('Patient created');
                        } catch (err) {
                          console.error('Failed to create patient inline:', err);
                          toast.error('Failed to create patient');
                        } finally {
                          setInlineSaving(false);
                        }
                      }}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {availablePatients.length === 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                No available patients. All patients are currently onboarded.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Destination Hospital *</label>
            {isHospitalContext ? (
              // Hospital context: destination is pre-set and read-only
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-900">
                  {hospitals.find(h => h.id === destinationHospitalId)?.name || selectedOrgInfo?.name || 'Current Hospital'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Destination is automatically set to your hospital
                </p>
              </div>
            ) : (
              // Fleet context: allow selection from partnered hospitals
              <>
                <Select
                  placeholder="Select destination hospital"
                  options={partneredHospitals.map(h => ({
                    value: h.id,
                    label: `${h.name} - ${h.city || 'N/A'}, ${h.state || 'N/A'}`
                  }))}
                  value={destinationHospitalId ? {
                    value: destinationHospitalId,
                    label: partneredHospitals.find(h => h.id === destinationHospitalId)?.name || ''
                  } : null}
                  onChange={(opt) => setDestinationHospitalId(opt?.value || '')}
                  classNamePrefix="react-select"
                />
                {partneredHospitals.length === 0 && (
                  <p className="mt-2 text-sm text-yellow-600">
                    No partnered hospitals available. Please establish partnerships first.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Onboarding;
