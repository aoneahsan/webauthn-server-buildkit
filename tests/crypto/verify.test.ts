import { describe, it, expect } from 'vitest';
import {
  generateKeyPairSync,
  sign as nodeSign,
  constants,
  type KeyObject,
  type SignPrivateKeyInput,
} from 'node:crypto';
import { verifySignature } from '@/crypto/verify';
import {
  COSEAlgorithmIdentifier,
  COSEEllipticCurve,
  COSEKeyType,
  VerificationError,
} from '@/types';
import type { COSEEC2Key, COSERSAKey, COSEOKPKey } from '@/crypto/cose';
import { base64URLToBuffer } from '@/utils/base64url';

const DATA = new TextEncoder().encode('webauthn-server-buildkit signature base data');

/** Build a COSE EC2 key from a generated EC public key. */
function ecCoseKey(
  pub: KeyObject,
  alg: COSEAlgorithmIdentifier,
  crv: COSEEllipticCurve,
): COSEEC2Key {
  const jwk = pub.export({ format: 'jwk' }) as { x: string; y: string };
  return {
    kty: COSEKeyType.EC2,
    alg,
    crv,
    x: base64URLToBuffer(jwk.x),
    y: base64URLToBuffer(jwk.y),
  };
}

/** Build a COSE RSA key from a generated RSA public key. */
function rsaCoseKey(pub: KeyObject, alg: COSEAlgorithmIdentifier): COSERSAKey {
  const jwk = pub.export({ format: 'jwk' }) as { n: string; e: string };
  return {
    kty: COSEKeyType.RSA,
    alg,
    n: base64URLToBuffer(jwk.n),
    e: base64URLToBuffer(jwk.e),
  };
}

/** Build a COSE OKP (Ed25519) key from a generated public key. */
function okpCoseKey(pub: KeyObject): COSEOKPKey {
  const jwk = pub.export({ format: 'jwk' }) as { x: string };
  return {
    kty: COSEKeyType.OKP,
    alg: COSEAlgorithmIdentifier.EdDSA,
    crv: COSEEllipticCurve.Ed25519,
    x: base64URLToBuffer(jwk.x),
  };
}

describe('verifySignature — round-trip with real key pairs', () => {
  describe('ECDSA', () => {
    const cases: Array<[string, string, COSEAlgorithmIdentifier, COSEEllipticCurve, string]> = [
      ['ES256', 'P-256', COSEAlgorithmIdentifier.ES256, COSEEllipticCurve.P256, 'sha256'],
      ['ES384', 'P-384', COSEAlgorithmIdentifier.ES384, COSEEllipticCurve.P384, 'sha384'],
      ['ES512', 'P-521', COSEAlgorithmIdentifier.ES512, COSEEllipticCurve.P521, 'sha512'],
    ];

    it.each(cases)(
      'verifies a valid %s signature and rejects tampered data',
      (_n, curve, alg, crv, hash) => {
        const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: curve });
        const key = ecCoseKey(publicKey, alg, crv);
        const sig = nodeSign(hash, DATA, privateKey);

        expect(verifySignature(sig, DATA, key)).toBe(true);
        // Tampered message must fail.
        expect(verifySignature(sig, new Uint8Array([...DATA, 0x00]), key)).toBe(false);
        // Tampered signature must fail.
        const badSig = Uint8Array.from(sig);
        badSig[badSig.length - 1] ^= 0xff;
        expect(verifySignature(badSig, DATA, key)).toBe(false);
      },
    );
  });

  describe('RSA', () => {
    // 2048-bit modulus is 256 bytes — the exact case the previous hand-rolled
    // ASN.1 length encoding could not represent.
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });

    it.each([
      ['RS256', COSEAlgorithmIdentifier.RS256, 'sha256'],
      ['RS384', COSEAlgorithmIdentifier.RS384, 'sha384'],
      ['RS512', COSEAlgorithmIdentifier.RS512, 'sha512'],
    ] as Array<[string, COSEAlgorithmIdentifier, string]>)(
      'verifies a valid %s (PKCS1-v1_5) signature',
      (_n, alg, hash) => {
        const key = rsaCoseKey(rsa.publicKey, alg);
        const sig = nodeSign(hash, DATA, rsa.privateKey);
        expect(verifySignature(sig, DATA, key)).toBe(true);
        expect(verifySignature(sig, new Uint8Array([...DATA, 1]), key)).toBe(false);
      },
    );

    it.each([
      ['PS256', COSEAlgorithmIdentifier.PS256, 'sha256'],
      ['PS384', COSEAlgorithmIdentifier.PS384, 'sha384'],
      ['PS512', COSEAlgorithmIdentifier.PS512, 'sha512'],
    ] as Array<[string, COSEAlgorithmIdentifier, string]>)(
      'verifies a valid %s (RSA-PSS) signature',
      (_n, alg, hash) => {
        const key = rsaCoseKey(rsa.publicKey, alg);
        const signInput: SignPrivateKeyInput = {
          key: rsa.privateKey,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
        };
        const sig = nodeSign(hash, DATA, signInput);
        expect(verifySignature(sig, DATA, key)).toBe(true);
        expect(verifySignature(sig, new Uint8Array([...DATA, 1]), key)).toBe(false);
      },
    );
  });

  describe('EdDSA (Ed25519)', () => {
    it('verifies a valid Ed25519 signature and rejects tampered data', () => {
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      const key = okpCoseKey(publicKey);
      const sig = nodeSign(null, DATA, privateKey);

      expect(verifySignature(sig, DATA, key)).toBe(true);
      expect(verifySignature(sig, new Uint8Array([...DATA, 9]), key)).toBe(false);
    });
  });
});

