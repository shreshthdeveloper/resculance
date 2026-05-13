import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, Wifi, WifiOff, AlertCircle, RefreshCw, Maximize2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ambulanceService } from '../../services';
import { useToast } from '../../hooks/useToast';

export const GPSLocationModal = ({ isOpen, onClose, session, ambulance }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceLocations, setDeviceLocations] = useState({});
  const [deviceStatus, setDeviceStatus] = useState({});
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  // Fetch GPS devices
  useEffect(() => {
    if (isOpen && ambulance?.id) {
      fetchDevices();
    }
  }, [isOpen, ambulance]);

  // Auto-refresh location every 10 seconds
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;

    const interval = setInterval(() => {
      devices.forEach(device => {
        if (device.device_id) {
          fetchDeviceLocation(device);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, devices]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await ambulanceService.getDevices(ambulance.id);
      const devicesList = response.data?.data || response.data || [];
      
      // Filter for GPS/Location devices
      const gpsDevices = devicesList.filter(
        (device) => 
          (device.device_type === 'GPS_TRACKER' || device.device_type === 'LIVE_LOCATION') && 
          device.status === 'active'
      );
      
      setDevices(gpsDevices);
      
      // Fetch initial locations
      gpsDevices.forEach(device => {
        if (device.device_id) {
          fetchDeviceLocation(device);
        }
      });
    } catch (error) {
      console.error('Failed to fetch GPS devices:', error);
      toast.error('Failed to load GPS devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeviceLocation = async (device) => {
    try {
      if (!device.device_id) {
        setDeviceStatus(prev => ({ ...prev, [device.id]: 'not_configured' }));
        return;
      }

      // Get device credentials from backend
      const credsResponse = await ambulanceService.getDeviceLocation(device.id);
      
      if (!credsResponse.data?.success) {
        setDeviceStatus(prev => ({ ...prev, [device.id]: 'auth_failed' }));
        return;
      }

      const { deviceId, jsession, apiUrl } = credsResponse.data.data;
      
      // Make direct API call to 808GPS
      const response = await fetch(`${apiUrl}?jsession=${encodeURIComponent(jsession)}&devIdno=${encodeURIComponent(deviceId)}&toMap=1&language=zh`, {
        method: 'GET',
        mode: 'cors'
      });
      
      if (!response.ok) {
        setDeviceStatus(prev => ({ ...prev, [device.id]: 'error' }));
        return;
      }

      const data = await response.json();

      if (data.result === 0 && data.status && data.status.length > 0) {
        const deviceData = data.status[0];
        
        // Parse coordinates
        let lat, lng;
        if (deviceData.mlat && deviceData.mlng) {
          lat = parseFloat(deviceData.mlat);
          lng = parseFloat(deviceData.mlng);
        } else if (deviceData.lat && deviceData.lng) {
          lat = parseFloat(deviceData.lat) / 1e6;
          lng = parseFloat(deviceData.lng) / 1e6;
        }

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          const locationData = {
            lat,
            lng,
            speed: deviceData.sp ? parseFloat(deviceData.sp) / 10 : 0, // Convert to km/h
            online: deviceData.ol === 1,
            lastUpdate: deviceData.gt || new Date().toISOString(),
            address: deviceData.ps || 'Address not available',
            signal: deviceData.net || 0,
            battery: deviceData.ac || 0,
          };

          setDeviceLocations(prev => ({ ...prev, [device.id]: locationData }));
          setDeviceStatus(prev => ({ ...prev, [device.id]: locationData.online ? 'connected' : 'offline' }));
        } else {
          setDeviceStatus(prev => ({ ...prev, [device.id]: 'no_location' }));
        }
      } else {
        setDeviceStatus(prev => ({ ...prev, [device.id]: 'auth_failed' }));
      }
    } catch (error) {
      console.error(`Failed to fetch location for device ${device.id}:`, error);
      setDeviceStatus(prev => ({ ...prev, [device.id]: 'error' }));
    }
  };

  const getDeviceLabel = (device, index) => {
    if (device.device_name) return device.device_name;
    return `GPS Tracker ${index + 1}`;
  };

  const getStatusIndicator = (deviceId) => {
    const status = deviceStatus[deviceId];
    const location = deviceLocations[deviceId];
    
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </div>
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">Live</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">Offline</span>
          </div>
        );
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
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-600">Not Configured</span>
          </div>
        );
      case 'no_location':
        return (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-600">No Location</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-600">Loading...</span>
          </div>
        );
    }
  };

  const openInMaps = (location) => {
    if (location && location.lat && location.lng) {
      window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, '_blank');
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
          <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <MapPin className="w-6 h-6" />
                </div>
                Live GPS Tracking
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                Ambulance: {ambulance?.registration_number || ambulance?.vehicleNumber} • 
                Trip ID: {session?.id}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  autoRefresh 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto-refresh
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                <MapPin className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No GPS devices configured</p>
                <p className="text-sm">Add GPS tracking devices to this ambulance to view live location</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {devices.map((device, index) => {
                  const location = deviceLocations[device.id];
                  const status = deviceStatus[device.id];
                  
                  return (
                    <div
                      key={device.id}
                      className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl overflow-hidden border-2 border-border hover:border-primary/50 transition-all shadow-lg"
                    >
                      {/* Device Header */}
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-border">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                            <Navigation className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-text">
                              {getDeviceLabel(device, index)}
                            </h4>
                            <p className="text-xs text-text-secondary">Device ID: {device.device_id}</p>
                          </div>
                        </div>
                        {getStatusIndicator(device.id)}
                      </div>

                      {/* Location Content */}
                      <div className="p-5 space-y-4">
                        {location ? (
                          <>
                            {/* Map Placeholder - Would integrate Leaflet/Google Maps here */}
                            <div className="relative bg-slate-200 dark:bg-slate-900 rounded-xl overflow-hidden h-48 group">
                              <iframe
                                src={`https://www.google.com/maps?q=${location.lat},${location.lng}&output=embed&z=15`}
                                className="w-full h-full"
                                frameBorder="0"
                                title={`Map for ${getDeviceLabel(device, index)}`}
                              />
                              <button
                                onClick={() => openInMaps(location)}
                                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 rounded-lg shadow-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                              </button>
                            </div>

                            {/* Location Stats */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Speed</p>
                                <p className="text-xl font-bold text-text">{location.speed.toFixed(1)} km/h</p>
                              </div>
                              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-3 border border-green-200 dark:border-green-800">
                                <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Signal</p>
                                <p className="text-xl font-bold text-text">{location.signal}G</p>
                              </div>
                              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Battery</p>
                                <p className="text-xl font-bold text-text">{location.battery}%</p>
                              </div>
                            </div>

                            {/* Coordinates */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-border">
                              <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-text-secondary mb-1">Current Location</p>
                                  <p className="text-sm font-medium text-text mb-2 line-clamp-2">{location.address}</p>
                                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                                    <span className="font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                                    <span>•</span>
                                    <span>Updated: {new Date(location.lastUpdate).toLocaleTimeString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => fetchDeviceLocation(device)}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => openInMaps(location)}
                              >
                                <Navigation className="w-4 h-4 mr-2" />
                                Open in Maps
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
                            <p className="text-sm font-medium">
                              {status === 'not_configured' ? 'Device not configured' : 'Location data unavailable'}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => fetchDeviceLocation(device)}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-slate-50 dark:bg-slate-900">
            <div className="text-sm text-secondary">
              Tracking: <span className="font-medium text-text">{devices.length} Device{devices.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={fetchDevices}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh All
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
