import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Activity,
  Clock,
  MapPin,
  User,
  Ambulance as AmbulanceIcon,
  Building2,
  Heart,
  FileText,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Navigation,
  Shield,
  Download,
  Pill
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { sessionService } from '../../services';
import { useToast } from '../../hooks/useToast';

export default function SessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const response = await sessionService.getById(sessionId);
      const sessionData = response.data?.data?.session;
      setSession(sessionData);
      setMetadata(sessionData?.metadata || null);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      toast.error('Failed to load session details');
    } finally {
      setLoading(false);
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
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-secondary mb-1">{label}</p>
        <p className="text-sm font-medium text-text break-words">{value || 'N/A'}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-secondary">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <XCircle className="w-16 h-16 text-error mb-4" />
        <h2 className="text-2xl font-bold mb-2">Session Not Found</h2>
        <p className="text-secondary mb-4">The requested session could not be found.</p>
        <Button onClick={() => navigate('/sessions')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate('/sessions')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-display font-bold">Session Details</h1>
            <p className="text-secondary mt-1">Session Code: <span className="font-mono font-semibold text-primary">{session.session_code}</span></p>
          </div>
        </div>
        <div>
          {getStatusBadge(session.status)}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Information */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Patient Information</h2>
              <p className="text-xs text-secondary">Snapshot at session time</p>
            </div>
          </div>
          
          {metadata?.patient ? (
            <div className="space-y-0">
              <InfoRow label="Name" value={`${metadata.patient.first_name} ${metadata.patient.last_name}`} />
              <InfoRow label="Age" value={metadata.patient.age} />
              <InfoRow label="Gender" value={metadata.patient.gender} />
              <InfoRow label="Blood Group" value={metadata.patient.blood_group} />
              <InfoRow label="Allergies" value={metadata.patient.allergies || 'None reported'} />
              <InfoRow label="Medical History" value={metadata.patient.medical_history || 'None reported'} />
              <InfoRow label="Current Medications" value={metadata.patient.current_medications || 'None reported'} />
            </div>
          ) : (
            <div className="space-y-0">
              <InfoRow label="Name" value={`${session.patient_first_name} ${session.patient_last_name}`} />
              <InfoRow label="No detailed metadata" value="Session was not offboarded with full metadata capture" />
            </div>
          )}
        </Card>

        {/* Ambulance & Crew */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AmbulanceIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Ambulance & Crew</h2>
              <p className="text-xs text-secondary">Vehicle and personnel details</p>
            </div>
          </div>
          
          {metadata?.ambulance && (
            <div className="space-y-4">
              <div className="space-y-0 pb-4 border-b border-border">
                <InfoRow label="Ambulance Code" value={metadata.ambulance.ambulance_code} />
                <InfoRow label="Registration" value={metadata.ambulance.registration_number} />
                <InfoRow label="Model" value={metadata.ambulance.vehicle_model} />
                <InfoRow label="Type" value={metadata.ambulance.vehicle_type} />
                {metadata.ambulance.owner_organization && (
                  <InfoRow 
                    label="Owner Organization" 
                    value={`${metadata.ambulance.owner_organization.name} (${metadata.ambulance.owner_organization.type})`} 
                  />
                )}
              </div>

              {metadata.crew && (
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Crew Members
                  </h3>
                  
                  {metadata.crew.doctors && metadata.crew.doctors.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-secondary mb-2">Doctors</p>
                      {metadata.crew.doctors.map((doc) => (
                        <div key={doc.id} className="text-sm px-3 py-1.5 bg-blue-50 rounded-lg mb-1">
                          {doc.first_name} {doc.last_name}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {metadata.crew.paramedics && metadata.crew.paramedics.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-secondary mb-2">Paramedics</p>
                      {metadata.crew.paramedics.map((para) => (
                        <div key={para.id} className="text-sm px-3 py-1.5 bg-green-50 rounded-lg mb-1">
                          {para.first_name} {para.last_name}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {metadata.crew.drivers && metadata.crew.drivers.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-secondary mb-2">Drivers</p>
                      {metadata.crew.drivers.map((driver) => (
                        <div key={driver.id} className="text-sm px-3 py-1.5 bg-purple-50 rounded-lg mb-1">
                          {driver.first_name} {driver.last_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Timeline & Organizations */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Timeline</h2>
              <p className="text-xs text-secondary">Session chronology</p>
            </div>
          </div>
          
          {metadata?.timeline ? (
            <div className="space-y-0 mb-6">
              <InfoRow icon={Calendar} label="Onboarded At" value={formatDate(metadata.timeline.onboarded_at)} />
              <InfoRow icon={Calendar} label="Offboarded At" value={formatDate(metadata.timeline.offboarded_at)} />
              <InfoRow icon={Clock} label="Duration" value={`${metadata.timeline.duration_minutes} minutes`} />
              {metadata.timeline.estimated_arrival_time && (
                <InfoRow icon={Clock} label="Est. Arrival" value={formatDate(metadata.timeline.estimated_arrival_time)} />
              )}
              {metadata.timeline.actual_arrival_time && (
                <InfoRow icon={Clock} label="Actual Arrival" value={formatDate(metadata.timeline.actual_arrival_time)} />
              )}
            </div>
          ) : (
            <div className="space-y-0 mb-6">
              <InfoRow icon={Calendar} label="Onboarded At" value={formatDate(session.onboarded_at)} />
              <InfoRow icon={Calendar} label="Offboarded At" value={formatDate(session.offboarded_at)} />
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Organizations</h3>
            </div>
            {metadata?.organizations ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-secondary mb-1">Session Owner</p>
                  <p className="text-sm font-medium">{metadata.organizations.session_owner.name}</p>
                  <p className="text-xs text-secondary capitalize">{metadata.organizations.session_owner.type}</p>
                </div>
                {metadata.organizations.destination_hospital && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-secondary mb-1">Destination Hospital</p>
                    <p className="text-sm font-medium">{metadata.organizations.destination_hospital.name}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-secondary">No organization metadata available</div>
            )}
          </div>
        </Card>
      </div>

      {/* Location & Medical Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Locations */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Locations</h2>
              <p className="text-xs text-secondary">Pickup & destination details</p>
            </div>
          </div>
          
          {metadata?.locations ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">Pickup Location</p>
                </div>
                <p className="text-sm text-blue-800">{metadata.locations.pickup.address || 'N/A'}</p>
                {metadata.locations.pickup.latitude && metadata.locations.pickup.longitude && (
                  <p className="text-xs text-blue-600 mt-1">
                    {metadata.locations.pickup.latitude}, {metadata.locations.pickup.longitude}
                  </p>
                )}
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-900">Destination</p>
                </div>
                <p className="text-sm text-green-800">{metadata.locations.destination.address || 'N/A'}</p>
                {metadata.locations.destination.latitude && metadata.locations.destination.longitude && (
                  <p className="text-xs text-green-600 mt-1">
                    {metadata.locations.destination.latitude}, {metadata.locations.destination.longitude}
                  </p>
                )}
              </div>
              
              {metadata.locations.distance_km && (
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <p className="text-sm text-secondary mb-1">Total Distance</p>
                  <p className="text-2xl font-bold text-purple-900">{metadata.locations.distance_km} km</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-secondary">No location metadata available</div>
          )}
        </Card>

        {/* Medical Information */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Medical Information</h2>
              <p className="text-xs text-secondary">Assessment & treatment details</p>
            </div>
          </div>
          
          {metadata?.medical ? (
            <div className="space-y-0">
              <InfoRow label="Chief Complaint" value={metadata.medical.chief_complaint} />
              <InfoRow label="Initial Assessment" value={metadata.medical.initial_assessment} />
              <InfoRow label="Treatment Notes" value={metadata.medical.treatment_notes} />
              <InfoRow label="Outcome Status" value={metadata.medical.outcome_status} />
            </div>
          ) : (
            <div className="space-y-0">
              <InfoRow label="Chief Complaint" value={session.chief_complaint} />
              <InfoRow label="Initial Assessment" value={session.initial_assessment} />
              <InfoRow label="Treatment Notes" value={session.treatment_notes} />
              <InfoRow label="Outcome Status" value={session.outcome_status} />
            </div>
          )}
        </Card>
      </div>

      {/* Audit Trail */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <Shield className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Audit Trail</h2>
            <p className="text-xs text-secondary">User actions and system timestamps</p>
          </div>
        </div>
        
        {metadata?.users ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-3">Onboarded By</p>
              <div className="space-y-2">
                <p className="text-sm"><span className="text-secondary">Name:</span> <span className="font-medium">{metadata.users.onboarded_by.name}</span></p>
                <p className="text-sm"><span className="text-secondary">Email:</span> <span className="font-medium">{metadata.users.onboarded_by.email}</span></p>
                <p className="text-sm"><span className="text-secondary">Role:</span> <span className="font-medium capitalize">{metadata.users.onboarded_by.role}</span></p>
              </div>
            </div>
            
            {metadata.users.offboarded_by && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-semibold text-green-900 mb-3">Offboarded By</p>
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-secondary">Name:</span> <span className="font-medium">{metadata.users.offboarded_by.name}</span></p>
                  <p className="text-sm"><span className="text-secondary">Email:</span> <span className="font-medium">{metadata.users.offboarded_by.email}</span></p>
                  <p className="text-sm"><span className="text-secondary">Role:</span> <span className="font-medium capitalize">{metadata.users.offboarded_by.role}</span></p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-secondary">No audit trail metadata available for this session</div>
        )}

        {metadata?.audit && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-secondary mb-1">Created</p>
                <p className="text-sm font-medium">{formatDate(metadata.audit.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">Updated</p>
                <p className="text-sm font-medium">{formatDate(metadata.audit.updated_at)}</p>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">Offboarded</p>
                <p className="text-sm font-medium">{formatDate(metadata.audit.offboarded_at)}</p>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">Metadata Captured</p>
                <p className="text-sm font-medium">{formatDate(metadata.audit.metadata_captured_at)}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Session Data - Notes, Medications, Files */}
      {metadata?.session_data && (metadata.session_data.notes?.length > 0 || metadata.session_data.medications?.length > 0 || metadata.session_data.files?.length > 0) && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Session Data
            <span className="text-sm font-normal text-secondary ml-2">
              ({metadata.session_data.total_entries || 0} total entries)
            </span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notes Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="font-semibold text-text flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes
                </h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {metadata.session_data.counts?.notes || 0}
                </span>
              </div>
              
              {metadata.session_data.notes?.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metadata.session_data.notes.map((note, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-text mb-2">{note.content.text}</p>
                      <div className="text-xs text-secondary">
                        <p className="font-medium">{note.addedBy.name}</p>
                        <p>{note.addedBy.role}</p>
                        <p className="mt-1">{formatDate(note.addedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary py-4">No notes recorded</p>
              )}
            </div>

            {/* Medications Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="font-semibold text-text flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  Medications
                </h3>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  {metadata.session_data.counts?.medications || 0}
                </span>
              </div>
              
              {metadata.session_data.medications?.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metadata.session_data.medications.map((med, idx) => (
                    <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="font-medium text-text">{med.content.name}</p>
                      <p className="text-sm text-secondary mb-2">
                        {med.content.dosage} • {med.content.route}
                      </p>
                      <div className="text-xs text-secondary">
                        <p className="font-medium">{med.addedBy.name}</p>
                        <p>{med.addedBy.role}</p>
                        <p className="mt-1">{formatDate(med.content.time_administered || med.addedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary py-4">No medications recorded</p>
              )}
            </div>

            {/* Files Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="font-semibold text-text flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Files
                </h3>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                  {metadata.session_data.counts?.files || 0}
                </span>
              </div>
              
              {metadata.session_data.files?.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metadata.session_data.files.map((file, idx) => (
                    <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="flex items-start gap-2 mb-2">
                        <svg className="w-5 h-5 flex-shrink-0 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{file.content.filename}</p>
                          <p className="text-xs text-secondary">
                            {(file.content.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <a
                        href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/v\d+\/?$/, '')}${file.content.relativePath}`}
                        download
                        className="text-xs text-primary hover:underline flex items-center gap-1 mb-2"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                      <div className="text-xs text-secondary">
                        <p className="font-medium">{file.addedBy.name}</p>
                        <p>{file.addedBy.role}</p>
                        <p className="mt-1">{formatDate(file.addedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary py-4">No files uploaded</p>
              )}
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