describe('verifySignature — graceful handling of invalid input', () => {
  it('returns false (no throw) for an EC2 key whose point is not on the curve', () => {
    const mockEC2Key: COSEEC2Key = {
      kty: COSEKeyType.EC2,
      alg: COSEAlgorithmIdentifier.ES256,
      crv: COSEEllipticCurve.P256,
      x: new Uint8Array(32).fill(1),
      y: new Uint8Array(32).fill(2),
    };
    let result: boolean | undefined;
    expect(() => {
      result = verifySignature(new Uint8Array(64), new Uint8Array([1, 2, 3, 4]), mockEC2Key);
    }).not.toThrow();
    expect(result).toBe(false);
  });

  it('returns false for an RSA key with a garbage signature', () => {
    const mockRSAKey: COSERSAKey = {
      kty: COSEKeyType.RSA,
      alg: COSEAlgorithmIdentifier.RS256,
      n: new Uint8Array(256).fill(1),
      e: Uint8Array.from([0x01, 0x00, 0x01]),
    };
    const result = verifySignature(new Uint8Array(256), new Uint8Array([1, 2, 3, 4]), mockRSAKey);
    expect(result).toBe(false);
  });

  it('rejects an invalid Ed25519 key size', () => {
    const invalidKey: COSEOKPKey = {
      kty: COSEKeyType.OKP,
      alg: COSEAlgorithmIdentifier.EdDSA,
      crv: COSEEllipticCurve.Ed25519,
      x: new Uint8Array(16).fill(1),
    };
    expect(verifySignature(new Uint8Array(64), new Uint8Array([1, 2, 3, 4]), invalidKey)).toBe(
      false,
    );
  });

  it('throws VerificationError for non-EdDSA algorithm on an OKP key', () => {
    const invalidKey: COSEOKPKey = {
      kty: COSEKeyType.OKP,
      alg: COSEAlgorithmIdentifier.ES256,
      crv: COSEEllipticCurve.Ed25519,
      x: new Uint8Array(32).fill(1),
    };
    expect(() => {
      verifySignature(new Uint8Array(64), new Uint8Array([1, 2, 3, 4]), invalidKey);
    }).toThrow(VerificationError);
  });
});
