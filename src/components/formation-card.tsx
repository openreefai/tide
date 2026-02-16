import Link from 'next/link';
import { typeBadgeClass } from '@/lib/format';

interface FormationCardProps {
  name: string;
  description: string;
  type: string;
  latest_version: string | null;
  total_downloads: number;
  stars?: number;
}

export default function FormationCard({
  name,
  description,
  type,
  latest_version,
  total_downloads,
  stars,
}: FormationCardProps) {
  return (
    <Link
      href={`/formations/${name}`}
      className="group block rounded-lg border border-border bg-surface p-5 transition-all hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-base font-semibold text-accent-light group-hover:text-accent">
          {name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(type)}`}
        >
          {type}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-muted">
        {description || 'No description'}
      </p>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted">
        {latest_version && (
          <span className="font-mono">v{latest_version}</span>
        )}
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {total_downloads.toLocaleString()}
        </span>
        {stars !== undefined && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            {stars}
          </span>
        )}
      </div>
    </Link>
  );
}
