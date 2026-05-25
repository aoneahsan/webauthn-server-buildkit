import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as nodeSign, type KeyObject } from 'node:crypto';
import { WebAuthnServer } from '@/server';
import { COSEAlgorithmIdentifier } from '@/types';
import { encodeCBOR } from '@/crypto';
import { sha256 } from '@/utils/hash';
import { bufferToBase64URL, stringToBase64URL, base64URLToBuffer } from '@/utils/base64url';
import { concatBuffers, numberToBuffer } from '@/utils/buffer';

const RP_ID = 'example.com';
const ORIGIN = 'https://example.com';
const SECRET = 'test-encryption-secret-at-least-32-characters-long';

/** Encode an EC P-256 public key as a COSE_Key (ES256). */
function ecCoseKey(pub: KeyObject): Uint8Array {
  const jwk = pub.export({ format: 'jwk' }) as { x: string; y: string };
  return encodeCBOR(
    new Map<number, unknown>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, base64URLToBuffer(jwk.x)],
      [-3, base64URLToBuffer(jwk.y)],
    ]),
  );
}

/** Build attestedCredentialData-bearing authenticator data. */
function buildAuthData(coseKey: Uint8Array, credId: Uint8Array): Uint8Array {
  const rpIdHash = sha256(RP_ID);
  const flags = new Uint8Array([0x45]); // UP | UV | AT
  const counter = numberToBuffer(0, 4);
  const aaguid = new Uint8Array(16);
  const credIdLen = numberToBuffer(credId.length, 2);
  return concatBuffers(rpIdHash, flags, counter, aaguid, credIdLen, credId, coseKey);
}

function clientDataB64(challenge: string): string {
  return stringToBase64URL(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN }));
}

function makeRegistrationResponse(
  attestationObject: Uint8Array,
  credId: Uint8Array,
  challenge: string,
) {
  return {
    id: bufferToBase64URL(credId),
    rawId: bufferToBase64URL(credId),
    response: {
      attestationObject: bufferToBase64URL(attestationObject),
      clientDataJSON: clientDataB64(challenge),
      transports: ['internal'],
    },
    clientExtensionResults: {},
    type: 'public-key' as const,
  };
}

const challenge = bufferToBase64URL(new Uint8Array(32).fill(7));

describe('verifyRegistrationResponse — standard WebAuthn path', () => {
  it('verifies a none-attestation registration (attestationVerified=false)', async () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const credId = new Uint8Array(32).fill(3);
    const authData = buildAuthData(ecCoseKey(publicKey), credId);
    const attObj = encodeCBOR(
      new Map<string, unknown>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );

    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
    });
    const result = await server.verifyRegistration(
      makeRegistrationResponse(attObj, credId, challenge),
      challenge,
    );

    expect(result.verified).toBe(true);
    expect(result.registrationInfo?.fmt).toBe('none');
    expect(result.registrationInfo?.attestationVerified).toBe(false);
  });

  it('verifies a packed self-attestation registration (attestationVerified=true)', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const credId = new Uint8Array(32).fill(4);
    const authData = buildAuthData(ecCoseKey(publicKey), credId);
    const clientDataHash = sha256(base64URLToBuffer(clientDataB64(challenge)));
    const sig = nodeSign('sha256', concatBuffers(authData, clientDataHash), privateKey);
    const attObj = encodeCBOR(
      new Map<string, unknown>([
        ['fmt', 'packed'],
        [
          'attStmt',
          new Map<string, unknown>([
            ['alg', -7],
            ['sig', sig],
          ]),
        ],
        ['authData', authData],
      ]),
    );

    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
    });
    const result = await server.verifyRegistration(
      makeRegistrationResponse(attObj, credId, challenge),
      challenge,
    );

    expect(result.verified).toBe(true);
    expect(result.registrationInfo?.fmt).toBe('packed');
    expect(result.registrationInfo?.attestationVerified).toBe(true);
  });

  it('rejects a credential whose algorithm is not in supportedAlgorithms', async () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const credId = new Uint8Array(32).fill(5);
    const authData = buildAuthData(ecCoseKey(publicKey), credId);
    const attObj = encodeCBOR(
      new Map<string, unknown>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );

    // Only RS256 is allowed, but the credential is ES256.
    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
      supportedAlgorithms: [COSEAlgorithmIdentifier.RS256],
    });

    await expect(
      server.verifyRegistration(makeRegistrationResponse(attObj, credId, challenge), challenge),
    ).rejects.toThrow(/supportedAlgorithms/);
  });
});

describe('mobile attestation gating (SEC-1)', () => {
  // A non-standard mobile JSON attestation payload.
  function mobileResponse() {
    const credentialId = bufferToBase64URL(new Uint8Array(32).fill(9));
    const publicKey = Buffer.from(new Uint8Array(64).fill(1)).toString('base64');
    const attestationObject = Buffer.from(
      JSON.stringify({ publicKey, credentialId, platform: 'ios', userVerified: true }),
    ).toString('base64');
    return {
      id: credentialId,
      rawId: credentialId,
      response: { attestationObject, clientDataJSON: clientDataB64(challenge) },
      clientExtensionResults: {},
      type: 'public-key' as const,
    };
  }

  it('does NOT accept a mobile JSON attestation by default (gate closed)', async () => {
    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
    });
    await expect(server.verifyRegistration(mobileResponse(), challenge)).rejects.toThrow();
  });

  it('accepts a mobile JSON attestation only when explicitly enabled', async () => {
    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
      enableMobileAttestation: true,
    });
    const result = await server.verifyRegistration(mobileResponse(), challenge);
    expect(result.verified).toBe(true);
    expect(result.registrationInfo?.credential.id).toBe(
      bufferToBase64URL(new Uint8Array(32).fill(9)),
    );
  });
});
