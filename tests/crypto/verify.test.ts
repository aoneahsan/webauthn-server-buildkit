import { describe, it, expect } from 'vitest';
import { verifySignature } from '@/crypto/verify';
import { COSEAlgorithmIdentifier, COSEKeyType, VerificationError } from '@/types';
import type { COSEEC2Key, COSERSAKey, COSEOKPKey } from '@/crypto/cose';

describe('verifySignature', () => {
  describe('EC2 keys', () => {
    const mockEC2Key: COSEEC2Key = {
      kty: COSEKeyType.EC2,
      alg: COSEAlgorithmIdentifier.ES256,
      crv: 1, // P-256
      x: new Uint8Array(32).fill(1),
      y: new Uint8Array(32).fill(2),
    };

    it('should handle EC2 key verification', () => {
      const signature = new Uint8Array(64);
      const data = new Uint8Array([1, 2, 3, 4]);

      // This will likely fail with invalid signature, but should not throw
      expect(() => {
        verifySignature(signature, data, mockEC2Key);
      }).not.toThrow();
    });
  });

  describe('RSA keys', () => {
    const mockRSAKey: COSERSAKey = {
      kty: COSEKeyType.RSA,
      alg: COSEAlgorithmIdentifier.RS256,
      n: new Uint8Array(256).fill(1),
      e: new Uint8Array(3).fill(1),
    };

    it('should handle RSA key verification', () => {
      const signature = new Uint8Array(256);
      const data = new Uint8Array([1, 2, 3, 4]);

      // This will likely fail with invalid signature, but should not throw
      expect(() => {
        verifySignature(signature, data, mockRSAKey);
      }).not.toThrow();
    });
  });

  describe('OKP keys (Ed25519)', () => {
    const mockOKPKey: COSEOKPKey = {
      kty: COSEKeyType.OKP,
      alg: COSEAlgorithmIdentifier.EdDSA,
      crv: 6, // Ed25519
      x: new Uint8Array(32).fill(1),
    };

    it('should handle Ed25519 key verification', () => {
      const signature = new Uint8Array(64);
      const data = new Uint8Array([1, 2, 3, 4]);

      // This will likely fail with invalid signature, but should not throw
      expect(() => {
        verifySignature(signature, data, mockOKPKey);
      }).not.toThrow();
    });

    it('should reject invalid Ed25519 key size', () => {
      const invalidKey: COSEOKPKey = {
        ...mockOKPKey,
        x: new Uint8Array(16).fill(1), // Invalid size
      };

      const signature = new Uint8Array(64);
      const data = new Uint8Array([1, 2, 3, 4]);

      const result = verifySignature(signature, data, invalidKey);
      expect(result).toBe(false);
    });

    it('should reject non-EdDSA algorithms for OKP keys', () => {
      const invalidKey: COSEOKPKey = {
        ...mockOKPKey,
        alg: COSEAlgorithmIdentifier.ES256, // Invalid algorithm for OKP
      };

      const signature = new Uint8Array(64);
      const data = new Uint8Array([1, 2, 3, 4]);

      expect(() => {
        verifySignature(signature, data, invalidKey);
      }).toThrow(VerificationError);
    });
  });

  describe('error handling', () => {
    it('should handle verification errors gracefully', () => {
      const mockKey: COSEEC2Key = {
        kty: COSEKeyType.EC2,
        alg: COSEAlgorithmIdentifier.ES256,
        crv: 1,
        x: new Uint8Array(32).fill(1),
        y: new Uint8Array(32).fill(2),
      };

      const signature = new Uint8Array(64);
      const data = new Uint8Array([1, 2, 3, 4]);

      // Should not throw, even with invalid signature
      const result = verifySignature(signature, data, mockKey);
      expect(typeof result).toBe('boolean');
    });
  });
});