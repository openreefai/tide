import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mock Supabase query builders ---

// Server client (public reads via RLS)
const mockServerSingle = vi.fn();
const mockServerEq = vi.fn();
const mockServerSelect = vi.fn();

function resetServerChain() {
  mockServerSingle.mockReset();
  mockServerEq.mockReset().mockReturnValue({ single: mockServerSingle, eq: mockServerEq });
  mockServerSelect.mockReset().mockReturnValue({ eq: mockServerEq });
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({ select: mockServerSelect })),
    }),
  ),
}));

// Admin client (for increment_downloads)
const mockAdminRpc = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockAdminRpc,
  })),
}));

// Storage
const mockCreateSignedDownloadUrl = vi.fn();
vi.mock('@/lib/storage', () => ({
  createSignedDownloadUrl: (...args: unknown[]) => mockCreateSignedDownloadUrl(...args),
}));

import { GET } from '@/app/api/formations/[name]/[version]/download/route';

// --- Helpers ---

function createDownloadRequest(name: string, version: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/formations/${name}/${version}/download`,
  );
}

function buildParams(
  name: string,
  version: string,
): { params: Promise<{ name: string; version: string }> } {
  return { params: Promise.resolve({ name, version }) };
}

// --- Tests ---

describe('GET /api/formations/[name]/[version]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServerChain();
    mockAdminRpc.mockResolvedValue({ error: null });
  });

  it('returns a signed URL redirect for a valid formation and version', async () => {
    // First query: formation lookup
    mockServerSingle
      .mockResolvedValueOnce({ data: { id: 'form-1' }, error: null })
      // Second query: version lookup
      .mockResolvedValueOnce({
        data: { tarball_path: 'formations/form-1/1.0.0.tar.gz' },
        error: null,
      });

    mockCreateSignedDownloadUrl.mockResolvedValue(
      'https://storage.example.com/signed?token=abc',
    );

    const response = await GET(
      createDownloadRequest('my-formation', '1.0.0'),
      buildParams('my-formation', '1.0.0'),
    );

    // NextResponse.redirect returns a 302 by default
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.example.com/signed?token=abc',
    );
    expect(mockCreateSignedDownloadUrl).toHaveBeenCalledWith(
      'formations/form-1/1.0.0.tar.gz',
    );
    expect(mockAdminRpc).toHaveBeenCalledWith('increment_downloads', {
      formation_name: 'my-formation',
    });
  });

  it('returns 404 when formation does not exist', async () => {
    mockServerSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await GET(
      createDownloadRequest('nonexistent', '1.0.0'),
      buildParams('nonexistent', '1.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Formation not found');
  });

  it('returns 404 when version does not exist', async () => {
    // Formation exists
    mockServerSingle
      .mockResolvedValueOnce({ data: { id: 'form-1' }, error: null })
      // Version does not exist
      .mockResolvedValueOnce({ data: null, error: null });

    const response = await GET(
      createDownloadRequest('my-formation', '99.0.0'),
      buildParams('my-formation', '99.0.0'),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Version not found');
  });

  it('still returns the download even if increment_downloads fails', async () => {
    mockServerSingle
      .mockResolvedValueOnce({ data: { id: 'form-1' }, error: null })
      .mockResolvedValueOnce({
        data: { tarball_path: 'formations/form-1/1.0.0.tar.gz' },
        error: null,
      });

    mockCreateSignedDownloadUrl.mockResolvedValue(
      'https://storage.example.com/signed?token=abc',
    );
    mockAdminRpc.mockRejectedValue(new Error('db unavailable'));

    const response = await GET(
      createDownloadRequest('my-formation', '1.0.0'),
      buildParams('my-formation', '1.0.0'),
    );

    // The download should still succeed despite the analytics failure
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.example.com/signed?token=abc',
    );
  });
});
