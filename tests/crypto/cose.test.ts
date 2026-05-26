import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { parseCOSEPublicKey, getCOSEAlgorithmIdentifier } from '@/crypto/cose';
import { parseAuthenticatorData, encodeCBOR } from '@/crypto';
import { VerificationError } from '@/types';
import { sha256 } from '@/utils/hash';
import { base64URLToBuffer } from '@/utils/base64url';
import { concatBuffers, numberToBuffer } from '@/utils/buffer';

function ecCoseKeyMap(pub: KeyObject, alg = -7, crv = 1): Uint8Array {
  const jwk = pub.export({ format: 'jwk' }) as { x: string; y: string };
  return encodeCBOR(
    new Map<number, unknown>([
      [1, 2], // kty: EC2
      [3, alg],
      [-1, crv],
      [-2, base64URLToBuffer(jwk.x)],
      [-3, base64URLToBuffer(jwk.y)],
    ]),
  );
}

describe('parseCOSEPublicKey — length validation (FUNC-N2)', () => {
  it('rejects an EC2 key whose coordinate length is wrong for its curve', () => {
    const bad = encodeCBOR(
      new Map<number, unknown>([
        [1, 2], // EC2
        [-1, 1], // P-256
        [-2, new Uint8Array(16).fill(1)], // 16 bytes, should be 32
        [-3, new Uint8Array(32).fill(2)],
      ]),
    );
    expect(() => parseCOSEPublicKey(bad)).toThrow(/coordinate length/i);
  });

  it('rejects an RSA key whose modulus is too small', () => {
    const bad = encodeCBOR(
      new Map<number, unknown>([
        [1, 3], // RSA
        [-1, new Uint8Array(128).fill(1)], // 128 bytes (1024-bit) — too small
        [-2, Uint8Array.from([0x01, 0x00, 0x01])],
      ]),
    );
    expect(() => parseCOSEPublicKey(bad)).toThrow(/modulus too small/i);
  });

  it('rejects an Ed25519 key that is not 32 bytes', () => {
    const bad = encodeCBOR(
      new Map<number, unknown>([
        [1, 1], // OKP
        [-1, 6], // Ed25519
        [-2, new Uint8Array(16).fill(1)],
      ]),
    );
    expect(() => parseCOSEPublicKey(bad)).toThrow(/32 bytes/i);
  });

  it('accepts a valid P-256 key', () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const key = parseCOSEPublicKey(ecCoseKeyMap(publicKey));
    expect(key.kty).toBe(2);
  });
});

describe('getCOSEAlgorithmIdentifier — alg/crv consistency (SEC-N2)', () => {
  it('rejects a P-256 key that declares ES512', () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const key = parseCOSEPublicKey(ecCoseKeyMap(publicKey, -36 /* ES512 */, 1 /* P-256 */));
    expect(() => getCOSEAlgorithmIdentifier(key)).toThrow(/incompatible algorithm/i);
  });

  it('accepts a P-256 key that declares ES256', () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const key = parseCOSEPublicKey(ecCoseKeyMap(publicKey, -7, 1));
    expect(getCOSEAlgorithmIdentifier(key)).toBe(-7);
  });
});

describe('parseAuthenticatorData — trailing bytes (FUNC-N5)', () => {
  function buildAuthData(coseKey: Uint8Array, opts: { trailing?: Uint8Array; ed?: boolean } = {}) {
    const rpIdHash = sha256('example.com');
    const flags = new Uint8Array([opts.ed ? 0xc1 : 0x41]); // UP | AT (+ ED)
    const counter = numberToBuffer(0, 4);
    const aaguid = new Uint8Array(16);
    const credId = new Uint8Array(16).fill(2);
    const credIdLen = numberToBuffer(credId.length, 2);
    const parts = [rpIdHash, flags, counter, aaguid, credIdLen, credId, coseKey];
    if (opts.trailing) parts.push(opts.trailing);
    return concatBuffers(...parts);
  }

  it('rejects trailing bytes after the COSE key when the ED flag is unset', () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const authData = buildAuthData(ecCoseKeyMap(publicKey), {
      trailing: Uint8Array.from([0xde, 0xad]),
    });
    expect(() => parseAuthenticatorData(authData)).toThrow(VerificationError);
    expect(() => parseAuthenticatorData(authData)).toThrow(/trailing bytes/i);
  });

  it('parses cleanly with no trailing bytes', () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const parsed = parseAuthenticatorData(buildAuthData(ecCoseKeyMap(publicKey)));
    expect(parsed.credentialPublicKey).toBeDefined();
    expect(parsed.flags.attestedCredentialData).toBe(true);
  });
});
