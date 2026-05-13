import { MapPin, AlertCircle, Navigation, Maximize2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useState, useEffect } from 'react';
import { ambulanceService } from '../../services';

export default function DevicesCard({ sosAlerts, type = 'location', ambulance, onOpenGPSModal }) {
  const [gpsData, setGpsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (type === 'location' && ambulance?.id) {
      fetchGPSData();
      
      // Refresh GPS data every 10 seconds
      const interval = setInterval(fetchGPSData, 10000);
      return () => clearInterval(interval);
    }
  }, [type, ambulance]);

  const fetchGPSData = async () => {
    if (!ambulance?.id) return;
    
    try {
      setLoading(true);
      const response = await ambulanceService.getDevices(ambulance.id);
      const devicesList = response.data?.data || response.data || [];
      
      // Find first active GPS device
      const gpsDevice = devicesList.find(
        (device) => 
          (device.device_type === 'GPS_TRACKER' || device.device_type === 'LIVE_LOCATION') && 
          device.status === 'active' &&
          device.device_id
      );
      
      if (gpsDevice) {
        // Get device credentials from backend
        const credsResponse = await ambulanceService.getDeviceLocation(gpsDevice.id);
        
        if (!credsResponse.data?.success) {
          console.error('Failed to get device credentials:', credsResponse);
          setLoading(false);
          return;
        }

        const { deviceId, jsession, apiUrl } = credsResponse.data.data;
        
        // Make direct API call to 808GPS
        const gpsResponse = await fetch(`${apiUrl}?jsession=${encodeURIComponent(jsession)}&devIdno=${encodeURIComponent(deviceId)}&toMap=1&language=zh`, {
          method: 'GET',
          mode: 'cors'
        });
        
        if (!gpsResponse.ok) {
          console.error('GPS API failed:', gpsResponse.status, gpsResponse.statusText);
          setLoading(false);
          return;
        }
        
        const data = await gpsResponse.json();

        if (data.result === 0 && data.status && data.status.length > 0) {
          const deviceData = data.status[0];
          
          // Calculate heading from hx value (0-360 degrees)
          const heading = deviceData.hx || 0;
          const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
          const directionIndex = Math.round(heading / 45) % 8;
          const direction = directions[directionIndex];
          
          setGpsData({
            speed: deviceData.sp ? (parseFloat(deviceData.sp) / 10).toFixed(0) : '0',
            heading: `${direction} ${heading}°`,
            signal: `${deviceData.net || 0}/5`,
            online: deviceData.ol === 1,
            lat: deviceData.mlat || (deviceData.lat / 1e6),
            lng: deviceData.mlng || (deviceData.lng / 1e6)
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch GPS data:', error);
    } finally {
      setLoading(false);
    }
  };
  if (type === 'sos') {
    // SOS Data Card
    return (
      <Card className="p-3 flex flex-col h-full overflow-hidden">
        <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> SOS
        </h3>
        <p className="text-[10px] text-text-secondary mb-2">System alerts</p>

        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {sosAlerts.map((alert) => (
            <div key={alert.id} className="border border-border rounded p-1.5 hover:bg-background transition-colors">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[9px] text-text">#{alert.id}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                      alert.level === 'Critical' ? 'bg-error/20 text-error' : 
                      alert.level === 'Warning' ? 'bg-warning/20 text-warning' : 
                      'bg-info/20 text-info'
                    }`}>
                      {alert.level}
                    </span>
                    <span className="text-[9px] text-text-secondary">{alert.time}</span>
                  </div>
                  <p className="text-[10px] text-text truncate">{alert.note}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Location Card
  return (
    <Card className="p-3 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> GPS
          {gpsData?.online && (
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          )}
        </h3>
        {onOpenGPSModal && (
          <button
            onClick={onOpenGPSModal}
            className="p-1 hover:bg-background rounded transition-colors"
            title="Open GPS Modal"
          >
            <Maximize2 className="w-3 h-3 text-text-secondary" />
          </button>
        )}
      </div>
      <p className="text-[10px] text-text-secondary mb-2">
        {gpsData ? 'Live tracking' : 'Device location'}
      </p>

      <div 
        className="flex-1 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden mb-2 relative min-h-0 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        onClick={onOpenGPSModal}
      >
        {gpsData && gpsData.lat && gpsData.lng ? (
          <iframe
            src={`https://www.google.com/maps?q=${gpsData.lat},${gpsData.lng}&output=embed&z=15`}
            className="w-full h-full"
            frameBorder="0"
            title="GPS Location"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-text-secondary">
              <Navigation className={`w-8 h-8 mx-auto mb-1 opacity-30 ${loading ? 'animate-spin' : ''}`} />
              <p className="text-[10px]">{loading ? 'Loading...' : 'GPS tracking'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <div>
          <p className="text-text-secondary text-[9px] mb-0.5">Speed</p>
          <p className="font-bold text-text">{gpsData?.speed || '0'} km/h</p>
        </div>
        <div>
          <p className="text-text-secondary text-[9px] mb-0.5">Heading</p>
          <p className="font-bold text-text">{gpsData?.heading || 'N/A'}</p>
        </div>
        <div>
          <p className="text-text-secondary text-[9px] mb-0.5">Signal</p>
          <p className="font-bold text-text">{gpsData?.signal || '0/5'}</p>
        </div>
      </div>
    </Card>
  );
}
