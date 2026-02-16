import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mock Supabase query builder ---

const mockRange = vi.fn();
const mockOrder = vi.fn();
const mockOr = vi.fn();
const mockIn = vi.fn();
const mockEqFilter = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();

function resetQueryChain(data: unknown[] = [], count: number = 0) {
  mockRange.mockReset().mockResolvedValue({ data, count, error: null });
  mockOrder.mockReset().mockReturnValue({ range: mockRange });
  mockIn.mockReset().mockReturnValue({ order: mockOrder, range: mockRange });
  mockOr.mockReset().mockReturnValue({ order: mockOrder, range: mockRange });
  mockEqFilter.mockReset().mockReturnValue({ in: mockIn, or: mockOr, order: mockOrder, range: mockRange });
  mockSelect.mockReset().mockReturnValue({ eq: mockEqFilter, in: mockIn, or: mockOr, order: mockOrder, range: mockRange });
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

// Mock @/lib/search for semantic search tests
const mockSemanticSearch = vi.fn();
vi.mock('@/lib/search', () => ({
  semanticSearch: (...args: unknown[]) => mockSemanticSearch(...args),
}));

// Ensure OPENAI_API_KEY is unset so semantic search is skipped by default
const originalEnv = process.env.OPENAI_API_KEY;
beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  mockSemanticSearch.mockReset();
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

  it('passes semantic match names to stars RPC when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockSemanticSearch.mockResolvedValue([{ name: 'alpha' }, { name: 'beta' }]);

    const starsResult = [
      { id: '1', name: 'alpha', star_count: 5, total_count: 2 },
      { id: '2', name: 'beta', star_count: 3, total_count: 2 },
    ];
    mockRpc.mockResolvedValue({ data: starsResult, error: null });

    const response = await GET(createListRequest({ q: 'test', sort: 'stars' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.formations).toEqual(starsResult);
    // Verify RPC was called with p_names (semantic results) and p_query null
    expect(mockRpc).toHaveBeenCalledWith('list_formations_by_stars', {
      p_type: null,
      p_query: null,
      p_names: ['alpha', 'beta'],
      p_limit: 20,
      p_offset: 0,
    });
  });

  it('falls back to text search in stars RPC when semantic search fails', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockSemanticSearch.mockRejectedValue(new Error('OpenAI down'));

    mockRpc.mockResolvedValue({ data: [], error: null });

    const response = await GET(createListRequest({ q: 'test', sort: 'stars' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // Verify RPC was called with p_query (text fallback) and p_names null
    expect(mockRpc).toHaveBeenCalledWith('list_formations_by_stars', {
      p_type: null,
      p_query: 'test',
      p_names: null,
      p_limit: 20,
      p_offset: 0,
    });
  });
});
