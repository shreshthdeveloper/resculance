// Jitsi Meet Configuration for Resculance Video Calls
// This file contains settings for Jitsi integration

export const JITSI_CONFIG = {
  // Use Jitsi Meet's public server (free tier)
  // For production, consider self-hosting Jitsi Meet
  domain: 'meet.jit.si',

  // Alternative: Use a custom domain if self-hosting
  // domain: 'meet.yourdomain.com',

  // Room configuration
  roomPrefix: 'resculance-session-',

  // Default settings
  defaultConfig: {
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    enableWelcomePage: false,
    enableClosePage: false,
    disableInviteFunctions: true,
    prejoinPageEnabled: false,
    hideConferenceSubject: false,
    hideConferenceTimer: false,
    hideParticipantsStats: false,

    // Security settings for healthcare
    enableLobby: false, // Immediate access for healthcare emergencies
    requireDisplayName: true,
    enableNoAudioDetection: true,
    enableNoisyMicDetection: true,

    // Recording capabilities (requires Jitsi server support)
    recordingService: {
      enabled: true,
      sharingEnabled: true
    },

    // Moderation features
    moderation: {
      enabled: true,
      enableModeratorMuteAll: true
    }
  },

  // UI customization
  interfaceConfig: {
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    SHOW_BRAND_WATERMARK: false,
    BRAND_WATERMARK_LINK: '',
    SHOW_POWERED_BY: false,

    TOOLBAR_BUTTONS: [
      'microphone', 'camera', 'desktop', 'fullscreen',
      'fodeviceselection', 'hangup', 'profile', 'chat',
      'recording', 'settings', 'raisehand', 'videoquality',
      'filmstrip', 'stats', 'shortcuts', 'tileview'
    ],

    SETTINGS_SECTIONS: ['devices', 'moderator', 'profile', 'calendar'],
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
    DISABLE_VIDEO_BACKGROUND: false
  }
};

// Helper function to generate room name
export const generateRoomName = (sessionId) => {
  return `${JITSI_CONFIG.roomPrefix}${sessionId}`;
};

// Helper function to get full Jitsi URL
export const getJitsiUrl = (sessionId) => {
  const roomName = generateRoomName(sessionId);
  return `https://${JITSI_CONFIG.domain}/${roomName}`;
};
