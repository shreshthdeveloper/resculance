import React, { useState, useEffect, useRef } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Users, MessageSquare, MoreVertical, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { JITSI_CONFIG, generateRoomName } from '../config/jitsiConfig';

const VideoCallPanelJitsi = ({ sessionId, isOpen, onClose, session }) => {
  const { user } = useAuthStore();
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const apiRef = useRef(null);

  // Generate a unique room name for this session
  const roomName = generateRoomName(sessionId);

  // Generate display name
  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Anonymous User';

  const handleApiReady = (api) => {
    console.log('🎥 Jitsi API ready');
    apiRef.current = api;
    setIsLoading(false);
    setConnectionStatus('connecting');

    // Set up event listeners
    api.addEventListener('videoConferenceJoined', () => {
      console.log('✅ Joined Jitsi conference');
      setIsJoined(true);
      setConnectionStatus('connected');
    });

    api.addEventListener('videoConferenceLeft', () => {
      console.log('👋 Left Jitsi conference');
      setIsJoined(false);
      setConnectionStatus('disconnected');
    });

    api.addEventListener('participantJoined', (participant) => {
      console.log('👤 Participant joined:', participant);
    });

    api.addEventListener('participantLeft', (participant) => {
      console.log('👋 Participant left:', participant);
    });

    api.addEventListener('errorOccurred', (error) => {
      console.error('❌ Jitsi error:', error);
      setError(error?.error?.message || 'Video call error occurred');
      setConnectionStatus('error');
    });

    // Configure initial settings
    api.executeCommand('displayName', displayName);
    api.executeCommand('subject', `Session ${session?.session_code || sessionId}`);

    // Disable certain features for cleaner UI initially
    // api.executeCommand('toggleChat');
    // api.executeCommand('toggleTileView');
  };

  const handleClose = () => {
    // Properly leave the meeting before closing
    if (apiRef.current && isJoined) {
      console.log('👋 Leaving Jitsi meeting before closing modal');
      apiRef.current.executeCommand('hangup');
    }

    setIsJoined(false);
    setConnectionStatus('idle');
    setError(null);
    setIsLoading(true);
    apiRef.current = null;
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (apiRef.current) {
        console.log('🧹 Cleaning up Jitsi API on unmount');
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Video Call - Session {session?.session_code || sessionId}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   connectionStatus === 'error' ? 'Connection Error' :
                   'Loading...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (apiRef.current) {
                    // Toggle chat panel
                    apiRef.current.executeCommand('toggleChat');
                  }
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Toggle Chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 hover:text-red-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Jitsi Meeting Container */}
          <div className="flex-1 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading video call...</p>
                </div>
              </div>
            )}
            <JitsiMeeting
              roomName={roomName}
              displayName={displayName}
              password="" // No password for simplicity
              onApiReady={handleApiReady}
              configOverwrite={JITSI_CONFIG.defaultConfig}
              interfaceConfigOverwrite={JITSI_CONFIG.interfaceConfig}
              userInfo={{
                displayName: displayName,
                email: user?.email || ''
              }}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
              }}
            />
          </div>

          {/* Footer with connection info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>Room: {roomName}</span>
                <span>Participants: {isJoined ? 'Connected' : 'Connecting...'}</span>
              </div>
              <div className="text-xs">
                Powered by Jitsi Meet (Free & Open Source)
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoCallPanelJitsi;
