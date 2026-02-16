import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockVerifyToken = vi.fn();
vi.mock('@/lib/auth', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

const mockDeleteTarball = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/storage', () => ({
  deleteTarball: (...args: unknown[]) => mockDeleteTarball(...args),
}));

const mockComputeLatestVersion = vi.fn();
vi.mock('@/lib/versions', () => ({
  computeLatestVersion: (...args: unknown[]) => mockComputeLatestVersion(...args),
}));

// Admin client mock — use a from() function that dispatches by table name
const mockAdminRpc = vi.fn();
let fromHandlers: Record<string, () => unknown> = {};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      const handler = fromHandlers[table];
      if (handler) return handler();
      throw new Error(`Unexpected admin.from('${table}')`);
    },
    rpc: (...args: unknown[]) => mockAdminRpc(...args),
  })),
}));

// Server client mock (unused by DELETE handler but needed by the module import)
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({ select: vi.fn() })),
    }),
  ),
}));

import { DELETE } from '@/app/api/formations/[name]/[version]/route';

// --- Helpers ---

function createRequest(name: string, version: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new NextRequest(
    `http://localhost:3000/api/formations/${name}/${version}`,
    { method: 'DELETE', headers },
  );
}

function buildParams(
  name: string,
  version: string,
): { params: Promise<{ name: string; version: string }> } {
  return { params: Promise.resolve({ name, version }) };
}

/**
 * Build a chain mock for: admin.from('formations').select('id, owner_id').eq('name', name).single()
 */
function mockFormationLookup(result: { data: unknown; error: unknown }) {
  return () => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  });
}

/**
 * Build a chain mock for formation_versions that handles multiple queries:
 * 1. admin.from('formation_versions').select('version, status, is_prerelease').eq('formation_id', id)
 * 2. admin.from('formation_versions').select('reef_json').eq('formation_id', id).eq('version', v).single()
 */
function mockFormationVersionsQueries(
  allVersionsResult: { data: unknown; error: unknown },
  latestReefJsonResult?: { data: unknown; error: unknown },
) {
  let callCount = 0;
  return () => {
    callCount++;
    if (callCount === 1) {
      // allVersions query: .select(...).eq('formation_id', id) returns data directly
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(allVersionsResult),
        }),
      };
    }
    // reef_json lookup: .select('reef_json').eq('formation_id', id).eq('version', v).single()
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(latestReefJsonResult ?? { data: null, error: null }),
          }),
        }),
      }),
    };
  };
}

// --- Tests ---

describe('DELETE /api/formations/[name]/[version]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandlers = {};
    mockAdminRpc.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const response = await DELETE(
      createRequest('my-formation', '1.0.0'),
      buildParams('my-formation', '1.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when formation does not exist', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    fromHandlers['formations'] = mockFormationLookup({ data: null, error: null });

    const response = await DELETE(
      createRequest('nonexistent', '1.0.0', 'reef_tok_valid'),
      buildParams('nonexistent', '1.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Formation not found');
  });

  it('returns 403 when user is not the formation owner', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    fromHandlers['formations'] = mockFormationLookup({
      data: { id: 'form-1', owner_id: 'user-other' },
      error: null,
    });

    const response = await DELETE(
      createRequest('my-formation', '1.0.0', 'reef_tok_valid'),
      buildParams('my-formation', '1.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Not the formation owner');
  });

  it('passes repository_url from new latest version to unpublish_version RPC', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });

    fromHandlers['formations'] = mockFormationLookup({
      data: { id: 'form-1', owner_id: 'user-1' },
      error: null,
    });

    const allVersions = [
      { version: '1.0.0', status: 'published', is_prerelease: false },
      { version: '2.0.0', status: 'published', is_prerelease: false },
    ];
    const newLatestReefJson = {
      description: 'Version one description',
      type: 'solo',
      license: 'MIT',
      repository: 'https://github.com/openreefai/my-formation',
    };

    fromHandlers['formation_versions'] = mockFormationVersionsQueries(
      { data: allVersions, error: null },
      { data: { reef_json: newLatestReefJson }, error: null },
    );

    mockComputeLatestVersion.mockReturnValue('1.0.0');

    mockAdminRpc.mockResolvedValue({
      data: 'formations/form-1/2.0.0.tar.gz',
      error: null,
    });

    const response = await DELETE(
      createRequest('my-formation', '2.0.0', 'reef_tok_valid'),
      buildParams('my-formation', '2.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    expect(mockAdminRpc).toHaveBeenCalledWith('unpublish_version', {
      p_formation_id: 'form-1',
      p_version: '2.0.0',
      p_new_latest: '1.0.0',
      p_expected_version_count: 2,
      p_new_latest_description: 'Version one description',
      p_new_latest_type: 'solo',
      p_new_latest_license: 'MIT',
      p_repository_url: 'https://github.com/openreefai/my-formation',
    });
  });

  it('passes null repository_url when new latest version has no repository field', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });

    fromHandlers['formations'] = mockFormationLookup({
      data: { id: 'form-1', owner_id: 'user-1' },
      error: null,
    });

    const allVersions = [
      { version: '1.0.0', status: 'published', is_prerelease: false },
      { version: '2.0.0', status: 'published', is_prerelease: false },
    ];
    const newLatestReefJson = {
      description: 'Version one',
      type: 'solo',
      license: 'Apache-2.0',
    };

    fromHandlers['formation_versions'] = mockFormationVersionsQueries(
      { data: allVersions, error: null },
      { data: { reef_json: newLatestReefJson }, error: null },
    );

    mockComputeLatestVersion.mockReturnValue('1.0.0');

    mockAdminRpc.mockResolvedValue({
      data: 'formations/form-1/2.0.0.tar.gz',
      error: null,
    });

    const response = await DELETE(
      createRequest('my-formation', '2.0.0', 'reef_tok_valid'),
      buildParams('my-formation', '2.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    expect(mockAdminRpc).toHaveBeenCalledWith('unpublish_version', {
      p_formation_id: 'form-1',
      p_version: '2.0.0',
      p_new_latest: '1.0.0',
      p_expected_version_count: 2,
      p_new_latest_description: 'Version one',
      p_new_latest_type: 'solo',
      p_new_latest_license: 'Apache-2.0',
      p_repository_url: null,
    });
  });
});
