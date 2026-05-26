import { describe, it, expect } from 'vitest';
import { WebAuthnServer } from '@/server';
import { MemoryStorageAdapter } from '@/adapters/memory';

const SECRET = 'test-encryption-secret-at-least-32-characters-long';

function makeServer(adapter: MemoryStorageAdapter): WebAuthnServer {
  return new WebAuthnServer({
    rpName: 'Test',
    rpID: 'example.com',
    origin: 'https://example.com',
    encryptionSecret: SECRET,
    storageAdapter: adapter,
  });
}

describe('SessionManager.validateSession — stored-session expiry (HYG-N3)', () => {
  it('rejects when a (non-filtering) adapter returns an expired stored session', async () => {
    const adapter = new MemoryStorageAdapter();
    const server = makeServer(adapter);
    const token = await server.createSession('user-1', 'cred-1', true);

    // Simulate a custom adapter that does NOT filter expiry in find().
    adapter.sessions.find = () =>
      Promise.resolve({
        userId: 'user-1',
        credentialId: 'cred-1',
        userVerified: true,
        expiresAt: new Date(Date.now() - 1000),
      });

    await expect(server.validateSession(token)).rejects.toThrow(/expired/i);
  });

  it('validates a live session normally', async () => {
    const adapter = new MemoryStorageAdapter();
    const server = makeServer(adapter);
    const token = await server.createSession('user-2', 'cred-2', true);

    const result = await server.validateSession(token);
    expect(result.valid).toBe(true);
    expect(result.sessionData?.userId).toBe('user-2');
  });
});
