import { describe, it, expect } from 'vitest';
import { X509Certificate } from 'node:crypto';
import {
  parseCert,
  parseCertPem,
  pemToDer,
  derToX509,
  isValidAt,
  isIssuedBy,
  verifyCertChain,
  publicKeyMatchesCOSE,
} from '@/attestation/x509';
import { APPLE_WEBAUTHN_ROOT_CA_PEM } from '@/attestation';
import { COSEKeyType, COSEEllipticCurve, VerificationError } from '@/types';
import type { COSEEC2Key } from '@/crypto';
import { base64URLToBuffer } from '@/utils/base64url';
import { TEST_ROOT_PEM, TEST_LEAF_PEM, UNRELATED_ROOT_PEM, FAR_FUTURE } from './fixtures';

/** Build a COSE EC2 key from a parsed certificate's P-256 public key. */
function coseFromCert(cert: X509Certificate): COSEEC2Key {
  const jwk = cert.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  return {
    kty: COSEKeyType.EC2,
    crv: COSEEllipticCurve.P256,
    x: base64URLToBuffer(jwk.x),
    y: base64URLToBuffer(jwk.y),
  };
}

describe('x509 — parsing', () => {
  it('parses a PEM certificate', () => {
    const cert = parseCertPem(TEST_ROOT_PEM);
    expect(cert.subject).toContain('Test Root CA');
  });

  it('parses DER bytes via parseCert / derToX509', () => {
    const der = pemToDer(TEST_LEAF_PEM);
    expect(parseCert(der).subject).toContain('Test Leaf');
    expect(derToX509(der).subject).toContain('Test Leaf');
  });

  it('parses the bundled Apple WebAuthn Root CA', () => {
    const cert = parseCertPem(APPLE_WEBAUTHN_ROOT_CA_PEM);
    expect(cert.subject).toContain('Apple WebAuthn Root CA');
    expect(cert.publicKey.asymmetricKeyType).toBe('ec');
  });

  it('throws on malformed PEM', () => {
    expect(() => pemToDer('not a pem')).toThrow(VerificationError);
  });

  it('throws on malformed DER', () => {
    expect(() => parseCert(Uint8Array.from([0x00, 0x01, 0x02]))).toThrow(VerificationError);
  });
});

describe('x509 — validity window', () => {
  it('reports a fixture cert valid now and invalid in the far future', () => {
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(isValidAt(leaf, new Date())).toBe(true);
    expect(isValidAt(leaf, FAR_FUTURE)).toBe(false);
  });
});

describe('x509 — issuance', () => {
  it('confirms the leaf is issued + signed by the root', () => {
    const root = parseCertPem(TEST_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(isIssuedBy(leaf, root)).toBe(true);
  });

  it('rejects issuance by an unrelated CA', () => {
    const unrelated = parseCertPem(UNRELATED_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(isIssuedBy(leaf, unrelated)).toBe(false);
  });
});

describe('x509 — verifyCertChain', () => {
  it('verifies a 2-cert chain (leaf signed by root) to a trusted root', () => {
    const root = parseCertPem(TEST_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(verifyCertChain([leaf], [root])).toBe(true);
  });

  it('verifies a chain that includes the root explicitly', () => {
    const root = parseCertPem(TEST_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(verifyCertChain([leaf, root], [root])).toBe(true);
  });

  it('rejects a chain anchored to an unrelated root', () => {
    const unrelated = parseCertPem(UNRELATED_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(verifyCertChain([leaf], [unrelated])).toBe(false);
  });

  it('rejects an empty chain or empty root set', () => {
    const root = parseCertPem(TEST_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(verifyCertChain([], [root])).toBe(false);
    expect(verifyCertChain([leaf], [])).toBe(false);
  });

  it('rejects a chain whose leaf is expired at the verification time', () => {
    const root = parseCertPem(TEST_ROOT_PEM);
    const leaf = parseCertPem(TEST_LEAF_PEM);
    // FAR_FUTURE is past the leaf's validTo → expired → fail-closed.
    expect(verifyCertChain([leaf], [root], FAR_FUTURE)).toBe(false);
  });
});

describe('x509 — publicKeyMatchesCOSE', () => {
  it('matches a certificate against its own COSE EC2 key', () => {
    const leaf = parseCertPem(TEST_LEAF_PEM);
    expect(publicKeyMatchesCOSE(leaf, coseFromCert(leaf))).toBe(true);
  });

  it('rejects a different key', () => {
    const leaf = parseCertPem(TEST_LEAF_PEM);
    const root = parseCertPem(TEST_ROOT_PEM);
    // The root's key is different from the leaf's key.
    expect(publicKeyMatchesCOSE(leaf, coseFromCert(root))).toBe(false);
  });

  it('rejects when COSE key type does not match the cert (EC cert vs RSA COSE)', () => {
    const leaf = parseCertPem(TEST_LEAF_PEM);
    const rsaCose = {
      kty: COSEKeyType.RSA,
      n: new Uint8Array(256).fill(1),
      e: Uint8Array.from([0x01, 0x00, 0x01]),
    } as const;
    expect(publicKeyMatchesCOSE(leaf, rsaCose)).toBe(false);
  });
});
