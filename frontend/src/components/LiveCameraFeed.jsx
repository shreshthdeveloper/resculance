import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Camera } from 'lucide-react';
import { ambulanceService } from '../services';
import cameraService from '../services/cameraService';
import { useToast } from '../hooks/useToast';

/**
 * LiveCameraFeed Component
 * Displays 808GPS camera player from ambulance device API
 */
export const LiveCameraFeed = ({
  ambulance,
  session,
  onCameraClick,
  // optional controlled props from parent
  selectedChannel: controlledSelectedChannel,
  onSelectChannel,
  onChannelCountDetected,
}) => {
  const [cameraUrl, setCameraUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraDevice, setCameraDevice] = useState(null);
  const [channelCount, setChannelCount] = useState(1);
  const [internalSelectedChannel, setInternalSelectedChannel] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    if (ambulance?.id) {
      fetchAndAuthenticateCamera();
    } else {
      setError('No ambulance data available');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulance?.id]);

  const fetchAndAuthenticateCamera = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch devices from backend
      const response = await ambulanceService.getDevices(ambulance.id);
      const devices = response.data?.data || response.data || [];

      // Find active camera device
      const camera = devices.find(
        (device) => device.device_type === 'CAMERA' && device.status === 'active'
      );

      if (!camera) {
        setError('No active camera found for this ambulance');
        setLoading(false);
        return;
      }

      setCameraDevice(camera);

      // determine how many channels the device exposes (best-effort)
      const detectedChannels =
        camera.channels || camera.channel_count || camera.chns || camera.streams || 1;
      // normalize to number and cap to 4
      let chCount = Number(detectedChannels) || 1;
      if (!isFinite(chCount) || chCount < 1) chCount = 1;
      chCount = Math.min(4, chCount);
      setChannelCount(chCount);
      setInternalSelectedChannel(1);
      // notify parent if provided
      if (typeof onChannelCountDetected === 'function') {
        try {
          onChannelCountDetected(chCount);
        } catch (e) {
          // swallow
        }
      }

      // Check if device has required credentials
      if (!camera.device_id || !camera.device_username || !camera.device_password) {
        setError('Camera device missing credentials');
        setLoading(false);
        return;
      }

      // Authenticate and get stream URL
      const streamUrl = await cameraService.getCameraStreamUrl({
        id: camera.id, // Database ID
        deviceId: camera.device_id,
        username: camera.device_username,
        password: camera.device_password,
      });

      setCameraUrl(streamUrl);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load camera:', err);
      
      // Extract error message from response
      let errorMessage = err.message;
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      // Check if it's an authentication error
      if (errorMessage.includes('Username or password incorrect') || 
          errorMessage.includes('authentication failed') ||
          err.response?.status === 401) {
        errorMessage = 'Camera credentials are incorrect. Please update the device username and password in ambulance settings.';
      }
      
      setError(errorMessage);
      setLoading(false);
      toast.error('Failed to load camera feed');
    }
  };

  if (loading) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Loading Camera Feed...</p>
          <p className="text-gray-400 text-sm mt-2">Authenticating with 808GPS</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
        <div className="text-center px-6">
          <AlertCircle className="w-16 h-16 text-error mx-auto mb-4" />
          <p className="text-white text-lg font-medium mb-2">Camera Unavailable</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchAndAuthenticateCamera}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden cursor-pointer group"
      onClick={() => onCameraClick && onCameraClick(cameraDevice)}
    >
      {/* Live indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-error/90 px-3 py-1.5 rounded-md backdrop-blur-sm">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-white text-sm font-bold">LIVE</span>
      </div>

      {/* Camera name */}
      {cameraDevice && (
        <div className="absolute bottom-4 left-4 z-20 bg-black/70 px-3 py-1.5 rounded-md backdrop-blur-sm">
          <span className="text-white text-sm font-medium">{cameraDevice.device_name}</span>
        </div>
      )}

      {/* Click to enlarge hint */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
        <div className="text-center">
          <Camera className="w-12 h-12 text-white mx-auto mb-2" />
          <p className="text-white text-lg font-medium">Click to enlarge</p>
        </div>
      </div>

      {/* Camera feed iframe - properly contained */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            src={buildChannelUrl(
              cameraUrl,
              // prefer controlled selected channel from parent
              controlledSelectedChannel || internalSelectedChannel,
              // pass channelCount for fallback (not used for chns)
              channelCount
            )}
            className="absolute inset-0 w-full h-full block"
            frameBorder="0"
            scrolling="no"
            allow="camera; microphone; autoplay; fullscreen"
            allowFullScreen
            title={`808GPS Live Camera Feed`}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            style={{ border: 'none', objectFit: 'contain', width: '100%', height: '100%' }}
          />
        </div>
      {/* Channel selector removed from inside feed; parent `CameraCard` will render buttons below the card and control selection.
          However, if a parent provided `onSelectChannel`, we listen to it by exposing a small effect to call it when internal selection changes. */}
      {/* If parent supplies controlledSelectedChannel, they must handle changes. */}
    </div>
  );
};

export default LiveCameraFeed;

// Helper: build iframe URL with channel and chns query params.
function buildChannelUrl(baseUrl, channel, chns) {
  if (!baseUrl) return '';

  // We ALWAYS request a single-output layout from the player by setting
  // `channel=1`. The `chns` param controls which camera index is shown
  // in that single-output mode: chns = selectedChannel - 1 (0-based).
  const chnsValue = Math.max(0, Number(channel) - 1);

  try {
    const url = new URL(baseUrl);
    // ensure single-output
    url.searchParams.set('channel', '1');
    // set chns param (0-based camera index)
    url.searchParams.set('chns', String(chnsValue));
    return url.toString();
  } catch (e) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    let cleaned = baseUrl.replace(/([?&])chns=\d+/g, '');
    cleaned = cleaned.replace(/([?&])channel=\d+/g, '');
    cleaned = cleaned.replace(/[?&]$/g, '');
    return `${cleaned}${separator}channel=1&chns=${chnsValue}`;
  }
}
