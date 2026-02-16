import semver from 'semver';

interface VersionRow {
  version: string;
  status: string;
  is_prerelease: boolean;
}

export function computeLatestVersion(versions: VersionRow[]): string | null {
  const eligible = versions
    .filter((v) => v.status === 'published' && !v.is_prerelease)
    .map((v) => v.version);

  if (eligible.length === 0) return null;

  const sorted = semver.rsort([...eligible]);
  return sorted[0] ?? null;
}
