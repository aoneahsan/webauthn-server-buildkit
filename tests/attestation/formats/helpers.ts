/**
 * Shared helpers for the per-format attestation tests: build authenticator data,
 * COSE keys, and the verifier input the production verifiers consume.
 */

import { X509Certificate, type JsonWebKey } from 'node:crypto';
import { encodeCBOR, parseCOSEPublicKey, type COSEPublicKey } from '@/crypto';
import { sha256 } from '@/utils/hash';
import { base64URLToBuffer } from '@/utils/base64url';
import { concatBuffers, numberToBuffer } from '@/utils/buffer';
import type { AttestationVerifierInput } from '@/attestation';
import type { AttestationFormat } from '@/types';

export const RP_ID = 'example.com';

/** Encode an EC P-256 public key (from a JWK) as a COSE_Key (ES256). */
export function ecCoseKeyFromJwk(jwk: JsonWebKey): Uint8Array {
  return encodeCBOR(
    new Map<number, unknown>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, base64URLToBuffer(jwk.x ?? '')],
      [-3, base64URLToBuffer(jwk.y ?? '')],
    ]),
  );
}

/** Parse a COSE key bytes blob into the structured {@link COSEPublicKey}. */
export function parseCose(coseBytes: Uint8Array): COSEPublicKey {
  return parseCOSEPublicKey(coseBytes);
}

/** Build attestedCredentialData-bearing authenticator data with a given AAGUID. */
export function buildAuthData(options: {
  coseKey: Uint8Array;
  credId: Uint8Array;
  aaguid: Uint8Array;
  rpId?: string;
}): Uint8Array {
  const rpIdHash = sha256(options.rpId ?? RP_ID);
  const flags = new Uint8Array([0x45]); // UP | UV | AT
  const counter = numberToBuffer(0, 4);
  const credIdLen = numberToBuffer(options.credId.length, 2);
  return concatBuffers(
    rpIdHash,
    flags,
    counter,
    options.aaguid,
    credIdLen,
    options.credId,
    options.coseKey,
  );
}

/** A fixed 16-byte AAGUID for tests. */
export const TEST_AAGUID = Uint8Array.from([
  0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
]);

/** The hyphenated UUID form of {@link TEST_AAGUID}. */
export const TEST_AAGUID_UUID = '00112233-4455-6677-8899-aabbccddeeff';

/** A deterministic 32-byte client-data hash for tests. */
export function clientDataHash(fill = 9): Uint8Array {
  return new Uint8Array(32).fill(fill);
}

/** Assemble a verifier input from parts. */
export function makeVerifierInput(params: {
  fmt: AttestationFormat;
  attStmt: unknown;
  authData: Uint8Array;
  clientDataHash: Uint8Array;
  credentialPublicKey: COSEPublicKey;
  aaguid?: Uint8Array;
  metadataService?: AttestationVerifierInput['metadataService'];
}): AttestationVerifierInput {
  return {
    fmt: params.fmt,
    attStmt: params.attStmt,
    authData: params.authData,
    clientDataHash: params.clientDataHash,
    credentialPublicKey: params.credentialPublicKey,
    aaguid: params.aaguid,
    metadataService: params.metadataService,
  };
}
