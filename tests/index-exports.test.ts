import { describe, it, expect } from 'vitest';
import {
  VerificationError,
  WebAuthnError,
  RegistrationError,
  AuthenticationError,
  ConfigurationError,
  StorageError,
  SessionError,
  COSEAlgorithmIdentifier,
  COSEKeyType,
  COSEEllipticCurve,
  SUPPORT_CONFIG,
  timingSafeEqualBytes,
  VERSION,
} from '@/index';

describe('public API value exports (API-1)', () => {
  it('exports error classes as runtime values that support instanceof', () => {
    const err = new VerificationError('boom', 'CODE');
    expect(err).toBeInstanceOf(VerificationError);
    expect(err).toBeInstanceOf(WebAuthnError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('CODE');

    for (const ErrorClass of [
      RegistrationError,
      AuthenticationError,
      ConfigurationError,
      StorageError,
      SessionError,
    ]) {
      expect(new ErrorClass('message')).toBeInstanceOf(WebAuthnError);
    }
  });

  it('exports COSE enums with accessible member values', () => {
    expect(COSEAlgorithmIdentifier.ES256).toBe(-7);
    expect(COSEAlgorithmIdentifier.RS256).toBe(-257);
    expect(COSEKeyType.EC2).toBe(2);
    expect(COSEEllipticCurve.Ed25519).toBe(6);
  });

  it('exports SUPPORT_CONFIG, timingSafeEqualBytes and VERSION', () => {
    expect(SUPPORT_CONFIG.url).toContain('aoneahsan.com/payment');
    expect(typeof timingSafeEqualBytes).toBe('function');
    expect(typeof VERSION).toBe('string');
  });
});
