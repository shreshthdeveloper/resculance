import { Camera, RefreshCw, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../ui/Card';
import LiveCameraFeed from '../LiveCameraFeed';

export default function CameraCard({
  session,
  ambulance,
  isActive,
  onCameraClick,
  onRefresh,
}) {
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [detectedChannelCount, setDetectedChannelCount] = useState(1);

  const handleCameraClick = () => {
    if (onCameraClick) {
      onCameraClick();
    }
  };

  return (
    <Card className="p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <Camera className="w-4 h-4" /> Live Camera Feed
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCameraClick}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="View All Cameras"
          >
            <Maximize2 className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Single Camera Feed - Click to open modal */}
      <div 
        className="flex-1 bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all min-h-0"
        onClick={handleCameraClick}
      >
        {isActive && session && ambulance ? (
          <LiveCameraFeed 
            ambulance={ambulance}
            session={session}
            onCameraClick={handleCameraClick}
            selectedChannel={selectedChannel}
            onChannelCountDetected={(c) => setDetectedChannelCount(c)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active session</p>
            </div>
          </div>
        )}
      </div>

      {/* Channel buttons below the feed — match visual layout from screenshot. */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => {
          const num = i + 1;
          const active = num === selectedChannel;
          return (
            <button
              key={num}
              onClick={(e) => {
                e.stopPropagation();
                // always allow switching channels (user requested buttons active)
                setSelectedChannel(num);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                active
                  ? 'bg-primary text-white shadow'
                  : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white border border-border hover:bg-gray-50'
              }`}
              title={`View channel ${num}`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
