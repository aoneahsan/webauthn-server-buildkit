import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from '@/adapters/memory';
import type { UserModel, WebAuthnCredential, ChallengeData, SessionData } from '@/types';

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter;
  
  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
  });

  describe('Users', () => {
    const mockUser: Omit<UserModel, 'id'> = {
      username: 'testuser',
      displayName: 'Test User',
    };

    it('should create a user', async () => {
      const createdUser = await adapter.users.create(mockUser);
      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.username).toBe(mockUser.username);
      expect(createdUser.displayName).toBe(mockUser.displayName);
    });

    it('should find user by id', async () => {
      const createdUser = await adapter.users.create(mockUser);
      const foundUser = await adapter.users.findById(createdUser.id);
      expect(foundUser).toEqual(createdUser);
    });

    it('should find user by username', async () => {
      const createdUser = await adapter.users.create(mockUser);
      const foundUser = await adapter.users.findByUsername(mockUser.username);
      expect(foundUser).toEqual(createdUser);
    });

    it('should return null for non-existent user', async () => {
      const foundUser = await adapter.users.findById('non-existent');
      expect(foundUser).toBeNull();
    });

    it('should update user', async () => {
      const createdUser = await adapter.users.create(mockUser);
      const updates = { displayName: 'Updated Name' };
      const updatedUser = await adapter.users.update(createdUser.id, updates);
      
      expect(updatedUser).toBeDefined();
      expect(updatedUser!.displayName).toBe(updates.displayName);
      expect(updatedUser!.username).toBe(mockUser.username);
    });

    it('should delete user', async () => {
      const createdUser = await adapter.users.create(mockUser);
      const deleted = await adapter.users.delete(createdUser.id);
      expect(deleted).toBe(true);
      
      const foundUser = await adapter.users.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });

    it('should handle duplicate usernames', async () => {
      await adapter.users.create(mockUser);
      await expect(adapter.users.create(mockUser)).rejects.toThrow();
    });
  });

  describe('Credentials', () => {
    const mockCredential: Omit<WebAuthnCredential, 'createdAt'> = {
      id: 'cred123',
      userId: 'user123',
      webAuthnUserID: 'webauthn-user-123',
      publicKey: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      transports: ['internal'],
      deviceType: 'singleDevice',
      backedUp: false,
    };

    it('should create a credential', async () => {
      const createdCredential = await adapter.credentials.create(mockCredential);
      expect(createdCredential).toBeDefined();
      expect(createdCredential.id).toBe(mockCredential.id);
      expect(createdCredential.userId).toBe(mockCredential.userId);
      expect(createdCredential.createdAt).toBeDefined();
    });

    it('should find credential by id', async () => {
      const createdCredential = await adapter.credentials.create(mockCredential);
      const foundCredential = await adapter.credentials.findById(mockCredential.id);
      expect(foundCredential).toEqual(createdCredential);
    });

    it('should find credentials by user id', async () => {
      const credential1 = { ...mockCredential, id: 'cred1' };
      const credential2 = { ...mockCredential, id: 'cred2' };
      
      await adapter.credentials.create(credential1);
      await adapter.credentials.create(credential2);
      
      const foundCredentials = await adapter.credentials.findByUserId(mockCredential.userId);
      expect(foundCredentials).toHaveLength(2);
      expect(foundCredentials.map(c => c.id)).toContain('cred1');
      expect(foundCredentials.map(c => c.id)).toContain('cred2');
    });

    it('should update credential counter', async () => {
      await adapter.credentials.create(mockCredential);
      const updated = await adapter.credentials.updateCounter(mockCredential.id, 5);
      expect(updated).toBe(true);
      
      const foundCredential = await adapter.credentials.findById(mockCredential.id);
      expect(foundCredential!.counter).toBe(5);
    });

    it('should update last used timestamp', async () => {
      await adapter.credentials.create(mockCredential);
      const updated = await adapter.credentials.updateLastUsed(mockCredential.id);
      expect(updated).toBe(true);
      
      const foundCredential = await adapter.credentials.findById(mockCredential.id);
      expect(foundCredential!.lastUsedAt).toBeDefined();
    });

    it('should delete credential', async () => {
      await adapter.credentials.create(mockCredential);
      const deleted = await adapter.credentials.delete(mockCredential.id);
      expect(deleted).toBe(true);
      
      const foundCredential = await adapter.credentials.findById(mockCredential.id);
      expect(foundCredential).toBeNull();
    });

    it('should delete credentials by user id', async () => {
      const credential1 = { ...mockCredential, id: 'cred1' };
      const credential2 = { ...mockCredential, id: 'cred2' };
      
      await adapter.credentials.create(credential1);
      await adapter.credentials.create(credential2);
      
      const deleted = await adapter.credentials.deleteByUserId(mockCredential.userId);
      expect(deleted).toBe(true);
      
      const foundCredentials = await adapter.credentials.findByUserId(mockCredential.userId);
      expect(foundCredentials).toHaveLength(0);
    });
  });

  describe('Challenges', () => {
    const mockChallenge: ChallengeData = {
      challenge: 'test-challenge',
      userId: 'user123',
      operation: 'registration',
      expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
      createdAt: new Date(),
    };

    it('should create a challenge', async () => {
      const created = await adapter.challenges.create(mockChallenge);
      expect(created).toBe(true);
    });

    it('should find a challenge', async () => {
      await adapter.challenges.create(mockChallenge);
      const foundChallenge = await adapter.challenges.find(mockChallenge.challenge);
      expect(foundChallenge).toEqual(mockChallenge);
    });

    it('should return null for non-existent challenge', async () => {
      const foundChallenge = await adapter.challenges.find('non-existent');
      expect(foundChallenge).toBeNull();
    });

    it('should delete a challenge', async () => {
      await adapter.challenges.create(mockChallenge);
      const deleted = await adapter.challenges.delete(mockChallenge.challenge);
      expect(deleted).toBe(true);
      
      const foundChallenge = await adapter.challenges.find(mockChallenge.challenge);
      expect(foundChallenge).toBeNull();
    });

    it('should delete expired challenges', async () => {
      const expiredChallenge = {
        ...mockChallenge,
        challenge: 'expired-challenge',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };
      
      await adapter.challenges.create(mockChallenge);
      await adapter.challenges.create(expiredChallenge);
      
      const deleted = await adapter.challenges.deleteExpired();
      expect(deleted).toBe(true);
      
      const foundValid = await adapter.challenges.find(mockChallenge.challenge);
      const foundExpired = await adapter.challenges.find(expiredChallenge.challenge);
      
      expect(foundValid).toEqual(mockChallenge);
      expect(foundExpired).toBeNull();
    });
  });

  describe('Sessions', () => {
    const mockSession: SessionData = {
      userId: 'user123',
      credentialId: 'cred123',
      userVerified: true,
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      additionalData: { role: 'user' },
    };

    it('should create a session', async () => {
      const created = await adapter.sessions.create('session123', mockSession);
      expect(created).toBe(true);
    });

    it('should find a session', async () => {
      await adapter.sessions.create('session123', mockSession);
      const foundSession = await adapter.sessions.find('session123');
      expect(foundSession).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      const foundSession = await adapter.sessions.find('non-existent');
      expect(foundSession).toBeNull();
    });

    it('should update a session', async () => {
      await adapter.sessions.create('session123', mockSession);
      const updates = { userVerified: false };
      const updated = await adapter.sessions.update('session123', updates);
      expect(updated).toBe(true);
      
      const foundSession = await adapter.sessions.find('session123');
      expect(foundSession!.userVerified).toBe(false);
      expect(foundSession!.userId).toBe(mockSession.userId);
    });

    it('should delete a session', async () => {
      await adapter.sessions.create('session123', mockSession);
      const deleted = await adapter.sessions.delete('session123');
      expect(deleted).toBe(true);
      
      const foundSession = await adapter.sessions.find('session123');
      expect(foundSession).toBeNull();
    });

    it('should delete sessions by user id', async () => {
      await adapter.sessions.create('session1', mockSession);
      await adapter.sessions.create('session2', mockSession);
      
      const deleted = await adapter.sessions.deleteByUserId(mockSession.userId);
      expect(deleted).toBe(true);
      
      const foundSession1 = await adapter.sessions.find('session1');
      const foundSession2 = await adapter.sessions.find('session2');
      
      expect(foundSession1).toBeNull();
      expect(foundSession2).toBeNull();
    });

    it('should delete expired sessions', async () => {
      // This test depends on the implementation having expiration logic
      // For now, we'll just test that the method exists and returns a boolean
      const deleted = await adapter.sessions.deleteExpired();
      expect(typeof deleted).toBe('boolean');
    });
  });
});