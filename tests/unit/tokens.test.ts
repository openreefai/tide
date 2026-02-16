import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Mock chain helpers — track calls precisely
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockSingle = vi.fn();
const mockIs = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

function resetChain() {
  mockSingle.mockReset().mockResolvedValue({ data: null, error: null });
  mockIs.mockReset().mockReturnValue({ single: mockSingle, eq: mockEq });
  mockEq.mockReset().mockReturnValue({ is: mockIs, single: mockSingle });
  mockSelect.mockReset().mockReturnValue({ eq: mockEq });
  mockUpdate.mockReset().mockReturnValue({ eq: mockEq });
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockReset().mockImplementation(() => ({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  }));
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

import { generateApiToken, revokeApiToken, getActiveToken } from '@/lib/tokens';

describe('Token lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  describe('generateApiToken', () => {
    it('returns a token that starts with reef_tok_ and is ~52 chars', async () => {
      const result = await generateApiToken('user-123');
      expect(result.token).toMatch(/^reef_tok_/);
      // reef_tok_ (9 chars) + base64url of 32 bytes (43 chars) = ~52 chars
      expect(result.token.length).toBeGreaterThanOrEqual(50);
      expect(result.token.length).toBeLessThanOrEqual(55);
    });

    it('stores first 13 chars as prefix', async () => {
      const result = await generateApiToken('user-123');
      expect(result.prefix).toBe(result.token.slice(0, 13));
      expect(result.prefix.length).toBe(13);
      expect(result.prefix.startsWith('reef_tok_')).toBe(true);
    });

    it('revokes existing token before creating a new one', async () => {
      await generateApiToken('user-123');

      // First call should be update (revoke), then insert (create)
      const fromCalls = mockFrom.mock.calls;
      expect(fromCalls.length).toBe(2);
      expect(fromCalls[0][0]).toBe('api_tokens'); // revoke call
      expect(fromCalls[1][0]).toBe('api_tokens'); // insert call

      // Verify the update was called (revoke)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.any(String) }),
      );
    });

    it('stores SHA-256 hash, never plaintext', async () => {
      const result = await generateApiToken('user-123');
      const expectedHash = createHash('sha256').update(result.token).digest('hex');

      // The insert call should have the hash, not the plaintext
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          token_hash: expectedHash,
          user_id: 'user-123',
        }),
      );

      // The plaintext should NOT be in the insert call
      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.token_hash).not.toBe(result.token);
    });

    it('throws on insert failure', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'db error' } });
      await expect(generateApiToken('user-123')).rejects.toThrow('Failed to create token: db error');
    });
  });

  describe('revokeApiToken', () => {
    it('sets revoked_at on active token', async () => {
      await revokeApiToken('user-456');

      expect(mockFrom).toHaveBeenCalledWith('api_tokens');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.any(String) }),
      );
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-456');
      expect(mockIs).toHaveBeenCalledWith('revoked_at', null);
    });

    it('is a no-op when no active token exists', async () => {
      // The update call succeeds even if no rows are matched — no error
      await expect(revokeApiToken('user-no-token')).resolves.toBeUndefined();
    });
  });

  describe('getActiveToken', () => {
    it('returns null when no active token exists', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await getActiveToken('user-789');
      expect(result).toBeNull();
    });

    it('returns prefix and createdAt for active token', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { token_prefix: 'reef_tok_abc1', created_at: '2025-01-01T00:00:00Z' },
        error: null,
      });
      const result = await getActiveToken('user-789');
      expect(result).toEqual({
        prefix: 'reef_tok_abc1',
        createdAt: '2025-01-01T00:00:00Z',
      });
    });
  });
});
