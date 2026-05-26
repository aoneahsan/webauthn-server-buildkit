import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as nodeSign, type KeyObject } from 'node:crypto';
import { WebAuthnServer } from '@/server';
import { MemoryStorageAdapter } from '@/adapters/memory';
import {
  COSEAlgorithmIdentifier,
  type WebAuthnServerConfig,
  type WebAuthnCredential,
} from '@/types';
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

/** Build assertion authenticator data (no attested credential data). */
function buildAuthData(counter: number, opts: { uv?: boolean; rpId?: string } = {}): Uint8Array {
  const rpIdHash = sha256(opts.rpId ?? RP_ID);
  const uv = opts.uv ?? true;
  const flags = new Uint8Array([uv ? 0x05 : 0x01]); // UP (+ UV)
  return concatBuffers(rpIdHash, flags, numberToBuffer(counter, 4));
}

function clientDataB64(c: string, origin = ORIGIN): string {
  return stringToBase64URL(JSON.stringify({ type: 'webauthn.get', challenge: c, origin }));
}

/** Sign authData || SHA-256(clientDataJSON) with ES256. */
function signAssertion(
  authData: Uint8Array,
  c: string,
  privateKey: KeyObject,
  origin = ORIGIN,
): Uint8Array {
  const clientDataHash = sha256(base64URLToBuffer(clientDataB64(c, origin)));
  return nodeSign('sha256', concatBuffers(authData, clientDataHash), privateKey);
}

function makeAuthResponse(
  credId: Uint8Array,
  authData: Uint8Array,
  signature: Uint8Array,
  c: string,
  origin = ORIGIN,
) {
  return {
    id: bufferToBase64URL(credId),
    rawId: bufferToBase64URL(credId),
    response: {
      authenticatorData: bufferToBase64URL(authData),
      clientDataJSON: clientDataB64(c, origin),
      signature: bufferToBase64URL(signature),
    },
    clientExtensionResults: {},
    type: 'public-key' as const,
  };
}

