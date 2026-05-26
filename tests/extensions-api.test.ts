import { describe, it, expect, expectTypeOf } from 'vitest';
import { generateKeyPairSync, sign as nodeSign, type KeyObject } from 'node:crypto';
import { WebAuthnServer } from '@/server';
import { RegistrationError, WebAuthnError } from '@/types';
import type { WebAuthnErrorCode, WebAuthnCredential } from '@/types';
import { encodeCBOR } from '@/crypto';
import { sha256 } from '@/utils/hash';
import { bufferToBase64URL, stringToBase64URL, base64URLToBuffer } from '@/utils/base64url';
import { concatBuffers, numberToBuffer } from '@/utils/buffer';

const RP_ID = 'example.com';
const ORIGIN = 'https://example.com';
const SECRET = 'test-encryption-secret-at-least-32-characters-long';
const challenge = bufferToBase64URL(new Uint8Array(32).fill(7));

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

/** Build attestedCredentialData-bearing authenticator data (for registration). */
function buildRegAuthData(coseKey: Uint8Array, credId: Uint8Array): Uint8Array {
  const rpIdHash = sha256(RP_ID);
  const flags = new Uint8Array([0x45]); // UP | UV | AT
  const counter = numberToBuffer(0, 4);
  const aaguid = new Uint8Array(16);
  const credIdLen = numberToBuffer(credId.length, 2);
  return concatBuffers(rpIdHash, flags, counter, aaguid, credIdLen, credId, coseKey);
}

/** Build assertion authenticator data (no attested credential data). */
function buildAuthData(counter: number): Uint8Array {
  const rpIdHash = sha256(RP_ID);
  const flags = new Uint8Array([0x05]); // UP | UV
  return concatBuffers(rpIdHash, flags, numberToBuffer(counter, 4));
}

function regClientDataB64(): string {
  return stringToBase64URL(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN }));
}

function getClientDataB64(): string {
  return stringToBase64URL(JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }));
}

function makeServer(): WebAuthnServer {
  return new WebAuthnServer({
    rpName: 'Test',
    rpID: RP_ID,
    origin: ORIGIN,
    encryptionSecret: SECRET,
  });
}

/** A none-attestation registration response carrying extension results. */
function makeRegistration(
  credId: Uint8Array,
  clientExtensionResults: Record<string, unknown> = {},
) {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const authData = buildRegAuthData(ecCoseKey(publicKey), credId);
  const attestationObject = encodeCBOR(
    new Map<string, unknown>([
      ['fmt', 'none'],
      ['attStmt', new Map()],
      ['authData', authData],
    ]),
  );
  return {
    id: bufferToBase64URL(credId),
    rawId: bufferToBase64URL(credId),
    response: {
      attestationObject: bufferToBase64URL(attestationObject),
      clientDataJSON: regClientDataB64(),
      transports: ['internal'],
    },
    clientExtensionResults,
    type: 'public-key' as const,
  };
}

function makeCredential(credId: Uint8Array, coseKey: Uint8Array): WebAuthnCredential {
  return {
    id: bufferToBase64URL(credId),
    publicKey: coseKey,
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    userId: 'user-1',
    webAuthnUserID: bufferToBase64URL(new Uint8Array(16).fill(1)),
    createdAt: new Date(),
  };
}

describe('clientExtensionResults — registration (GAP-N3)', () => {
  it('returns credProps.rk from a registration response', async () => {
    const credId = new Uint8Array(32).fill(3);
    const response = makeRegistration(credId, { credProps: { rk: true } });
    const result = await makeServer().verifyRegistration(response, challenge);
    expect(result.verified).toBe(true);
    expect(result.registrationInfo?.clientExtensionResults?.credProps?.rk).toBe(true);
  });

  it('omits clientExtensionResults gracefully when none were returned', async () => {
    const credId = new Uint8Array(32).fill(4);
    const response = makeRegistration(credId, {});
    const result = await makeServer().verifyRegistration(response, challenge);
    expect(result.verified).toBe(true);
    // An empty object is still surfaced (truthy object) but carries no fields.
    expect(result.registrationInfo?.clientExtensionResults?.credProps).toBeUndefined();
  });
});

