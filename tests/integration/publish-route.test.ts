import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockVerifyToken = vi.fn();
vi.mock('@/lib/auth', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

const mockPublishFormation = vi.fn();
vi.mock('@/lib/publish', () => ({
  publishFormation: (...args: unknown[]) => mockPublishFormation(...args),
}));

import { POST } from '@/app/api/formations/[name]/publish/route';

// --- Helpers ---

function createRequest(name: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new NextRequest(`http://localhost:3000/api/formations/${name}/publish`, {
    method: 'POST',
    headers,
  });
}

function buildParams(name: string): { params: Promise<{ name: string }> } {
  return { params: Promise.resolve({ name }) };
}

/** Create a mock File-like object that matches what formData.get() returns. */
function createMockFile(content: Buffer): File {
  return {
    arrayBuffer: () => Promise.resolve(content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    )),
    name: 'formation.tar.gz',
    size: content.length,
    type: 'application/gzip',
  } as unknown as File;
}

/**
 * Attach a mocked formData method to a NextRequest.
 * This bypasses jsdom's webidl limitations with multipart parsing.
 */
function withFormData(
  request: NextRequest,
  tarball: Buffer | null,
): NextRequest {
  const formData = new Map<string, File | null>();
  if (tarball) {
    formData.set('tarball', createMockFile(tarball));
  }
  request.formData = () =>
    Promise.resolve({
      get: (key: string) => formData.get(key) ?? null,
    } as unknown as FormData);
  return request;
}

// --- Tests ---

describe('POST /api/formations/[name]/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without an authorization token', async () => {
    mockVerifyToken.mockResolvedValue(null);
    const request = withFormData(
      createRequest('my-formation'),
      Buffer.from('fake'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockPublishFormation).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid token', async () => {
    mockVerifyToken.mockResolvedValue(null);
    const request = withFormData(
      createRequest('my-formation', 'bad-token'),
      Buffer.from('fake'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockPublishFormation).not.toHaveBeenCalled();
  });

  it('rejects requests with missing tarball', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    const request = withFormData(
      createRequest('my-formation', 'reef_tok_valid'),
      null,
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing tarball');
  });

  it('returns 400 when publish rejects due to tarball size', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    mockPublishFormation.mockRejectedValue(new Error('Tarball exceeds 10MB limit'));

    const request = withFormData(
      createRequest('my-formation', 'reef_tok_valid'),
      Buffer.from('data'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Tarball exceeds');
  });

  it('returns 400 when manifest validation fails', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    mockPublishFormation.mockRejectedValue(
      new Error('Tarball does not contain reef.json at root'),
    );

    const request = withFormData(
      createRequest('my-formation', 'reef_tok_valid'),
      Buffer.from('data'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('does not contain reef.json');
  });

  it('returns 403 when name is reserved', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    mockPublishFormation.mockRejectedValue(new Error('Name "core" is reserved'));

    const request = withFormData(
      createRequest('core', 'reef_tok_valid'),
      Buffer.from('data'),
    );
    const response = await POST(request, buildParams('core'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('reserved');
  });

  it('returns 409 when version is already published', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    mockPublishFormation.mockRejectedValue(
      new Error('Version 1.0.0 already published'),
    );

    const request = withFormData(
      createRequest('my-formation', 'reef_tok_valid'),
      Buffer.from('data'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('already published');
  });

  it('returns 403 when user is not the formation owner', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    mockPublishFormation.mockRejectedValue(
      new Error('Not the formation owner'),
    );

    const request = withFormData(
      createRequest('my-formation', 'reef_tok_valid'),
      Buffer.from('data'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('Not the formation owner');
  });

  it('returns success on the happy path', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user-1', tokenId: 'tok-1' });
    mockPublishFormation.mockResolvedValue({
      ok: true,
      name: 'my-formation',
      version: '1.0.0',
      url: 'https://tide.openreef.ai/formations/my-formation',
    });

    const request = withFormData(
      createRequest('my-formation', 'reef_tok_valid'),
      Buffer.from('data'),
    );
    const response = await POST(request, buildParams('my-formation'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.name).toBe('my-formation');
    expect(body.version).toBe('1.0.0');
    expect(mockPublishFormation).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'my-formation',
      tarball: expect.any(Buffer),
    });
  });
});
