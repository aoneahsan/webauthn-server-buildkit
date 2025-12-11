/**
 * Test fixtures for WebAuthn tests
 *
 * These are sample credentials and data structures used for testing.
 * Note: These are synthetic test vectors, not from real authenticators.
 */

import { bufferToBase64URL } from '@/utils';

// Test configuration
export const TEST_RP_ID = 'localhost';
export const TEST_RP_NAME = 'Test Application';
export const TEST_ORIGIN = 'https://localhost:3000';
export const TEST_TIMEOUT = 60000;

// Test user
export const TEST_USER = {
  id: bufferToBase64URL(crypto.getRandomValues(new Uint8Array(16))),
  name: 'testuser@example.com',
  displayName: 'Test User',
};

// Generate test challenge
export function generateTestChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Mock credential ID
export function generateMockCredentialId(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// Mock public key (EC2 P-256 format in COSE)
// This is a synthetic key structure for testing
export function getMockCOSEPublicKey(): Uint8Array {
  // COSE EC2 Key structure:
  // {
  //   1: 2,     // kty: EC2
  //   3: -7,    // alg: ES256
  //   -1: 1,    // crv: P-256
  //   -2: x (32 bytes),
  //   -3: y (32 bytes)
  // }
  // This is a CBOR-encoded map
  const x = crypto.getRandomValues(new Uint8Array(32));
  const y = crypto.getRandomValues(new Uint8Array(32));

  // Simple mock - in real tests, use proper CBOR encoding
  // The actual structure varies by implementation
  return new Uint8Array([
    0xa5, // map of 5 items
    0x01,
    0x02, // 1: 2 (kty: EC2)
    0x03,
    0x26, // 3: -7 (alg: ES256)
    0x20,
    0x01, // -1: 1 (crv: P-256)
    0x21,
    0x58,
    0x20, // -2: bstr(32)
    ...x,
    0x22,
    0x58,
    0x20, // -3: bstr(32)
    ...y,
  ]);
}

// Mock authenticator data
export function getMockAuthenticatorData(options?: {
  rpIdHash?: Uint8Array;
  flags?: number;
  counter?: number;
  includeAttestedCredentialData?: boolean;
  credentialId?: Uint8Array;
  publicKey?: Uint8Array;
}): Uint8Array {
  const rpIdHash = options?.rpIdHash ?? new Uint8Array(32).fill(0);
  const flags = options?.flags ?? 0x45; // UP, UV, AT flags set
  const counter = options?.counter ?? 0;

  const counterBytes = new Uint8Array(4);
  new DataView(counterBytes.buffer).setUint32(0, counter, false);

  const baseData = new Uint8Array([...rpIdHash, flags, ...counterBytes]);

  if (!options?.includeAttestedCredentialData) {
    return baseData;
  }

  // Add attested credential data
  const aaguid = new Uint8Array(16).fill(0);
  const credentialId = options?.credentialId ?? generateMockCredentialId();
  const credentialIdLength = new Uint8Array(2);
  new DataView(credentialIdLength.buffer).setUint16(0, credentialId.length, false);
  const publicKey = options?.publicKey ?? getMockCOSEPublicKey();

  return new Uint8Array([
    ...baseData,
    ...aaguid,
    ...credentialIdLength,
    ...credentialId,
    ...publicKey,
  ]);
}

// Mock client data for registration
export function getMockClientDataJSON(options?: {
  type?: string;
  challenge?: string;
  origin?: string;
  crossOrigin?: boolean;
}): string {
  const clientData = {
    type: options?.type ?? 'webauthn.create',
    challenge: options?.challenge ?? bufferToBase64URL(generateTestChallenge()),
    origin: options?.origin ?? TEST_ORIGIN,
    crossOrigin: options?.crossOrigin ?? false,
  };
  return JSON.stringify(clientData);
}

// Mock attestation object (none format)
export function getMockAttestationObject(authData: Uint8Array): Uint8Array {
  // CBOR map: { fmt: "none", attStmt: {}, authData: <bytes> }
  // This is simplified - real implementation uses proper CBOR encoding
  const fmtBytes = new TextEncoder().encode('none');

  // Simple CBOR structure for "none" attestation
  return new Uint8Array([
    0xa3, // map of 3 items
    0x63, // text string of 3 chars
    0x66,
    0x6d,
    0x74, // "fmt"
    0x64, // text string of 4 chars
    0x6e,
    0x6f,
    0x6e,
    0x65, // "none"
    0x67, // text string of 7 chars
    0x61,
    0x74,
    0x74,
    0x53,
    0x74,
    0x6d,
    0x74, // "attStmt"
    0xa0, // empty map
    0x68, // text string of 8 chars
    0x61,
    0x75,
    0x74,
    0x68,
    0x44,
    0x61,
    0x74,
    0x61, // "authData"
    0x58,
    authData.length, // byte string of authData.length
    ...authData,
  ]);
}

// Create a mock registration credential response
export function createMockRegistrationCredential(options?: {
  challenge?: string;
  credentialId?: Uint8Array;
}): {
  id: string;
  rawId: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
    transports?: string[];
  };
  type: string;
} {
  const credentialId = options?.credentialId ?? generateMockCredentialId();
  const challenge = options?.challenge ?? bufferToBase64URL(generateTestChallenge());

  const authData = getMockAuthenticatorData({
    includeAttestedCredentialData: true,
    credentialId,
  });

  const attestationObject = getMockAttestationObject(authData);
  const clientDataJSON = getMockClientDataJSON({ challenge });

  return {
    id: bufferToBase64URL(credentialId),
    rawId: bufferToBase64URL(credentialId),
    response: {
      attestationObject: bufferToBase64URL(attestationObject),
      clientDataJSON: bufferToBase64URL(new TextEncoder().encode(clientDataJSON)),
      transports: ['internal'],
    },
    type: 'public-key',
  };
}

