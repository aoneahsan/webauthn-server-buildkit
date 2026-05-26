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
  // Attestation foundation
  StaticMetadataService,
  APPLE_WEBAUTHN_ROOT_CA_PEM,
  parseCertPem,
  verifyCertChain,
  publicKeyMatchesCOSE,
  pemToDer,
  ASN1_TAG,
  readTLV,
  decodeOID,
  findExtension,
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

describe('attestation-foundation public exports (GAP-N2 / Phase 5)', () => {
  it('exports the trust-anchor provider and bundled Apple root', () => {
    expect(typeof StaticMetadataService).toBe('function');
    expect(APPLE_WEBAUTHN_ROOT_CA_PEM).toContain('BEGIN CERTIFICATE');

    const svc = new StaticMetadataService({ defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM] });
    expect(svc.getRootCertificates({})).toEqual([APPLE_WEBAUTHN_ROOT_CA_PEM]);
  });

  it('exports working X.509 helpers reachable from the entry point', () => {
    expect(typeof parseCertPem).toBe('function');
    expect(typeof verifyCertChain).toBe('function');
    expect(typeof publicKeyMatchesCOSE).toBe('function');

    // The bundled Apple root is self-signed, so it anchors to itself.
    const apple = parseCertPem(APPLE_WEBAUTHN_ROOT_CA_PEM);
    expect(apple.subject).toContain('Apple WebAuthn Root CA');
    expect(verifyCertChain([apple], [apple])).toBe(true);
    expect(pemToDer(APPLE_WEBAUTHN_ROOT_CA_PEM)).toBeInstanceOf(Uint8Array);
  });

  it('exports working ASN.1 helpers reachable from the entry point', () => {
    expect(ASN1_TAG.SEQUENCE).toBe(0x30);
    expect(typeof readTLV).toBe('function');
    expect(typeof decodeOID).toBe('function');
    expect(typeof findExtension).toBe('function');

    // 1.2.840.113635.100.8.2 (Apple anonymous attestation nonce) round-trips.
    const oid = Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x08, 0x02]);
    expect(decodeOID(oid)).toBe('1.2.840.113635.100.8.2');
  });
});
