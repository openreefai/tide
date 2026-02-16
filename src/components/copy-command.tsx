'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface CopyCommandProps {
  command: string;
}

export default function CopyCommand({ command }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5">
      <code className="flex-1 text-sm text-accent-light">$ {command}</code>
      <button
        onClick={handleCopy}
        className="relative shrink-0 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
        aria-label="Copy command"
        title="Copy to clipboard"
      >
        <svg
          className={`h-4 w-4 transition-opacity duration-200 ${copied ? 'opacity-0' : 'opacity-100'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <svg
          className={`absolute inset-0 m-auto h-4 w-4 text-green-400 transition-opacity duration-200 ${copied ? 'opacity-100' : 'opacity-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  );
}
