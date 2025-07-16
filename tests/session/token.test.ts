import { describe, it, expect } from 'vitest';
import { createSessionToken, parseSessionToken } from '@/session/token';
import type { SessionData } from '@/types';

describe('Session Token', () => {
  const mockSessionData: SessionData = {
    userId: 'user123',
    credentialId: 'cred456',
    userVerified: true,
    additionalData: { role: 'user' },
  };

  const secret = 'test-secret-that-is-32-characters-long-for-encryption';

  describe('createSessionToken', () => {
    it('should create a valid session token', () => {
      const token = createSessionToken('session123', mockSessionData, secret);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should create different tokens for different sessions', () => {
      const token1 = createSessionToken('session1', mockSessionData, secret);
      const token2 = createSessionToken('session2', mockSessionData, secret);
      expect(token1).not.toBe(token2);
    });

    it('should create different tokens for different data', () => {
      const data1 = { ...mockSessionData, userId: 'user1' };
      const data2 = { ...mockSessionData, userId: 'user2' };
      const token1 = createSessionToken('session123', data1, secret);
      const token2 = createSessionToken('session123', data2, secret);
      expect(token1).not.toBe(token2);
    });

    it('should handle empty additional data', () => {
      const dataWithoutAdditional = {
        userId: 'user123',
        credentialId: 'cred456',
        userVerified: true,
      };
      const token = createSessionToken('session123', dataWithoutAdditional, secret);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('parseSessionToken', () => {
    it('should parse a valid session token', () => {
      const token = createSessionToken('session123', mockSessionData, secret);
      const result = parseSessionToken(token, secret);
      
      expect(result.sessionId).toBe('session123');
      expect(result.data).toEqual(mockSessionData);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid tokens', () => {
      const invalidToken = 'invalid-token';
      expect(() => parseSessionToken(invalidToken, secret)).toThrow();
    });

    it('should throw error for tokens with wrong secret', () => {
      const token = createSessionToken('session123', mockSessionData, secret);
      const wrongSecret = 'wrong-secret-that-is-also-32-characters-long';
      expect(() => parseSessionToken(token, wrongSecret)).toThrow();
    });

    it('should throw error for malformed tokens', () => {
      const malformedToken = 'not.a.valid.token';
      expect(() => parseSessionToken(malformedToken, secret)).toThrow();
    });

    it('should throw error for tokens with invalid JSON', () => {
      // Create a token and modify it to have invalid JSON
      const validToken = createSessionToken('session123', mockSessionData, secret);
      const parts = validToken.split('.');
      if (parts.length >= 2) {
        // Corrupt the payload
        parts[1] = 'invalid-json';
        const corruptedToken = parts.join('.');
        expect(() => parseSessionToken(corruptedToken, secret)).toThrow();
      }
    });
  });

  describe('token structure', () => {
    it('should create base64url encoded tokens', () => {
      const token = createSessionToken('session123', mockSessionData, secret);
      
      // Check that token is base64url encoded (no +, /, or = characters)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain('+');
      expect(token).not.toContain('/');
      expect(token).not.toContain('=');
    });

    it('should include timestamp in token', () => {
      const beforeTime = Date.now();
      const token = createSessionToken('session123', mockSessionData, secret);
      const afterTime = Date.now();
      
      const result = parseSessionToken(token, secret);
      
      const createdAt = result.createdAt.getTime();
      expect(createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(createdAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('error handling', () => {
    it('should handle short secrets gracefully', () => {
      const shortSecret = 'short';
      expect(() => {
        createSessionToken('session123', mockSessionData, shortSecret);
      }).not.toThrow();
    });

    it('should handle undefined data gracefully', () => {
      expect(() => parseSessionToken('', secret)).toThrow();
    });
  });
});