import { describe, it, expect } from 'vitest';
import { generateChallenge } from '@/crypto/challenge';
import { isBase64URL } from '@/utils/base64url';

describe('Challenge utilities', () => {
  describe('generateChallenge', () => {
    it('should generate a challenge with default size', () => {
      const challenge = generateChallenge();
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('should generate a challenge with specified size', () => {
      const sizes = [16, 32, 64]; // Remove 128 as it exceeds max
      
      sizes.forEach(size => {
        const challenge = generateChallenge(size);
        expect(challenge).toBeDefined();
        expect(typeof challenge).toBe('string');
        // Base64URL encoding increases size by ~1.33, so we expect roughly size * 1.33
        // But we'll just check it's reasonable
        expect(challenge.length).toBeGreaterThan(size / 2);
        expect(challenge.length).toBeLessThan(size * 2);
      });
    });

    it('should generate unique challenges', () => {
      const challenges = new Set();
      const count = 100;
      
      for (let i = 0; i < count; i++) {
        const challenge = generateChallenge();
        challenges.add(challenge);
      }
      
      // All challenges should be unique
      expect(challenges.size).toBe(count);
    });

    it('should generate base64url-safe challenges', () => {
      const challenge = generateChallenge();
      
      // Should not contain +, /, or = characters
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
      
      // Should only contain valid base64url characters
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should handle edge cases', () => {
      // Test minimum size
      const minChallenge = generateChallenge(16);
      expect(minChallenge).toBeDefined();
      expect(minChallenge.length).toBeGreaterThan(0);
      
      // Test maximum size
      const maxChallenge = generateChallenge(64);
      expect(maxChallenge).toBeDefined();
      expect(maxChallenge.length).toBeGreaterThan(0);
      
      // Test that invalid sizes throw errors
      expect(() => generateChallenge(1)).toThrow('Challenge size must be at least 16 bytes');
      expect(() => generateChallenge(128)).toThrow('Challenge size must not exceed 64 bytes');
    });
  });

  describe('challenge validation', () => {
    it('should generate base64url-valid challenges', () => {
      const validChallenges = [
        generateChallenge(),
        generateChallenge(16),
        generateChallenge(32),
        generateChallenge(64),
      ];

      validChallenges.forEach(challenge => {
        expect(isBase64URL(challenge)).toBe(true);
      });
    });

    it('should be distinguishable from invalid base64url', () => {
      const invalidStrings = [
        'SGVsbG8+', // contains +
        'SGVsbG8/', // contains /
        'SGVsbG8=', // contains =
        'SGVsbG8 ', // contains space
        'SGVsbG8\n', // contains newline
        'SGVsbG8!', // contains !
      ];

      invalidStrings.forEach(str => {
        expect(isBase64URL(str)).toBe(false);
      });
    });
  });

  describe('challenge security properties', () => {
    it('should generate cryptographically random challenges', () => {
      const challenges = [];
      const count = 10;
      
      for (let i = 0; i < count; i++) {
        challenges.push(generateChallenge(32));
      }
      
      // Check that challenges are different
      const uniqueChallenges = new Set(challenges);
      expect(uniqueChallenges.size).toBe(count);
      
      // Check that they don't follow predictable patterns
      challenges.forEach(challenge => {
        expect(challenge).not.toMatch(/^A+$/); // Not all A's
        expect(challenge).not.toMatch(/^1+$/); // Not all 1's
        expect(challenge).not.toMatch(/^0+$/); // Not all 0's
      });
    });

    it('should generate challenges with good entropy', () => {
      const challenge = generateChallenge(64);
      const chars = challenge.split('');
      const uniqueChars = new Set(chars);
      
      // Should have reasonable character diversity
      expect(uniqueChars.size).toBeGreaterThan(challenge.length / 10);
    });
  });
});