describe('clientExtensionResults — authentication (GAP-N3)', () => {
  it('returns extension outputs (appid) from an assertion response', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const credId = new Uint8Array(32).fill(3);
    const coseKey = ecCoseKey(publicKey);
    const authData = buildAuthData(1);
    const clientDataHash = sha256(base64URLToBuffer(getClientDataB64()));
    const sig = nodeSign('sha256', concatBuffers(authData, clientDataHash), privateKey);
    const response = {
      id: bufferToBase64URL(credId),
      rawId: bufferToBase64URL(credId),
      response: {
        authenticatorData: bufferToBase64URL(authData),
        clientDataJSON: getClientDataB64(),
        signature: bufferToBase64URL(sig),
      },
      clientExtensionResults: { appid: true },
      type: 'public-key' as const,
    };
    const result = await makeServer().verifyAuthentication(
      response,
      challenge,
      makeCredential(credId, coseKey),
    );
    expect(result.verified).toBe(true);
    expect(result.authenticationInfo?.clientExtensionResults?.appid).toBe(true);
  });
});

describe('excludeCredentials duplicate rejection (GAP-N4)', () => {
  it('rejects a credential that is already registered', async () => {
    const credId = new Uint8Array(32).fill(3);
    const response = makeRegistration(credId);
    await expect(
      makeServer().verifyRegistration(response, challenge, undefined, {
        existingCredentialIds: [bufferToBase64URL(credId)],
      }),
    ).rejects.toMatchObject({ code: 'CREDENTIAL_ALREADY_REGISTERED' });
  });

  it('accepts a credential that is not in the existing set', async () => {
    const credId = new Uint8Array(32).fill(3);
    const response = makeRegistration(credId);
    const result = await makeServer().verifyRegistration(response, challenge, undefined, {
      existingCredentialIds: [bufferToBase64URL(new Uint8Array(32).fill(99))],
    });
    expect(result.verified).toBe(true);
  });

  it('skips the duplicate check when no existing set is provided', async () => {
    const credId = new Uint8Array(32).fill(3);
    const response = makeRegistration(credId);
    const result = await makeServer().verifyRegistration(response, challenge);
    expect(result.verified).toBe(true);
  });
});

describe('WebAuthnErrorCode union (API-N1)', () => {
  it('a thrown error code is assignable to WebAuthnErrorCode', () => {
    const err = new RegistrationError(
      'Credential already registered',
      'CREDENTIAL_ALREADY_REGISTERED',
    );
    // Round-trip the value through the typed union to confirm assignability.
    const code: WebAuthnErrorCode = 'CREDENTIAL_ALREADY_REGISTERED';
    expect(err.code).toBe(code);
  });

  it('WebAuthnError.code accepts known union members and arbitrary strings (open union)', () => {
    // Known codes type-check.
    expectTypeOf<WebAuthnErrorCode>().toMatchTypeOf<string>();
    const knownCodes: WebAuthnErrorCode[] = [
      'CHALLENGE_NOT_FOUND',
      'CHALLENGE_OPERATION_MISMATCH',
      'CHALLENGE_EXPIRED',
      'CHALLENGE_MISMATCH',
      'ALGORITHM_MISMATCH',
      'UNSUPPORTED_CREDENTIAL_ALGORITHM',
      'COSE_ALG_MISMATCH',
      'USER_HANDLE_MISMATCH',
      'CROSS_ORIGIN_NOT_ALLOWED',
      'ORIGIN_MISMATCH',
      'RPID_MISMATCH',
      'COUNTER_ERROR',
      'SIGNATURE_VERIFICATION_FAILED',
      'CREDENTIAL_ID_MISMATCH',
      'CREDENTIAL_ALREADY_REGISTERED',
    ];
    expect(knownCodes).toContain('CREDENTIAL_ALREADY_REGISTERED');

    // The open union still permits arbitrary custom codes at construction.
    const custom = new WebAuthnError('boom', 'A_CUSTOM_CODE_NOT_IN_UNION', 400);
    expect(custom.code).toBe('A_CUSTOM_CODE_NOT_IN_UNION');
  });
});