function makeCredential(
  credId: Uint8Array,
  coseKey: Uint8Array,
  overrides: Partial<WebAuthnCredential> = {},
): WebAuthnCredential {
  return {
    id: bufferToBase64URL(credId),
    publicKey: coseKey,
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    userId: 'user-1',
    webAuthnUserID: bufferToBase64URL(new Uint8Array(16).fill(1)),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeServer(extra: Partial<WebAuthnServerConfig> = {}): WebAuthnServer {
  return new WebAuthnServer({
    rpName: 'Test',
    rpID: RP_ID,
    origin: ORIGIN,
    encryptionSecret: SECRET,
    ...extra,
  });
}

/** A full registration→authentication fixture sharing one key pair. */
function fixture(opts: { counter?: number; uv?: boolean; credCounter?: number } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const credId = new Uint8Array(32).fill(3);
  const coseKey = ecCoseKey(publicKey);
  const authData = buildAuthData(opts.counter ?? 1, { uv: opts.uv });
  const sig = signAssertion(authData, challenge, privateKey);
  const response = makeAuthResponse(credId, authData, sig, challenge);
  const credential = makeCredential(credId, coseKey, { counter: opts.credCounter ?? 0 });
  return { credId, coseKey, authData, privateKey, response, credential };
}

describe('verifyAuthenticationResponse — round-trip', () => {
  it('verifies a valid ES256 assertion', async () => {
    const { response, credential } = fixture();
    const result = await makeServer().verifyAuthentication(response, challenge, credential);
    expect(result.verified).toBe(true);
    expect(result.authenticationInfo?.newCounter).toBe(1);
    expect(result.authenticationInfo?.credentialID).toBe(credential.id);
  });

  it('rejects a tampered (bad) signature', async () => {
    const { response, credential } = fixture();
    const badSig = base64URLToBuffer(response.response.signature);
    badSig[badSig.length - 1] ^= 0xff;
    const tampered = {
      ...response,
      response: { ...response.response, signature: bufferToBase64URL(badSig) },
    };
    await expect(
      makeServer().verifyAuthentication(tampered, challenge, credential),
    ).rejects.toThrow(/Signature verification failed/);
  });

  it('rejects a credential ID mismatch', async () => {
    const { response, credential } = fixture();
    const wrong = makeCredential(new Uint8Array(32).fill(8), credential.publicKey);
    await expect(makeServer().verifyAuthentication(response, challenge, wrong)).rejects.toThrow(
      /Credential ID mismatch/,
    );
  });

  it('rejects a challenge mismatch', async () => {
    const { response, credential } = fixture();
    await expect(
      makeServer().verifyAuthentication(response, 'a-different-challenge', credential),
    ).rejects.toThrow(/Challenge mismatch/);
  });

  it('rejects an origin mismatch', async () => {
    const { response, credential } = fixture();
    await expect(
      makeServer({ origin: 'https://evil.example' }).verifyAuthentication(
        response,
        challenge,
        credential,
      ),
    ).rejects.toThrow(/Origin mismatch/);
  });

  it('rejects an RP ID hash mismatch', async () => {
    const { response, credential } = fixture();
    await expect(
      makeServer({ rpID: 'other.example', origin: ORIGIN }).verifyAuthentication(
        response,
        challenge,
        credential,
      ),
    ).rejects.toThrow(/RP ID hash mismatch/);
  });

  it('rejects when user verification is required but absent', async () => {
    const { response, credential } = fixture({ uv: false });
    await expect(
      makeServer({ userVerification: 'required' }).verifyAuthentication(
        response,
        challenge,
        credential,
      ),
    ).rejects.toThrow();
  });

  it('rejects a non-increasing signature counter', async () => {
    const { response, credential } = fixture({ counter: 5, credCounter: 10 });
    await expect(
      makeServer().verifyAuthentication(response, challenge, credential),
    ).rejects.toThrow(/counter/i);
  });
});

describe('verifyAuthenticationResponse — algorithm pinning (SEC-N2)', () => {
  it('rejects when the credential algorithm is not in supportedAlgorithms', async () => {
    const { response, credential } = fixture();
    await expect(
      makeServer({ supportedAlgorithms: [COSEAlgorithmIdentifier.RS256] }).verifyAuthentication(
        response,
        challenge,
        credential,
      ),
    ).rejects.toThrow(/supportedAlgorithms/);
  });

  it('rejects when the asserted algorithm differs from the registered alg', async () => {
    const { response, credential } = fixture();
    // Credential claims it registered as RS256, but the key is ES256.
    const pinned = { ...credential, alg: COSEAlgorithmIdentifier.RS256 };
    await expect(makeServer().verifyAuthentication(response, challenge, pinned)).rejects.toThrow(
      /does not match the registered algorithm/,
    );
  });

  it('accepts when the registered alg matches the asserted alg', async () => {
    const { response, credential } = fixture();
    const pinned = { ...credential, alg: COSEAlgorithmIdentifier.ES256 };
    const result = await makeServer().verifyAuthentication(response, challenge, pinned);
    expect(result.verified).toBe(true);
  });
});

describe('verifyAuthentication — challenge lifecycle (SEC-N1)', () => {
  async function seedChallenge(
    adapter: MemoryStorageAdapter,
    op: 'registration' | 'authentication',
  ) {
    await adapter.challenges.create({
      challenge,
      operation: op,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
  }

  it('enforces single-use: the second verification with the same challenge is rejected', async () => {
    const adapter = new MemoryStorageAdapter();
    await seedChallenge(adapter, 'authentication');
    const { response, credential } = fixture();
    const server = makeServer({ storageAdapter: adapter });

    const first = await server.verifyAuthentication(response, challenge, credential);
    expect(first.verified).toBe(true);

    await expect(server.verifyAuthentication(response, challenge, credential)).rejects.toThrow(
      /not found or already used/,
    );
  });

  it('rejects a challenge issued for a different operation', async () => {
    const adapter = new MemoryStorageAdapter();
    await seedChallenge(adapter, 'registration'); // wrong operation for an auth verify
    const { response, credential } = fixture();
    await expect(
      makeServer({ storageAdapter: adapter }).verifyAuthentication(response, challenge, credential),
    ).rejects.toThrow(/issued for "registration"/);
  });

  it('rejects an expired stored challenge (defense-in-depth for non-filtering adapters)', async () => {
    const adapter = new MemoryStorageAdapter();
    // Simulate a custom adapter that returns an expired record from find().
    adapter.challenges.find = () =>
      Promise.resolve({
        challenge,
        operation: 'authentication',
        createdAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      });
    const { response, credential } = fixture();
    await expect(
      makeServer({ storageAdapter: adapter }).verifyAuthentication(response, challenge, credential),
    ).rejects.toThrow(/expired/i);
  });

  it('does not enforce the challenge store when enforceChallengeStore is false', async () => {
    const adapter = new MemoryStorageAdapter();
    // No challenge seeded — would be rejected if enforcement were on.
    const { response, credential } = fixture();
    const server = makeServer({ storageAdapter: adapter, enforceChallengeStore: false });
    const result = await server.verifyAuthentication(response, challenge, credential);
    expect(result.verified).toBe(true);
  });
});

describe('verifyAuthentication — userHandle (FUNC-N1)', () => {
  it('returns the userHandle and accepts a matching credential owner', async () => {
    const { response, credential } = fixture();
    const withHandle = {
      ...response,
      response: { ...response.response, userHandle: credential.webAuthnUserID },
    };
    const result = await makeServer().verifyAuthentication(withHandle, challenge, credential);
    expect(result.verified).toBe(true);
    expect(result.authenticationInfo?.userHandle).toBe(credential.webAuthnUserID);
  });

  it('rejects a userHandle that does not match the credential owner', async () => {
    const { response, credential } = fixture();
    const mismatched = {
      ...response,
      response: {
        ...response.response,
        userHandle: bufferToBase64URL(new Uint8Array(16).fill(9)),
      },
    };
    await expect(
      makeServer().verifyAuthentication(mismatched, challenge, credential),
    ).rejects.toThrow(/User handle/);
  });
});

describe('verifyAuthentication — crossOrigin (SEC-N4)', () => {
  function crossOriginResponse() {
    const { authData, privateKey, credId, credential } = fixture();
    const cdj = stringToBase64URL(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN, crossOrigin: true }),
    );
    const sig = nodeSign(
      'sha256',
      concatBuffers(authData, sha256(base64URLToBuffer(cdj))),
      privateKey,
    );
    const response = {
      id: bufferToBase64URL(credId),
      rawId: bufferToBase64URL(credId),
      response: {
        authenticatorData: bufferToBase64URL(authData),
        clientDataJSON: cdj,
        signature: bufferToBase64URL(sig),
      },
      clientExtensionResults: {},
      type: 'public-key' as const,
    };
    return { response, credential };
  }

  it('rejects a cross-origin ceremony by default', async () => {
    const { response, credential } = crossOriginResponse();
    await expect(
      makeServer().verifyAuthentication(response, challenge, credential),
    ).rejects.toThrow(/Cross-origin/);
  });

  it('accepts a cross-origin ceremony when allowCrossOriginIframe is true', async () => {
    const { response, credential } = crossOriginResponse();
    const result = await makeServer({ allowCrossOriginIframe: true }).verifyAuthentication(
      response,
      challenge,
      credential,
    );
    expect(result.verified).toBe(true);
  });
});

describe('verifyAuthentication — advisory signals (SEC-N5/N6)', () => {
  it('reports counterSupported=false when both counters are 0', async () => {
    const { response, credential } = fixture({ counter: 0, credCounter: 0 });
    const result = await makeServer().verifyAuthentication(response, challenge, credential);
    expect(result.authenticationInfo?.counterSupported).toBe(false);
  });

  it('reports backupStateChanged when the stored backup state differs', async () => {
    const { response, credential } = fixture();
    const result = await makeServer().verifyAuthentication(response, challenge, {
      ...credential,
      backedUp: true,
    });
    expect(result.authenticationInfo?.backupStateChanged).toBe(true);
  });

  it('reports userVerificationDowngraded when UV drops from registration', async () => {
    const { response, credential } = fixture({ uv: false });
    const result = await makeServer().verifyAuthentication(response, challenge, {
      ...credential,
      userVerified: true,
    });
    expect(result.authenticationInfo?.userVerificationDowngraded).toBe(true);
  });
});

describe('verifyAuthentication — originVerifier (FUNC-N3)', () => {
  it('uses a custom originVerifier in place of exact-string matching', async () => {
    const { response, credential } = fixture();
    const result = await makeServer({
      origin: 'https://not-the-real-origin.example',
      originVerifier: (o) => o === ORIGIN,
    }).verifyAuthentication(response, challenge, credential);
    expect(result.verified).toBe(true);
  });

  it('rejects when the custom originVerifier returns false', async () => {
    const { response, credential } = fixture();
    await expect(
      makeServer({ originVerifier: () => false }).verifyAuthentication(
        response,
        challenge,
        credential,
      ),
    ).rejects.toThrow(/Origin mismatch/);
  });
});
