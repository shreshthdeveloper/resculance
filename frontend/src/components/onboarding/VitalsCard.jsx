import { useState } from 'react';
import { Activity, Camera, Heart } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import LiveCameraFeed from '../LiveCameraFeed';

export default function VitalsCard({ 
  session, 
  ambulance, 
  isActive, 
  vitals, 
  onCameraClick, 
  onOffboardPatient, 
  onRefresh 
}) {
  const [showCameraModal, setShowCameraModal] = useState(false);

  return (
    <Card className="p-3 flex flex-col h-full overflow-hidden">
      {/* Camera Feeds - Visible */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> Live Camera
          </h3>
          <Button size="sm" variant="ghost" onClick={() => setShowCameraModal(true)} className="text-xs h-6 px-2">
            <Camera className="w-3 h-3 mr-1" /> View All
          </Button>
        </div>

        <div className="rounded overflow-hidden bg-gray-900 h-32">
          <LiveCameraFeed 
            ambulance={ambulance}
            session={session}
            onCameraClick={onCameraClick}
          />
        </div>
      </div>

      {/* Patient Status */}
      <div className="pt-2 border-t border-border flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Status
          </h3>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            session.status?.toLowerCase() === 'onboarded' ? 'bg-primary/10 text-primary' : 
            session.status?.toLowerCase() === 'in_transit' ? 'bg-warning/10 text-warning' : 
            session.status?.toLowerCase() === 'offboarded' ? 'bg-success/10 text-success' : 
            'bg-gray-100 text-gray-700'
          }`}>
            <span 
              className="w-1 h-1 rounded-full mr-1 animate-pulse" 
              style={{ 
                backgroundColor: session.status?.toLowerCase() === 'onboarded' ? 'var(--color-primary)' : 
                session.status?.toLowerCase() === 'in_transit' ? 'var(--color-warning)' : 
                session.status?.toLowerCase() === 'offboarded' ? 'var(--color-success)' : 
                'gray' 
              }} 
            />
            {session.status?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
        <p className="text-[10px] text-text-secondary mb-2">
          Session: {session.session_code || session.sessionCode}
        </p>

        {/* Patient Vitals - Compact */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-background rounded p-1.5 border border-border">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-secondary">HR</span>
              <Heart className="w-2.5 h-2.5 text-error" />
            </div>
            <p className="text-xs font-bold text-text">
              {vitals.heartRate} <span className="text-[9px] font-normal text-text-secondary">bpm</span>
            </p>
          </div>
          
          <div className="bg-background rounded p-1.5 border border-border">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-secondary">SpO₂</span>
              <Activity className="w-2.5 h-2.5 text-success" />
            </div>
            <p className="text-xs font-bold text-text">
              {vitals.spo2}<span className="text-[9px] font-normal text-text-secondary">%</span>
            </p>
          </div>
          
          <div className="bg-background rounded p-1.5 border border-border">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-secondary">BP</span>
              <Activity className="w-2.5 h-2.5 text-primary" />
            </div>
            <p className="text-xs font-bold text-text">{vitals.bloodPressure}</p>
          </div>
          
          <div className="bg-background rounded p-1.5 border border-border">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-secondary">Temp</span>
              <Activity className="w-2.5 h-2.5 text-warning" />
            </div>
            <p className="text-xs font-bold text-text">
              {vitals.temp}<span className="text-[9px] font-normal text-text-secondary">°C</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
