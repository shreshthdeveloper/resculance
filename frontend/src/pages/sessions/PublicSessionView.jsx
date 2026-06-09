import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Eye, AlertCircle, Activity } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { publicSessionService } from '../../services';
import SessionDetailView, { SessionStatusBadge } from '../../components/sessions/SessionDetailView';
import logo from '../../assets/logo.png';

/**
 * Standalone, login-free, read-only session view. Reached at /sessions/:id when
 * no user is authenticated.
 *
 * On open it tries to load the session with no PIN: if the superadmin has
 * sharing on without requiring a PIN, it renders straight away; otherwise it
 * shows the PIN gate. If sharing is disabled, it shows an unavailable screen.
 */
export default function PublicSessionView() {
  const { sessionId } = useParams();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [metadata, setMetadata] = useState(null);
  // 'loading' | 'gate' | 'view' | 'unavailable'
  const [phase, setPhase] = useState('loading');
  const [unavailableMsg, setUnavailableMsg] = useState('');

  const attemptLoad = useCallback(async (pinValue, { initial = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await publicSessionService.getSession(sessionId, pinValue);
      const sessionData = response.data?.data?.session;
      if (!sessionData) throw new Error('not_found');
      setSession(sessionData);
      setMetadata(sessionData?.metadata || null);
      setPhase('view');
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || '';

      if (status === 404) {
        setUnavailableMsg('This session could not be found.');
        setPhase('unavailable');
      } else if (status === 403 && /disabled|not configured/i.test(message)) {
        setUnavailableMsg(message || 'This shared link is currently unavailable.');
        setPhase('unavailable');
      } else if (status === 403) {
        // A PIN is required (or the one supplied was wrong).
        if (!initial) setError(message || 'Invalid PIN. Please try again.');
        setPhase('gate');
      } else if (initial) {
        // Network/other error on the silent first attempt — fall back to the gate.
        setPhase('gate');
      } else {
        setError(message || 'Unable to load this session. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Silent first attempt (covers the "no PIN required" case).
  useEffect(() => {
    attemptLoad('', { initial: true });
  }, [attemptLoad]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter the access PIN');
      return;
    }
    attemptLoad(pin.trim());
  };

  // Initial silent load
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-secondary">Loading session…</p>
        </div>
      </div>
    );
  }

  // Sharing disabled / not found
  if (phase === 'unavailable') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <img src={logo} alt="Resculance" className="h-12 mx-auto mb-4" />
          <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-error" />
          </div>
          <h1 className="text-2xl font-display font-bold text-text mb-2">Link Unavailable</h1>
          <p className="text-sm text-secondary">{unavailableMsg}</p>
        </Card>
      </div>
    );
  }

  // PIN gate
  if (phase === 'gate') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <img src={logo} alt="Resculance" className="h-12 mb-4" />
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-display font-bold text-text">Protected Session</h1>
              <p className="text-sm text-secondary mt-2">
                Enter the access PIN to view this shared, read-only session record.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Access PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(''); }}
                  placeholder="Enter PIN"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background-card text-text text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                <ShieldCheck className="w-4 h-4 mr-2" /> View Session
              </Button>
            </form>

            <p className="text-[11px] text-secondary text-center mt-6">
              This is a secure, read-only view. No changes can be made here.
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Read-only session view
  return (
    <div className="min-h-screen bg-background">
      {/* Public top bar */}
      <header className="sticky top-0 z-10 bg-background-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="Resculance" className="h-8" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-text truncate">Session Details</p>
              <p className="text-xs text-secondary truncate">
                Code: <span className="font-mono font-semibold text-primary">{session.session_code}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
              <Eye className="w-3.5 h-3.5" /> Read-only
            </span>
            <SessionStatusBadge status={session.status} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-12">
        <SessionDetailView session={session} metadata={metadata} />
        <div className="flex items-center justify-center gap-2 text-xs text-secondary pt-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Powered by Resculance
        </div>
      </main>
    </div>
  );
}
