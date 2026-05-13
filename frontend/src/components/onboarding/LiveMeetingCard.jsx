import { Video as VideoIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export default function LiveMeetingCard({ isActive, onJoinSession }) {
  return (
    <Card className="p-3 flex flex-col h-full overflow-hidden">
      <h3 className="text-xs font-semibold text-text flex items-center gap-1.5 mb-2">
        <VideoIcon className="w-3.5 h-3.5" /> Live Meeting
      </h3>
      <p className="text-[10px] text-text-secondary mb-2">Telemedicine bridge</p>

      <div className="flex-1 bg-gray-900 rounded flex flex-col items-center justify-center text-white/60 min-h-0">
        <VideoIcon className="w-8 h-8 mb-1.5" />
        <p className="text-[10px] font-medium mb-1.5">
          {isActive ? 'Active session' : 'No active session'}
        </p>
        <Button size="sm" onClick={onJoinSession} className="text-xs h-7">
          Join Session
        </Button>
      </div>
    </Card>
  );
}
