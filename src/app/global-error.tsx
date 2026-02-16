'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: '#0a0a0a', color: '#ededed', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '128px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ marginTop: 12, color: '#888' }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#0891b2',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
