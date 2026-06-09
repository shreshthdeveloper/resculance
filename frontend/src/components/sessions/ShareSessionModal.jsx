import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, ExternalLink, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

/**
 * Share dialog for a session detail page. Shows the public, read-only link and
 * a scannable QR code. The link is PIN-gated on open (PIN configured by a
 * superadmin under Settings → Public Sharing).
 */
export default function ShareSessionModal({ isOpen, onClose, sessionId, sessionCode }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/sessions/${sessionId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — select fallback.
      const input = document.getElementById('share-session-url');
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Session">
      <div className="space-y-5">
        <p className="text-sm text-secondary">
          Anyone with this link can open a <span className="font-medium text-text">read-only</span> view of
          {sessionCode ? <> session <span className="font-mono font-semibold text-primary">{sessionCode}</span></> : ' this session'}.
          If an access PIN is required, viewers will be prompted for it.
        </p>

        {/* QR code */}
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
            <QRCodeCanvas value={shareUrl} size={180} includeMargin level="M" />
          </div>
        </div>

        {/* Link + copy */}
        <div>
          <label className="text-xs font-medium text-secondary mb-1.5 block">Shareable link</label>
          <div className="flex items-center gap-2">
            <input
              id="share-session-url"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background-card text-text font-mono truncate"
            />
            <Button variant="outline" size="sm" onClick={handleCopy} className="flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-secondary bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
          <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>
            Viewers must enter the access PIN. Manage the PIN and turn sharing on/off under
            <span className="font-medium text-text"> Settings → Public Sharing</span> (superadmin only).
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => window.open(shareUrl, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" /> Open link
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
