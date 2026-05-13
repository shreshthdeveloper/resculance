import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {  ArrowLeft,
  Video,
  MessageCircle,
  FileText,
  Pill,
  Trash2,
  Paperclip,
  Power,
  Info,
  MapPin,
  Mic,
  MicOff,
  VideoOff,
  Share2,
  PhoneOff
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import ChatPanel from '../../components/ChatPanel';
import VideoCallPanelJitsi from '../../components/VideoCallPanelJitsi';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { JITSI_CONFIG, generateRoomName } from '../../config/jitsiConfig';
import { patientService, ambulanceService, sessionService } from '../../services';
import socketService from '../../services/socketService';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import { CameraFeedModal } from './CameraFeedModal';
import { GPSLocationModal } from './GPSLocationModal';
import CameraCard from '../../components/onboarding/CameraCard';
import NewVitalsCard from '../../components/onboarding/NewVitalsCard';
import MedicalReportsCard from '../../components/onboarding/MedicalReportsCard';
import DevicesCard from '../../components/onboarding/DevicesCard';
import ControlsCard from '../../components/onboarding/ControlsCard';
import ControlsFooterBar from '../../components/onboarding/ControlsFooterBar';
import VehicleInfoModal from '../../components/onboarding/VehicleInfoModal';

export default function OnboardingDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, token } = useAuthStore();

  const [session, setSession] = useState(null);
  const [ambulance, setAmbulance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showInlineVideo, setShowInlineVideo] = useState(false);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  
  // Video call control states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const [controls, setControls] = useState({
    mainPower: false,
    emergencyLights: false,
    siren: false,
    airConditioning: false,
    oxygenSupply: false,
    cabinCamera: false,
  });

  // Session data state
  const [sessionData, setSessionData] = useState({ notes: [], medications: [], files: [], counts: {} });
  const [loadingData, setLoadingData] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', route: 'oral' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);
  const [loadingMedication, setLoadingMedication] = useState(false);

  // Confirmation modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showOffboardModal, setShowOffboardModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Mock vitals & sos for demo (replace with real data in production)
  const [vitals, setVitals] = useState({ heartRate: 98, bloodPressure: '120/78', spo2: 94, temp: 37.1 });
  const [sosAlerts, setSosAlerts] = useState([
    { id: 1012, time: '10:22', level: 'Critical', note: 'Patient seizure detected', action: 'Ack' },
    { id: 1011, time: '10:09', level: 'Warning', note: 'O2 below threshold', action: 'Ack' },
    { id: 1010, time: '09:55', level: 'Info', note: 'Door opened', action: 'Ack' },
  ]);

  const isActive = ['active', 'onboarded', 'in_transit'].includes((session?.status || '').toLowerCase());

  const inlineJitsiApiRef = useRef(null);
  const [inlineJitsiJoined, setInlineJitsiJoined] = useState(false);
  const [inlineJitsiLoading, setInlineJitsiLoading] = useState(false);

  const footerVisible = !(
    showCameraModal || showGPSModal || showChat || showVideoCall || showVehicleInfo || showDeleteModal || showOffboardModal || showInlineVideo
  );

  // Define fetchSessionData with useCallback before using it in effects
  const fetchSessionData = useCallback(async () => {
    if (!sessionId) return;
    console.log('🔄 Fetching session data for session:', sessionId);
    setLoadingData(true);
    try {
      const response = await sessionService.getData(sessionId);
      const data = response?.data?.data || response?.data || {};
      console.log('✅ Session data fetched:', data);
      setSessionData({
        notes: data.notes || [],
        medications: data.medications || [],
        files: data.files || [],
        counts: data.counts || { notes: 0, medications: 0, files: 0 }
      });
    } catch (error) {
      console.error('❌ Failed to fetch session data:', error);
      // Don't show error toast for initial load
    } finally {
      setLoadingData(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // connect sockets when token available
    if (token) {
      console.log('🔌 Connecting socket with token...');
      socketService.connect(token);
    }
    if (sessionId) {
      fetchSessionDetails();
      fetchSessionData();
      // Join the session room to receive socket events
      console.log('🔌 Joining session room:', sessionId);
      socketService.joinSession(sessionId);
      
      // Check socket connection status
      setTimeout(() => {
        if (socketService.socket?.connected) {
          console.log('✅ Socket is connected, ID:', socketService.socket.id);
        } else {
          console.warn('⚠️ Socket is not connected yet');
        }
      }, 1000);
    }

    return () => {
      // Leave the session room on component unmount
      if (sessionId) {
        console.log('🔌 Leaving session room:', sessionId);
        socketService.leaveSession(sessionId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  // cleanup for inline jitsi
  useEffect(() => {
    return () => {
      if (inlineJitsiApiRef.current) {
        try {
          inlineJitsiApiRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing Jitsi API', e);
        }
        inlineJitsiApiRef.current = null;
      }
    };
  }, []);

  // Listen for session data updates (no longer listen for video calls - video room model)
  useEffect(() => {
    // Set up a one-time listener to confirm we joined the session room
    const handleJoinedSession = (data) => {
      console.log('✅ Confirmed joined session room:', data);
    };
    
    socketService.on('joined_session', handleJoinedSession);

    const handleSessionDataAdded = (data) => {
      console.log('📩 Session data added event received:', data);
      console.log('📩 Current sessionId:', sessionId, 'Event sessionId:', data.sessionId);
      console.log('📩 Types - current:', typeof sessionId, 'event:', typeof data.sessionId);
      
      // Compare both as strings to handle type differences
      if (String(data.sessionId) === String(sessionId) || data.sessionId === parseInt(sessionId)) {
        console.log('✅ Session IDs match! Refreshing data...');
        // Re-fetch session data
        fetchSessionData();
      } else {
        console.log('❌ Session IDs do not match. No refresh.');
      }
    };

    const handleSessionDataDeleted = (data) => {
      console.log('🗑️ Session data deleted event received:', data);
      // Compare both as strings to handle type differences
      if (String(data.sessionId) === String(sessionId) || data.sessionId === parseInt(sessionId)) {
        console.log('✅ Session IDs match! Refreshing data...');
        // Re-fetch session data
        fetchSessionData();
      }
    };

    const handleSessionStatusUpdate = (data) => {
      console.log('📊 Session status update:', data);
      if (String(data.sessionId) === String(sessionId) || data.sessionId === parseInt(sessionId)) {
        setSession(prev => ({ ...prev, status: data.status }));
      }
    };

    const handleSessionEnded = (data) => {
      console.log('🛑 Session ended event received:', data);
      // Check if this event is for the current session
      if (String(data.sessionId) === String(sessionId) || data.sessionId === parseInt(sessionId)) {
        console.log('✅ This session has been ended. Redirecting to onboarding page...');
        toast.info(data.message || 'This session has been ended');
        // Small delay to allow user to see the message before redirect
        setTimeout(() => {
          navigate('/onboarding');
        }, 1500);
      }
    };

    console.log('🎧 Setting up socket listeners for session:', sessionId);
    socketService.on('session_data_added', handleSessionDataAdded);
    socketService.on('session_data_deleted', handleSessionDataDeleted);
    socketService.on('session_status_update', handleSessionStatusUpdate);
    socketService.onSessionEnded(handleSessionEnded);

    return () => {
      console.log('🎧 Cleaning up socket listeners for session:', sessionId);
      socketService.off('joined_session', handleJoinedSession);
      socketService.off('session_data_added', handleSessionDataAdded);
      socketService.off('session_data_deleted', handleSessionDataDeleted);
      socketService.off('session_status_update', handleSessionStatusUpdate);
      socketService.offSessionEnded(handleSessionEnded);
    };
  }, [sessionId, fetchSessionData]);

  async function fetchSessionDetails() {
    setLoading(true);
    try {
      const sessionRes = await patientService.getSessionById(sessionId);
      const sessionData = sessionRes?.data?.data?.session || sessionRes?.data?.session || sessionRes?.data;
      if (!sessionData || !sessionData.id) throw new Error('Session data not found or invalid');
      setSession(sessionData);

      const ambulanceId = sessionData.ambulance_id || sessionData.ambulanceId;
      if (ambulanceId) {
        try {
          const ambulanceRes = await ambulanceService.getById(ambulanceId);
          const ambulanceData = ambulanceRes?.data?.data?.ambulance || ambulanceRes?.data?.ambulance || ambulanceRes?.data;
          setAmbulance(ambulanceData || null);
        } catch (err) {
          console.error('Failed to fetch ambulance details:', err);
          setAmbulance(null);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    console.log('handleAddNote called with:', newNote);
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setLoadingNote(true);
    console.log('Calling sessionService.addNote...');
    try {
      const response = await sessionService.addNote(sessionId, { text: newNote });
      console.log('sessionService.addNote response:', response);
      setNewNote('');
      toast.success('Note added successfully');
      // Data will be refreshed via socket event
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error(error.response?.data?.message || 'Failed to add note');
    } finally {
      setLoadingNote(false);
    }
  }

  async function handleAddMedication() {
    console.log('handleAddMedication called with:', newMedication);
    if (!newMedication.name.trim() || !newMedication.dosage.trim()) {
      toast.error('Please enter medication name and dosage');
      return;
    }

    setLoadingMedication(true);
    console.log('Calling sessionService.addMedication...');
    try {
      const response = await sessionService.addMedication(sessionId, newMedication);
      console.log('sessionService.addMedication response:', response);
      setNewMedication({ name: '', dosage: '', route: 'oral' });
      toast.success('Medication added successfully');
      // Data will be refreshed via socket event
    } catch (error) {
      console.error('Failed to add medication:', error);
      toast.error(error.response?.data?.message || 'Failed to add medication');
    } finally {
      setLoadingMedication(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      await sessionService.uploadFile(sessionId, file);
      toast.success('File uploaded successfully');
      event.target.value = ''; // Reset file input
      // Data will be refreshed via socket event
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error(error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDeleteData(dataId) {
    // Find the data entry to show in modal
    const allData = [...sessionData.notes, ...sessionData.medications, ...sessionData.files];
    const dataEntry = allData.find(item => item.id === dataId);
    if (dataEntry) {
      setDeleteTarget(dataEntry);
      setShowDeleteModal(true);
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await sessionService.deleteData(sessionId, deleteTarget.id);
      toast.success('Entry deleted successfully');
      // Data will be refreshed via socket event
    } catch (error) {
      console.error('Failed to delete data:', error);
      toast.error(error.response?.data?.message || 'Failed to delete entry');
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  async function handleDownloadFile(dataId) {
    try {
      const response = await sessionService.downloadFile(sessionId, dataId);
      // Create a blob from the response data
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      // Get filename from content-disposition header or use a default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'download';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) filename = filenameMatch[1];
      }
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error(error.response?.data?.message || 'Failed to download file');
    }
  }

  async function handleOffboardPatient() {
    setShowOffboardModal(true);
  }

  const handleConfirmOffboard = async () => {
    try {
      await patientService.offboard(sessionId, { treatmentNotes: 'Patient offboarded from Command Console' });
      toast.success('Patient offboarded successfully');
      navigate('/onboarding');
    } catch (error) {
      console.error('Failed to offboard patient:', error);
      toast.error('Failed to offboard patient');
    } finally {
      setShowOffboardModal(false);
    }
  };

  const handleCancelOffboard = () => {
    setShowOffboardModal(false);
  };

  function toggleControl(controlName) {
    setControls(prev => ({ ...prev, [controlName]: !prev[controlName] }));
    toast.info(`${controlName.replace(/([A-Z])/g, ' $1').trim()} ${controls[controlName] ? 'disabled' : 'enabled'}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text mb-2">Session Not Found</h2>
          <p className="text-text-secondary mb-4">The requested session could not be found.</p>
          <Button onClick={() => navigate('/onboarding')}>Back to Sessions</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-background-card border-b border-border px-3 md:px-6 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/onboarding')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-sm md:text-base font-bold text-text">Ambulance Console</h1>
            <p className="text-xs text-text-secondary hidden md:block">Live • {session.ambulance_code || session.ambulanceCode || 'Unknown'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-lg bg-error/10 text-error text-xs font-medium flex items-center gap-1 md:gap-2">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            <span className="hidden sm:inline">{session.ambulance_code || 'AMB-204'}</span>
          </span>
          <span className="hidden md:flex px-2 py-1 rounded-lg bg-success/10 text-success text-xs font-medium">82% Battery</span>
          <span className="hidden lg:flex px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">On-duty</span>
          
          {/* Action Buttons - Icon Only */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setShowVehicleInfo(true)}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
              title="Vehicle Info"
            >
              <Info className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowGPSModal(true)}
              className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm"
              title="GPS Tracking"
            >
              <MapPin className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowChat(true)}
              className="p-2 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors shadow-sm"
              title="Group Chat"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowVideoCall(true)}
              className="p-2 rounded-lg bg-success hover:bg-green-700 text-white transition-colors shadow-sm"
              title="Video Call"
            >
              <Video className="w-4 h-4" />
            </button>
            
            {session.status?.toLowerCase() !== 'offboarded' && isActive && (
              <button
                onClick={handleOffboardPatient}
                className="p-2 rounded-lg bg-error hover:bg-red-700 text-white transition-colors shadow-sm"
                title="Offboard Patient"
              >
                <Power className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Layout - Responsive */}
      <div className="px-2 md:px-4 py-2 overflow-auto">
        <div className="grid grid-rows-auto gap-3 md:gap-4">
          {/* Top Row - Responsive: stacked on mobile, 4 cols on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Camera Feed - Takes 2 columns on large screens */}
            <div className="sm:col-span-2">
              <CameraCard
                session={session}
                ambulance={ambulance}
                isActive={isActive}
                onCameraClick={() => {
                  setShowCameraModal(true);
                }}
                onRefresh={fetchSessionDetails}
              />
            </div>
            
            {/* Video Call Panel (replaces GPS + SOS) */}
            <div className="sm:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-border overflow-hidden flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-border bg-white dark:bg-slate-800">
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                    <Video className="w-4 h-4" /> Video Call
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    <span>Room: {generateRoomName(sessionId)}</span>
                    <span>•</span>
                    <span>Participants: 0</span>
                  </div>
                  <button
                    onClick={() => setShowVideoCall(true)}
                    className="px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    Not connected
                  </button>
                </div>

                {/* Video Container */}
                <div className="flex-1 bg-slate-900 dark:bg-slate-950 relative min-h-[300px]">
                  {!showInlineVideo ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                      <p className="text-white text-lg font-semibold mb-2">Room: {generateRoomName(sessionId)}</p>
                      <p className="text-gray-400 text-sm mb-1">Participants: 0</p>
                      <button
                        onClick={() => setShowInlineVideo(true)}
                        className="mt-4 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-md font-medium"
                      >
                        Join Meeting
                      </button>
                      <p className="text-xs text-gray-400 mt-3">The meeting will only start when you click Join.</p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 w-full h-full">
                      {inlineJitsiLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/70">
                          <div className="text-center">
                            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm text-white">Connecting...</p>
                          </div>
                        </div>
                      )}
                      <JitsiMeeting
                        roomName={generateRoomName(sessionId)}
                        displayName={(user && `${user.firstName || ''} ${user.lastName || ''}`) || 'User'}
                        onApiReady={(api) => {
                          console.log('Inline Jitsi API ready');
                          inlineJitsiApiRef.current = api;
                          setInlineJitsiLoading(false);
                          api.addEventListener('videoConferenceJoined', () => setInlineJitsiJoined(true));
                          api.addEventListener('videoConferenceLeft', () => setInlineJitsiJoined(false));
                        }}
                        configOverwrite={JITSI_CONFIG.defaultConfig}
                        interfaceConfigOverwrite={JITSI_CONFIG.interfaceConfig}
                        getIFrameRef={(iframeRef) => {
                          iframeRef.style.width = '100%';
                          iframeRef.style.height = '100%';
                          iframeRef.style.border = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Control Buttons - ALWAYS visible at bottom */}
                <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-slate-800 border-t border-border">
                  <button
                    onClick={() => {
                      if (inlineJitsiApiRef.current) {
                        inlineJitsiApiRef.current.executeCommand('toggleAudio');
                        setIsMuted(!isMuted);
                      }
                    }}
                    disabled={!showInlineVideo}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>Mute</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (inlineJitsiApiRef.current) {
                        inlineJitsiApiRef.current.executeCommand('toggleVideo');
                        setIsVideoOff(!isVideoOff);
                      }
                    }}
                    disabled={!showInlineVideo}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Turn Off Video"
                  >
                    <VideoOff className="w-3.5 h-3.5" />
                    <span>Turn Off</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (inlineJitsiApiRef.current) {
                        inlineJitsiApiRef.current.executeCommand('toggleShareScreen');
                      }
                    }}
                    disabled={!showInlineVideo}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Share Screen"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                  
                  <button
                    onClick={() => setShowChat(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                    title="Open Chat"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (inlineJitsiApiRef.current) inlineJitsiApiRef.current.executeCommand('hangup');
                      setShowInlineVideo(false);
                      setInlineJitsiJoined(false);
                      setIsMuted(false);
                      setIsVideoOff(false);
                    }}
                    disabled={!showInlineVideo}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Leave Meeting"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Leave</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Row - Responsive: stacked on mobile, 3 cols on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Patient Vitals - Leftmost */}
            <div>
              <NewVitalsCard vitals={vitals} />
            </div>
            
            {/* Medical Reports - Stretched to right (2 columns) */}
            <div className="md:col-span-2">
              <MedicalReportsCard
                isActive={isActive}
                user={user}
                sessionData={sessionData}
                loadingData={loadingData}
                newNote={newNote}
                setNewNote={setNewNote}
                newMedication={newMedication}
                setNewMedication={setNewMedication}
                loadingNote={loadingNote}
                loadingMedication={loadingMedication}
                uploadingFile={uploadingFile}
                handleAddNote={handleAddNote}
                handleAddMedication={handleAddMedication}
                handleFileUpload={handleFileUpload}
                handleDeleteData={handleDeleteData}
                handleDownloadFile={handleDownloadFile}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chat and Video Call Panels */}
      <ChatPanel sessionId={sessionId} isOpen={showChat} onClose={() => setShowChat(false)} />
      <VideoCallPanelJitsi
        sessionId={sessionId}
        isOpen={showVideoCall}
        onClose={() => setShowVideoCall(false)}
        session={session}
      />

      {/* Vehicle Info Modal */}
      <VehicleInfoModal
        isOpen={showVehicleInfo}
        onClose={() => setShowVehicleInfo(false)}
        session={session}
        ambulance={ambulance}
      />

      {/* Camera Feed Modal */}
      <CameraFeedModal 
        isOpen={showCameraModal} 
        onClose={() => setShowCameraModal(false)} 
        session={session}
        ambulance={ambulance}
        selectedCamera={selectedCamera}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        title="Confirm Deletion"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Yes, Delete Entry
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Delete Entry</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                This action cannot be undone. The entry will be permanently removed.
              </p>
            </div>
          </div>

          {deleteTarget && (
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  {deleteTarget.dataType === 'note' && <FileText className="w-5 h-5 text-blue-600" />}
                  {deleteTarget.dataType === 'medication' && <Pill className="w-5 h-5 text-green-600" />}
                  {deleteTarget.dataType === 'file' && <Paperclip className="w-5 h-5 text-purple-600" />}
                  <span className="font-medium text-text capitalize">{deleteTarget.dataType}</span>
                </div>
                <div className="text-sm text-text-secondary">
                  {deleteTarget.dataType === 'note' && (
                    <p className="line-clamp-2">{deleteTarget.content.text}</p>
                  )}
                  {deleteTarget.dataType === 'medication' && (
                    <p>{deleteTarget.content.name} - {deleteTarget.content.dosage} ({deleteTarget.content.route})</p>
                  )}
                  {deleteTarget.dataType === 'file' && (
                    <p>{deleteTarget.content.filename} ({(deleteTarget.content.size / 1024).toFixed(1)} KB)</p>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-2">
                  Added by {deleteTarget.addedBy.name} on {new Date(deleteTarget.addedAt).toLocaleString()}
                </div>
              </div>

              <div className="text-sm text-secondary">
                <p>Are you sure you want to delete this entry? This action cannot be undone.</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

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
            <Button variant="danger" onClick={handleConfirmOffboard}>
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

          {session && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-xs text-secondary mb-1">Session Code</p>
                  <p className="font-medium">{session.session_code || session.sessionCode}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary mb-1">Ambulance</p>
                  <p className="font-medium">{session.ambulance_code || session.ambulanceCode}</p>
                </div>
              </div>

              <div className="text-sm text-secondary">
                <p>Are you sure you want to offboard this patient? This action will complete the session and cannot be undone.</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* GPS Location Modal */}
      <GPSLocationModal
        isOpen={showGPSModal}
        onClose={() => setShowGPSModal(false)}
        session={session}
        ambulance={ambulance}
      />

      {/* Fixed footer with Ambulance Controls (moved out of grid) */}
      {footerVisible && (
        <div className="fixed left-0 right-0 bottom-4 z-40 px-4 pointer-events-none">
          <div className="max-w-7xl mx-auto pointer-events-auto">
            <div className="flex items-center justify-center">
              <ControlsFooterBar controls={controls} onToggleControl={toggleControl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
