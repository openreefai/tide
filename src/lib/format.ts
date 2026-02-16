export function typeBadgeClass(type: string): string {
  switch (type) {
    case 'solo':
      return 'badge-solo';
    case 'shoal':
      return 'badge-shoal';
    case 'school':
      return 'badge-school';
    default:
      return 'bg-muted text-white';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
