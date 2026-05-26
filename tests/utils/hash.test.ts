import { describe, it, expect } from 'vitest';
import { sha256, sha384, sha512, verifyHash } from '@/utils/hash';

describe('hash utils', () => {
  describe('sha256 / sha384 / sha512 digest lengths', () => {
    it('produce the expected digest sizes', () => {
      expect(sha256('abc').length).toBe(32);
      expect(sha384('abc').length).toBe(48);
      expect(sha512('abc').length).toBe(64);
    });
  });

  describe('verifyHash (HYG-N5 — constant-time delegation)', () => {
    it('returns true when the hash matches', () => {
      expect(verifyHash('hello', sha256('hello'))).toBe(true);
      expect(verifyHash('hello', sha384('hello'), 'sha384')).toBe(true);
      expect(verifyHash('hello', sha512('hello'), 'sha512')).toBe(true);
    });

    it('returns false when the hash differs', () => {
      expect(verifyHash('hello', sha256('world'))).toBe(false);
    });

    it('returns false (without throwing) on a length mismatch', () => {
      // A sha384 digest compared as sha256 differs in length — must not throw.
      expect(verifyHash('hello', sha384('hello'), 'sha256')).toBe(false);
    });
  });
});
