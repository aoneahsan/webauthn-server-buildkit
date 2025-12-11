import { describe, it, expect } from 'vitest';
import {
  detectMobileAttestation,
  validateMobileAttestation,
  isCborParsingError,
  MobileAttestationData,
} from '@/registration/mobile-attestation';
import { bufferToBase64URL } from '@/utils';
import { VerificationError } from '@/types';
import { TEST_RP_ID, TEST_ORIGIN, TEST_USER } from '../fixtures/webauthn-data';

// Helper to create standard base64 string from text
function textToBase64(text: string): string {
  return btoa(text);
}

// Create a valid JSON-based mobile attestation matching MobileAttestationData interface
function createValidMobileAttestation() {
  const publicKey = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(64)));
  const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));

  const attestationData: MobileAttestationData = {
    publicKey,
    credentialId,
    deviceType: 'singleDevice',
    userVerified: true,
    platform: 'ios',
  };

  return textToBase64(JSON.stringify(attestationData));
}

// Create a placeholder/fake mobile attestation (btoa('mobile_attestation'))
function createPlaceholderMobileAttestation(): string {
  return btoa('mobile_attestation');
}

// Create a valid web/browser attestation (CBOR format)
function createWebAttestation(): string {
  // This is a minimal CBOR attestation object
  const cborBytes = new Uint8Array([
    0xa3, // map of 3 items
    0x63, // text string of 3 chars
    0x66, 0x6d, 0x74, // "fmt"
    0x64, // text string of 4 chars
    0x6e, 0x6f, 0x6e, 0x65, // "none"
    0x67, // text string of 7 chars
    0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74, // "attStmt"
    0xa0, // empty map
    0x68, // text string of 8 chars
    0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61, // "authData"
    0x58, 0x20, // byte string of 32 bytes
    ...new Uint8Array(32), // 32 zero bytes for authData (minimal)
  ]);
  return bufferToBase64URL(cborBytes);
}

describe('Mobile Attestation', () => {
  describe('detectMobileAttestation', () => {
    it('should detect and accept valid mobile attestation', () => {
      const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));
      const attestation = createValidMobileAttestation();
      const clientDataJSON = textToBase64(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32))),
          origin: TEST_ORIGIN,
        })
      );

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: attestation,
          clientDataJSON,
        },
        type: 'public-key' as const,
      };

      const result = detectMobileAttestation(response);

      expect(result.isMobileAttestation).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.publicKey).toBeDefined();
    });

    it('should detect and reject placeholder attestation', () => {
      const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));
      const attestation = createPlaceholderMobileAttestation();
      const clientDataJSON = textToBase64(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32))),
          origin: TEST_ORIGIN,
        })
      );

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: attestation,
          clientDataJSON,
        },
        type: 'public-key' as const,
      };

      const result = detectMobileAttestation(response);

      expect(result.isMobileAttestation).toBe(false);
      expect(result.reason).toBe('INVALID_PLACEHOLDER_ATTESTATION');
    });

    it('should not detect web attestation as mobile', () => {
      const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));
      const attestation = createWebAttestation();
      const clientDataJSON = textToBase64(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32))),
          origin: TEST_ORIGIN,
        })
      );

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: attestation,
          clientDataJSON,
        },
        type: 'public-key' as const,
      };

      const result = detectMobileAttestation(response);

      expect(result.isMobileAttestation).toBe(false);
    });

    it('should detect mobile credential IDs without valid attestation as invalid', () => {
      const credentialId = 'mobile_' + bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));
      const attestation = createWebAttestation(); // CBOR, not JSON
      const clientDataJSON = textToBase64(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32))),
          origin: TEST_ORIGIN,
        })
      );

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: attestation,
          clientDataJSON,
        },
        type: 'public-key' as const,
      };

      const result = detectMobileAttestation(response);

      expect(result.isMobileAttestation).toBe(false);
      expect(result.reason).toBe('MOBILE_CREDENTIAL_INVALID_ATTESTATION');
    });
  });

  describe('isCborParsingError', () => {
    it('should detect CBOR parsing errors', () => {
      const error = new Error('Failed to decode CBOR');
      expect(isCborParsingError(error)).toBe(true);
    });

    it('should detect COSE errors', () => {
      const error = new Error('Invalid COSE key');
      expect(isCborParsingError(error)).toBe(true);
    });

    it('should not detect unrelated errors', () => {
      const error = new Error('Network timeout');
      expect(isCborParsingError(error)).toBe(false);
    });

    it('should handle non-Error objects', () => {
      expect(isCborParsingError('string error')).toBe(false);
      expect(isCborParsingError({ message: 'CBOR error' })).toBe(false);
      expect(isCborParsingError(null)).toBe(false);
    });
  });

  describe('validateMobileAttestation', () => {
    it('should validate valid mobile attestation data', () => {
      // Use standard base64 for public key (not base64url) as validator uses atob
      const publicKeyBytes = crypto.getRandomValues(new Uint8Array(64));
      const publicKey = btoa(String.fromCharCode(...publicKeyBytes));
      const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));

      const mobileData: MobileAttestationData = {
        publicKey,
        credentialId,
        deviceType: 'singleDevice',
        userVerified: true,
        platform: 'ios',
      };

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: textToBase64(JSON.stringify(mobileData)),
          clientDataJSON: textToBase64(JSON.stringify({})),
        },
        type: 'public-key' as const,
      };

      const result = validateMobileAttestation(response, mobileData, TEST_ORIGIN);

      expect(result).toBeDefined();
      expect(result.credential.id).toBe(credentialId);
      expect(result.credentialDeviceType).toBe('singleDevice');
      expect(result.userVerified).toBe(true);
    });

    it('should throw on missing public key', () => {
      const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));

      const mobileData = {
        credentialId,
        deviceType: 'singleDevice' as const,
      } as MobileAttestationData;

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: textToBase64(JSON.stringify(mobileData)),
          clientDataJSON: textToBase64(JSON.stringify({})),
        },
        type: 'public-key' as const,
      };

      expect(() =>
        validateMobileAttestation(response, mobileData, TEST_ORIGIN)
      ).toThrow(VerificationError);
    });

    it('should throw on missing credential ID', () => {
      const publicKey = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(64)));

      const mobileData = {
        publicKey,
        deviceType: 'singleDevice' as const,
      } as MobileAttestationData;

      const response = {
        id: 'some-id',
        rawId: 'some-id',
        response: {
          attestationObject: textToBase64(JSON.stringify(mobileData)),
          clientDataJSON: textToBase64(JSON.stringify({})),
        },
        type: 'public-key' as const,
      };

      expect(() =>
        validateMobileAttestation(response, mobileData, TEST_ORIGIN)
      ).toThrow(VerificationError);
    });

    it('should throw on public key too short', () => {
      const publicKey = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(16))); // Too short
      const credentialId = bufferToBase64URL(crypto.getRandomValues(new Uint8Array(32)));

      const mobileData: MobileAttestationData = {
        publicKey,
        credentialId,
      };

      const response = {
        id: credentialId,
        rawId: credentialId,
        response: {
          attestationObject: textToBase64(JSON.stringify(mobileData)),
          clientDataJSON: textToBase64(JSON.stringify({})),
        },
        type: 'public-key' as const,
      };

      expect(() =>
        validateMobileAttestation(response, mobileData, TEST_ORIGIN)
      ).toThrow(VerificationError);
    });
  });
});
