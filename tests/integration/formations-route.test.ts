import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mock Supabase query builder ---

const mockRange = vi.fn();
const mockOrder = vi.fn();
const mockOr = vi.fn();
const mockEqFilter = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();

function resetQueryChain(data: unknown[] = [], count: number = 0) {
  mockRange.mockReset().mockResolvedValue({ data, count, error: null });
  mockOrder.mockReset().mockReturnValue({ range: mockRange });
  mockOr.mockReset().mockReturnValue({ order: mockOrder, range: mockRange });
  mockEqFilter.mockReset().mockReturnValue({ or: mockOr, order: mockOrder, range: mockRange });
  mockSelect.mockReset().mockReturnValue({ eq: mockEqFilter, or: mockOr, order: mockOrder, range: mockRange });
  mockRpc.mockReset().mockResolvedValue({ data: [], error: null });
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({ select: mockSelect })),
      rpc: mockRpc,
    }),
  ),
}));

// Ensure OPENAI_API_KEY is unset so semantic search is skipped
const originalEnv = process.env.OPENAI_API_KEY;
beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

import { GET } from '@/app/api/formations/route';

// --- Helpers ---

function createListRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/formations');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

// --- Tests ---

describe('GET /api/formations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueryChain();
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv;
    }
  });

  it('returns a paginated list of formations', async () => {
    const formations = [
      { id: '1', name: 'alpha', description: 'First', type: 'solo', latest_version: '1.0.0' },
      { id: '2', name: 'beta', description: 'Second', type: 'ensemble', latest_version: '0.1.0' },
    ];
    resetQueryChain(formations, 2);

    const response = await GET(createListRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.formations).toEqual(formations);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it('filters formations by type', async () => {
    const formations = [
      { id: '1', name: 'alpha', description: 'First', type: 'ensemble', latest_version: '1.0.0' },
    ];
    resetQueryChain(formations, 1);

    const response = await GET(createListRequest({ type: 'ensemble' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.formations).toEqual(formations);
    expect(mockEqFilter).toHaveBeenCalledWith('type', 'ensemble');
  });

  it('sanitizes search query to prevent filter injection', async () => {
    resetQueryChain([], 0);

    await GET(createListRequest({ q: 'test(,).%hack' }));

    // The sanitized query should have special chars removed: "testhack"
    expect(mockOr).toHaveBeenCalledWith(
      'name.ilike.%testhack%,description.ilike.%testhack%',
    );
  });

  it('handles empty results', async () => {
    resetQueryChain([], 0);

    const response = await GET(createListRequest({ q: 'nonexistent' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.formations).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('respects page and limit parameters', async () => {
    resetQueryChain([], 0);

    await GET(createListRequest({ page: '3', limit: '10' }));

    // Page 3 with limit 10 should request range(20, 29)
    expect(mockRange).toHaveBeenCalledWith(20, 29);
  });

  it('clamps limit to max 100', async () => {
    resetQueryChain([], 0);

    const response = await GET(createListRequest({ limit: '999' }));
    const body = await response.json();

    expect(body.limit).toBe(100);
  });

  it('clamps page to minimum 1', async () => {
    resetQueryChain([], 0);

    const response = await GET(createListRequest({ page: '-5' }));
    const body = await response.json();

    expect(body.page).toBe(1);
  });

  it('returns 500 when the database query fails', async () => {
    mockRange.mockResolvedValue({ data: null, count: null, error: { message: 'connection refused' } });

    const response = await GET(createListRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('connection refused');
  });
});
