import type { X509Certificate } from 'node:crypto';
import { VerificationError } from '@/types';
import { base64URLToBuffer } from '@/utils/base64url';
import { timingSafeEqualBytes } from '@/utils/buffer';
import type { AttestationFormatVerifier, AttestationVerificationResult } from '../types';
import { parseCert, verifyCertChain } from '../x509';
import {
  asBytes,
  certChainToPems,
  formatAaguid,
  readAttField,
  resolveRoots,
  sha256Concat,
  verifyWithCert,
} from './shared';

/** Maximum accepted age of the SafetyNet attestation timestamp. */
const MAX_TIMESTAMP_AGE_MS = 60_000;

/** Expected leaf-certificate hostname for a SafetyNet response. */
const SAFETYNET_HOSTNAME = 'attest.android.com';

/** The decoded SafetyNet JWS payload fields this verifier consults. */
interface SafetyNetPayload {
  nonce?: string;
  ctsProfileMatch?: boolean;
  basicIntegrity?: boolean;
  timestampMs?: number;
}

/**
 * Verify an `android-safetynet` attestation statement.
 *
 * ⚠️ **Deprecated by Google.** SafetyNet is superseded by the Play Integrity
 * API; new authenticators do not emit it and Google has wound the service down.
 * This verifier is provided for completeness. Prefer Play Integrity.
 *
 * Cryptographically verified:
 * - The JWS signature in `attStmt.response` is verified with the public key of
 *   the JWS header's leaf certificate (`x5c[0]`).
 * - The leaf certificate hostname is `attest.android.com`.
 * - `nonce == base64(SHA-256(authData ‖ clientDataHash))`.
 * - `ctsProfileMatch === true` and the `timestampMs` is fresh.
 *
 * Trust anchoring:
 * - `attestationVerified` is `true` only when the JWS x5c chain anchors to a
 *   GlobalSign root supplied via the MetadataService (this package bundles no
 *   GlobalSign root). Without a trust anchor the result is
 *   `attestationVerified: false` (honest framing).
 *
 * @throws {@link VerificationError} only when a present statement is invalid
 * (malformed JWS, bad signature, wrong hostname, nonce mismatch, CTS failure, or
 * a stale timestamp).
 */
export const verifyAndroidSafetyNetAttestation: AttestationFormatVerifier = (input) => {
  const { fmt, attStmt, authData, clientDataHash, aaguid, metadataService } = input;

  const response = asBytes(readAttField(attStmt, 'response'));
  if (!response) {
    throw new VerificationError(
      'android-safetynet attestation is missing the JWS response',
      'ATTESTATION_INVALID',
    );
  }

  const jws = Buffer.from(response).toString('utf8');
  const segments = jws.split('.');
  if (segments.length !== 3) {
    throw new VerificationError(
      'android-safetynet JWS must have three dot-separated segments',
      'ATTESTATION_INVALID',
    );
  }
  const [headerB64, payloadB64, signatureB64] = segments as [string, string, string];

  const header = decodeJwsJson(headerB64) as { alg?: string; x5c?: unknown };
  const payload = decodeJwsJson(payloadB64) as SafetyNetPayload;

  // The JWS header carries the certificate chain (base64 DER, leaf-first).
  const chain = parseHeaderX5c(header.x5c);
  const leaf = chain[0]!;

  // 1. Verify the JWS signature over `header.payload` with the leaf key.
  const signingInput = new Uint8Array(Buffer.from(`${headerB64}.${payloadB64}`, 'ascii'));
  const signature = base64URLToBuffer(signatureB64);
  const hash = hashForJwsAlg(header.alg);
  if (!verifyWithCert(leaf, signature, signingInput, hash)) {
    throw new VerificationError(
      'android-safetynet JWS signature is invalid',
      'ATTESTATION_SIGNATURE_INVALID',
    );
  }

  // 2. Leaf hostname must be attest.android.com.
  if (!leafHasHostname(leaf, SAFETYNET_HOSTNAME)) {
    throw new VerificationError(
      'android-safetynet leaf certificate is not issued to attest.android.com',
      'ATTESTATION_CERT_INVALID',
    );
  }

  // 3. nonce == base64(SHA-256(authData ‖ clientDataHash)).
  const expectedNonce = Buffer.from(sha256Concat(authData, clientDataHash)).toString('base64');
  if (typeof payload.nonce !== 'string' || !nonceMatches(payload.nonce, expectedNonce)) {
    throw new VerificationError(
      'android-safetynet nonce does not match base64(SHA-256(authData ‖ clientDataHash))',
      'ATTESTATION_NONCE_MISMATCH',
    );
  }

  // 4. CTS profile match + timestamp freshness.
  if (payload.ctsProfileMatch !== true) {
    throw new VerificationError(
      'android-safetynet ctsProfileMatch is not true',
      'ATTESTATION_INVALID',
    );
  }
  if (
    typeof payload.timestampMs !== 'number' ||
    Math.abs(Date.now() - payload.timestampMs) > MAX_TIMESTAMP_AGE_MS
  ) {
    throw new VerificationError(
      'android-safetynet timestamp is missing or stale',
      'ATTESTATION_INVALID',
    );
  }

  // 5. Trust-anchor the chain to a GlobalSign root (RP-supplied; none bundled).
  const roots = resolveRoots(metadataService, { aaguid: formatAaguid(aaguid) });
  const trustAnchored = roots.length > 0 && verifyCertChain(chain, roots);

  const result: AttestationVerificationResult = {
    fmt,
    attestationVerified: trustAnchored,
    aaguid: formatAaguid(aaguid),
  };
  if (trustAnchored) {
    result.trustPath = certChainToPems(chain);
  }
  return result;
};

