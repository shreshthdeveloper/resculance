import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Maximize2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ambulanceService } from '../../services';
import cameraService from '../../services/cameraService';
import { useToast } from '../../hooks/useToast';

export const CameraFeedModal = ({ isOpen, onClose, session, ambulance }) => {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [deviceStatus, setDeviceStatus] = useState('loading');
  const { toast } = useToast();

  // Camera channel configuration (0-3 for 4 cameras)
  const channels = [0, 1, 2, 3];
  const channelLabels = [
    'Patient Bay Camera',
    'Driver View Camera', 
    'Equipment Monitor',
    'External View'
  ];

  useEffect(() => {
    if (isOpen && ambulance?.id) {
      fetchDevice();
    }
  }, [isOpen, ambulance]);

  // Lock body scrolling while modal is open so page doesn't scroll instead
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const fetchDevice = async () => {
    try {
      setLoading(true);
      const response = await ambulanceService.getDevices(ambulance.id);
      const devicesList = response.data?.data || response.data || [];
      
      // Get the first active camera device
      const cameraDevice = devicesList.find(
        (device) => device.device_type === 'CAMERA' && device.status === 'active'
      );
      
      if (!cameraDevice) {
        setDeviceStatus('no_device');
        return;
      }

      setDevice(cameraDevice);
      
      // Check if device has required credentials
      if (!cameraDevice.device_id || !cameraDevice.device_username || !cameraDevice.device_password) {
        setDeviceStatus('not_configured');
        return;
      }

      // Get authenticated base stream URL using camera service
      const streamUrl = await cameraService.getCameraStreamUrl({
        id: cameraDevice.id,
        deviceId: cameraDevice.device_id,
        username: cameraDevice.device_username,
        password: cameraDevice.device_password,
      });

      setBaseUrl(streamUrl);
      setDeviceStatus('connected');
    } catch (error) {
      console.error('Failed to fetch camera device:', error);
      toast.error('Failed to load camera feeds');
      setDeviceStatus('auth_failed');
    } finally {
      setLoading(false);
    }
  };

  const buildChannelUrl = (baseUrl, channelIndex) => {
    if (!baseUrl) return '';
    
    // Add channel query parameters
    // channel=1 means single-output mode, chns=N selects which camera (0-3)
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}channel=1&chns=${channelIndex}`;
  };

  const handleAuthenticateDevice = async () => {
    if (!device) return;
    
    try {
      if (!device.device_id || !device.device_username || !device.device_password) {
        toast.error('Device credentials not configured');
        return;
      }

      // Get authenticated stream URL using camera service
      const streamUrl = await cameraService.getCameraStreamUrl({
        id: device.id,
        deviceId: device.device_id,
        username: device.device_username,
        password: device.device_password,
      });

      setBaseUrl(streamUrl);
      setDeviceStatus('connected');
      toast.success('Camera authenticated successfully');
    } catch (error) {
      console.error('Failed to authenticate device:', error);
      toast.error('Failed to authenticate camera');
      setDeviceStatus('auth_failed');
    }
  };

  const getStatusIndicator = () => {
    switch (deviceStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-600">Live</span>
          </div>
        );
      case 'needs_auth':
      case 'auth_failed':
        return (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-600">Auth Failed</span>
          </div>
        );
      case 'not_configured':
        return (
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-600">Not Configured</span>
          </div>
        );
      case 'no_device':
        return (
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">No Camera</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">Offline</span>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Live Camera Feeds
              </h2>
              <p className="text-sm text-secondary mt-1">
                Ambulance: {ambulance?.registration_number || ambulance?.vehicleNumber} • 
                Trip ID: {session?.id}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                4G • 150ms
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Camera Grid */}
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : deviceStatus === 'no_device' ? (
              <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                <Camera className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No cameras configured</p>
                <p className="text-sm">Add camera devices to this ambulance to view live feeds</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {channels.map((channelIndex) => {
                  const channelUrl = buildChannelUrl(baseUrl, channelIndex);
                  
                  return (
                    <div
                      key={channelIndex}
                      className="bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-border"
                    >
                      {/* Camera Header */}
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {channelLabels[channelIndex]}
                          </h4>
                        </div>
                        {getStatusIndicator()}
                      </div>

                      {/* Camera Feed */}
                      <div className="relative bg-slate-900 aspect-video">
                        {deviceStatus === 'connected' && channelUrl ? (
                          <iframe
                            src={channelUrl}
                            className="w-full h-full"
                            frameBorder="0"
                            scrolling="no"
                            allow="camera; microphone"
                            title={channelLabels[channelIndex]}
                            style={{ objectFit: 'contain' }}
                          />
                        ) : deviceStatus === 'needs_auth' || deviceStatus === 'auth_failed' ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <AlertCircle className="w-12 h-12 mb-3 text-amber-500" />
                            <p className="text-sm mb-3">Authentication Required</p>
                            <Button
                              size="sm"
                              onClick={handleAuthenticateDevice}
                            >
                              Authenticate Camera
                            </Button>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <WifiOff className="w-12 h-12 mb-3 text-gray-500" />
                            <p className="text-sm">Camera Unavailable</p>
                          </div>
                        )}
                      </div>

                      {/* Camera Info */}
                      <div className="p-3 bg-white dark:bg-slate-800 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center justify-between">
                          <span>Channel: {channelIndex}</span>
                          {device && (
                            <span>Device ID: {device.device_id}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border">
            <div className="text-sm text-secondary">
              Recording: <span className="font-medium text-gray-900 dark:text-white">Active</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={fetchDevice}>
                Refresh Feeds
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
