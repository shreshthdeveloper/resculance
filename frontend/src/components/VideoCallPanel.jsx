import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Users, MessageSquare, Settings, MoreVertical, X, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import socketService from '../services/socketService.js';
import { useAuthStore } from '../store/authStore';

const VideoCallPanel = ({ sessionId, isOpen, onClose, session }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, connecting, connected
  
  const localVideoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const hasJoinedRoom = useRef(false);
  const { user } = useAuthStore();

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Join room only once when modal opens
  useEffect(() => {
    if (!isOpen || !sessionId || hasJoinedRoom.current) return;

    const joinRoom = async () => {
      try {
        console.log('[VideoCall] Joining room for session:', sessionId);
        setConnectionStatus('connecting');
        setError(null);
        hasJoinedRoom.current = true;

        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }, 
          audio: true 
        });
        
        console.log('[VideoCall] Got stream with tracks:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
        
        // Set stream to state
        setLocalStream(stream);
        
        // Force attach to video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('[VideoCall] Stream attached to video element');
          
          // Force play
          localVideoRef.current.play().catch(err => {
            console.error('[VideoCall] Failed to play video:', err);
          });
        }
        
        // Join socket room
        socketService.joinVideoRoom(sessionId);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('[VideoCall] Failed to join:', error);
        setError(error.message || 'Failed to access camera/microphone');
        setConnectionStatus('idle');
        hasJoinedRoom.current = false;
      }
    };

    joinRoom();

    // Cleanup on unmount
    return () => {
      console.log('[VideoCall] Component unmounting, cleaning up...');
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log('[VideoCall] Stopped track:', track.kind);
        });
      }

      peerConnections.current.forEach((pc) => {
        pc.close();
      });
      peerConnections.current.clear();

      if (hasJoinedRoom.current) {
        socketService.leaveVideoRoom(sessionId);
        hasJoinedRoom.current = false;
      }
    };
  }, [isOpen, sessionId]); // Only re-run if modal opens/closes or session changes

  // Ensure video element gets the stream after rendering
  useEffect(() => {
    if (localVideoRef.current && localStream && !localVideoRef.current.srcObject) {
      console.log('[VideoCall] Attaching stream to video element in effect');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => console.error('[VideoCall] Play failed:', err));
    }
  }, [localStream]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('[VideoCall] Video toggled:', videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('[VideoCall] Audio toggled:', audioTrack.enabled);
      }
    }
  };

  const handleClose = () => {
    // Stop media and close connections
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    if (hasJoinedRoom.current) {
      socketService.leaveVideoRoom(sessionId);
      hasJoinedRoom.current = false;
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gray-900 z-[9999] flex flex-col"
      >
        {/* Header Bar */}
        <div className="bg-gray-800/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Emergency Session</h2>
                <p className="text-gray-400 text-sm">Session #{sessionId?.slice(0, 8)}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-white text-sm font-medium">
                {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            
            <button 
              className="p-2.5 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors relative"
            >
              <Users className="w-5 h-5" />
              {participants.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {participants.length + 1}
                </span>
              )}
            </button>

            <button 
              className="p-2.5 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <button 
              onClick={handleClose}
              className="p-2.5 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-red-500/20 border-b border-red-500/40 px-6 py-3"
          >
            <p className="text-red-200 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              {error}
            </p>
          </motion.div>
        )}

        {/* Main Video Grid */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <div className="w-full h-full max-w-7xl mx-auto">
            {/* Single participant - full screen */}
            {participants.length === 0 && (
              <div className="relative w-full h-full bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* ALWAYS show video element when stream exists */}
                {localStream ? (
                  <>
                    <video 
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Show placeholder OVERLAY when video is disabled */}
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-900">
                        <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                          <VideoOff className="w-16 h-16 text-gray-500" />
                        </div>
                        <p className="text-gray-400 text-lg">{user?.name || 'You'}</p>
                        <p className="text-gray-500 text-sm">Camera is off</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
                    </div>
                    <p className="text-gray-400 text-lg">Connecting...</p>
                    <p className="text-gray-500 text-sm">Please allow camera access</p>
                  </div>
                )}
                
                {/* Overlay info */}
                <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl">
                  <p className="text-white font-medium">{user?.name || 'You'}</p>
                  <p className="text-gray-300 text-xs">{user?.role || 'Participant'}</p>
                  {/* Debug info */}
                  <p className="text-gray-400 text-xs mt-1">
                    Stream: {localStream ? '✓' : '✗'} | 
                    Video: {isVideoEnabled ? 'ON' : 'OFF'} | 
                    Tracks: {localStream?.getTracks().length || 0}
                  </p>
                </div>

                {/* Audio indicator */}
                <div className="absolute top-6 left-6">
                  {!isAudioEnabled && (
                    <div className="bg-red-500/90 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <MicOff className="w-4 h-4 text-white" />
                      <span className="text-white text-sm font-medium">Muted</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Multi-participant grid (2-4 people) */}
            {participants.length > 0 && participants.length <= 3 && (
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Local video */}
                <div className="relative bg-gray-800 rounded-2xl overflow-hidden shadow-xl">
                  {localStream ? (
                    <>
                      <video 
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!isVideoEnabled && (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
                          <VideoOff className="w-12 h-12 text-gray-600" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg">
                    <p className="text-white text-sm font-medium">{user?.name || 'You'}</p>
                  </div>
                </div>

                {/* Remote videos */}
                {participants.map((participant) => (
                  <div key={participant.userId} className="relative bg-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-3 mx-auto">
                          <span className="text-white text-2xl font-bold">
                            {participant.userName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <p className="text-gray-400">{participant.userName || 'Participant'}</p>
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg">
                      <p className="text-white text-sm font-medium">{participant.userName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Large grid (5+ people) */}
            {participants.length > 3 && (
              <div className="grid grid-cols-3 gap-3 h-full auto-rows-fr">
                <div className="relative bg-gray-800 rounded-xl overflow-hidden">
                  {localStream ? (
                    <>
                      <video 
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!isVideoEnabled && (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
                          <VideoOff className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                    {user?.name || 'You'}
                  </div>
                </div>

                {participants.map((participant) => (
                  <div key={participant.userId} className="relative bg-gray-800 rounded-xl overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white text-lg font-bold">
                        {participant.userName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                      {participant.userName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="bg-gray-800/90 backdrop-blur-sm px-6 py-5 flex items-center justify-center border-t border-gray-700">
          <div className="flex items-center gap-3">
            {/* Microphone */}
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full transition-all shadow-lg ${
                isAudioEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            {/* Camera */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all shadow-lg ${
                isVideoEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Screen Share (disabled for now) */}
            <button
              disabled
              className="p-4 rounded-full bg-gray-700/50 text-gray-500 cursor-not-allowed"
              title="Screen share coming soon"
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* More Options */}
            <button
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Leave Call */}
            <button
              onClick={handleClose}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg ml-3"
              title="Leave call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoCallPanel;