/** Decode a base64url JWS segment to a JSON object. */
function decodeJwsJson(segment: string): Record<string, unknown> {
  try {
    const json = Buffer.from(base64URLToBuffer(segment)).toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new VerificationError(
      'android-safetynet JWS segment is not valid JSON',
      'ATTESTATION_INVALID',
    );
  }
}

/** Parse the JWS header `x5c` (array of base64 DER certs) into certificates. */
function parseHeaderX5c(x5c: unknown): X509Certificate[] {
  if (!Array.isArray(x5c) || x5c.length === 0) {
    throw new VerificationError(
      'android-safetynet JWS header is missing an x5c chain',
      'ATTESTATION_CERT_INVALID',
    );
  }
  const chain: X509Certificate[] = [];
  for (const entry of x5c) {
    if (typeof entry !== 'string') {
      throw new VerificationError(
        'android-safetynet x5c entry is not a base64 string',
        'ATTESTATION_CERT_INVALID',
      );
    }
    try {
      chain.push(parseCert(Buffer.from(entry, 'base64')));
    } catch {
      throw new VerificationError(
        'android-safetynet x5c entry is not a valid certificate',
        'ATTESTATION_CERT_INVALID',
      );
    }
  }
  return chain;
}

/** Node digest implied by a JWS `alg` (RS256/ES256 → sha256, etc.); default sha256. */
function hashForJwsAlg(alg: string | undefined): string {
  switch (alg) {
    case 'RS384':
    case 'ES384':
    case 'PS384':
      return 'sha384';
    case 'RS512':
    case 'ES512':
    case 'PS512':
      return 'sha512';
    default:
      return 'sha256';
  }
}

/** Whether the certificate's subject CN or a SAN DNS entry equals `hostname`. */
function leafHasHostname(leaf: X509Certificate, hostname: string): boolean {
  for (const line of leaf.subject.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && line.slice(0, eq).trim() === 'CN' && line.slice(eq + 1).trim() === hostname) {
      return true;
    }
  }
  const san = leaf.subjectAltName ?? '';
  return san.split(',').some((entry) => entry.trim() === `DNS:${hostname}`);
}

/** Compare two base64 nonce strings as bytes (constant-time on equal lengths). */
function nonceMatches(actual: string, expected: string): boolean {
  try {
    return timingSafeEqualBytes(
      new Uint8Array(Buffer.from(actual, 'base64')),
      new Uint8Array(Buffer.from(expected, 'base64')),
    );
  } catch {
    return false;
  }
}