// Create a mock authentication credential response
export function createMockAuthenticationCredential(options?: {
  challenge?: string;
  credentialId?: Uint8Array;
  counter?: number;
  userHandle?: Uint8Array;
}): {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  type: string;
} {
  const credentialId = options?.credentialId ?? generateMockCredentialId();
  const challenge = options?.challenge ?? bufferToBase64URL(generateTestChallenge());
  const counter = options?.counter ?? 1;

  const authData = getMockAuthenticatorData({
    counter,
    flags: 0x05, // UP, UV flags set (no AT)
  });

  const clientDataJSON = getMockClientDataJSON({
    type: 'webauthn.get',
    challenge,
  });

  // Mock signature (not cryptographically valid, just for structure testing)
  const signature = crypto.getRandomValues(new Uint8Array(64));

  return {
    id: bufferToBase64URL(credentialId),
    rawId: bufferToBase64URL(credentialId),
    response: {
      authenticatorData: bufferToBase64URL(authData),
      clientDataJSON: bufferToBase64URL(new TextEncoder().encode(clientDataJSON)),
      signature: bufferToBase64URL(signature),
      userHandle: options?.userHandle ? bufferToBase64URL(options.userHandle) : undefined,
    },
    type: 'public-key',
  };
}

// Mock stored credential
export function createMockStoredCredential(options?: {
  credentialId?: Uint8Array;
  counter?: number;
  userId?: string;
}): {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  userId: string;
  createdAt: number;
  lastUsedAt: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
} {
  const credentialId = options?.credentialId ?? generateMockCredentialId();
  const publicKey = getMockCOSEPublicKey();

  return {
    id: bufferToBase64URL(credentialId),
    credentialId: bufferToBase64URL(credentialId),
    publicKey: bufferToBase64URL(publicKey),
    counter: options?.counter ?? 0,
    userId: options?.userId ?? TEST_USER.id,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    transports: ['internal'],
    deviceType: 'singleDevice',
    backedUp: false,
  };
}
