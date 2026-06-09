import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, XCircle, Share2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { sessionService } from '../../services';
import { useToast } from '../../hooks/useToast';
import SessionDetailView, { SessionStatusBadge } from '../../components/sessions/SessionDetailView';
import ShareSessionModal from '../../components/sessions/ShareSessionModal';

export default function SessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const response = await sessionService.getById(sessionId);
      const sessionData = response.data?.data?.session;
      setSession(sessionData);
      setMetadata(sessionData?.metadata || null);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      toast.error('Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-secondary">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <XCircle className="w-16 h-16 text-error mb-4" />
        <h2 className="text-2xl font-bold mb-2">Session Not Found</h2>
        <p className="text-secondary mb-4">The requested session could not be found.</p>
        <Button onClick={() => navigate('/sessions')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate('/sessions')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-display font-bold">Session Details</h1>
            <p className="text-secondary mt-1">Session Code: <span className="font-mono font-semibold text-primary">{session.session_code}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowShare(true)}>
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <SessionStatusBadge status={session.status} />
        </div>
      </div>

      <SessionDetailView session={session} metadata={metadata} />

      <ShareSessionModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        sessionId={sessionId}
        sessionCode={session.session_code}
      />
    </div>
  );
}
