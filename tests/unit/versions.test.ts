import { describe, it, expect } from 'vitest';
import { computeLatestVersion } from '@/lib/versions';

describe('computeLatestVersion', () => {
  it('returns highest non-prerelease version', () => {
    const versions = [
      { version: '0.1.0', status: 'published', is_prerelease: false },
      { version: '0.2.0', status: 'published', is_prerelease: false },
      { version: '0.3.0-beta.1', status: 'published', is_prerelease: true },
    ];
    expect(computeLatestVersion(versions)).toBe('0.2.0');
  });

  it('returns null when no published non-prerelease versions', () => {
    const versions = [
      { version: '1.0.0-alpha.1', status: 'published', is_prerelease: true },
      { version: '1.0.0', status: 'failed', is_prerelease: false },
    ];
    expect(computeLatestVersion(versions)).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(computeLatestVersion([])).toBeNull();
  });
});
