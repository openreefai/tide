import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Mock the admin client
const mockSingle = vi.fn();
const mockIs = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ is: mockIs }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

import { verifyToken } from '@/lib/auth';

describe('verifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for missing Authorization header', async () => {
    const headers = new Headers();
    const result = await verifyToken(headers);
    expect(result).toBeNull();
  });

  it('returns null for malformed header', async () => {
    const headers = new Headers({ Authorization: 'Basic abc' });
    const result = await verifyToken(headers);
    expect(result).toBeNull();
  });

  it('returns null for token not starting with reef_tok_', async () => {
    const headers = new Headers({ Authorization: 'Bearer notavalidtoken' });
    const result = await verifyToken(headers);
    expect(result).toBeNull();
  });

  it('returns user_id for valid active token', async () => {
    const token = 'reef_tok_abc123def456ghi789jkl012mno345pqrstu678';
    const hash = createHash('sha256').update(token).digest('hex');
    mockSingle.mockResolvedValueOnce({
      data: { id: 'token-id-1', user_id: 'user-id-1' },
      error: null,
    });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    const result = await verifyToken(headers);
    expect(result).toEqual({ userId: 'user-id-1', tokenId: 'token-id-1' });
    expect(mockEq).toHaveBeenCalledWith('token_hash', hash);
    expect(mockIs).toHaveBeenCalledWith('revoked_at', null);
  });

  it('returns null for revoked token', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    const headers = new Headers({ Authorization: 'Bearer reef_tok_revoked123456789012345678901234567' });
    const result = await verifyToken(headers);
    expect(result).toBeNull();
  });
});
