'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createToken, deleteToken, fetchActiveToken } from '@/app/dashboard/actions';

export default function TokenManager() {
  const [activeToken, setActiveToken] = useState<{ prefix: string; createdAt: string } | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  useEffect(() => {
    fetchActiveToken()
      .then((data) => setActiveToken(data))
      .catch(() => toast.error('Failed to load token'))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setActionLoading(true);
    try {
      const result = await createToken();
      setNewToken(result.token);
      setActiveToken({ prefix: result.prefix, createdAt: new Date().toISOString() });
    } catch {
      toast.error('Failed to generate token');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevoke() {
    setActionLoading(true);
    try {
      await deleteToken();
      setActiveToken(null);
      setNewToken(null);
      setShowRevokeConfirm(false);
    } catch {
      toast.error('Failed to revoke token');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCopy() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="animate-pulse">
          <div className="h-4 w-24 rounded bg-surface-2" />
          <div className="mt-3 h-10 rounded bg-surface-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold">API Token</h3>
      <p className="mt-1 text-sm text-muted">
        Use an API token to publish formations from the CLI.
      </p>

      {/* Show newly generated token */}
      {newToken && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            This token will only be shown once. Copy it now.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground break-all font-mono">
              {newToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-muted hover:text-foreground transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Current token status */}
      {activeToken && !newToken && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <code className="rounded bg-surface-2 px-2 py-1 font-mono text-accent-light">
            {activeToken.prefix}...
          </code>
          <span className="text-muted">
            Created{' '}
            {new Date(activeToken.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={actionLoading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          {actionLoading ? 'Working...' : activeToken ? 'Regenerate Token' : 'Generate Token'}
        </button>

        {activeToken && !showRevokeConfirm && (
          <button
            onClick={() => setShowRevokeConfirm(true)}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Revoke
          </button>
        )}

        {showRevokeConfirm && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-400">Are you sure?</span>
            <button
              onClick={handleRevoke}
              disabled={actionLoading}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              Yes, revoke
            </button>
            <button
              onClick={() => setShowRevokeConfirm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
