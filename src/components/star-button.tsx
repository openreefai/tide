'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface StarButtonProps {
  formationName: string;
  initialStars: number;
}

export default function StarButton({ formationName, initialStars }: StarButtonProps) {
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState(initialStars);
  const [loading, setLoading] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setHasUser(true);
      // Check if user already starred this formation
      fetch(`/api/formations/${formationName}`, { credentials: 'include' })
        .then(() => {
          // We check the user's stars list to see if this formation is starred
          return fetch('/api/user/stars', { credentials: 'include' });
        })
        .then((res) => res.json())
        .then((data) => {
          if (data.stars) {
            const isStarred = data.stars.some(
              (s: { formations: { name: string } | null }) => s.formations?.name === formationName,
            );
            setStarred(isStarred);
          }
        })
        .catch(() => {});
    });
  }, [formationName]);

  async function handleToggle() {
    if (!hasUser) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);

    // Optimistic update
    const wasStarred = starred;
    setStarred(!wasStarred);
    setStarCount((prev) => prev + (wasStarred ? -1 : 1));

    try {
      const res = await fetch(`/api/formations/${formationName}/star`, {
        method: wasStarred ? 'DELETE' : 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        // Revert on error
        setStarred(wasStarred);
        setStarCount((prev) => prev + (wasStarred ? 1 : -1));
      }
    } catch {
      // Revert on error
      setStarred(wasStarred);
      setStarCount((prev) => prev + (wasStarred ? 1 : -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
        starred
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          : 'border-border text-muted hover:border-muted hover:text-foreground'
      } disabled:opacity-50`}
    >
      <svg
        className="h-4 w-4"
        fill={starred ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
      <span>{starCount}</span>
    </button>
  );
}
