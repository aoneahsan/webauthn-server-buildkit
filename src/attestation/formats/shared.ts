import { createHash, verify as nodeVerify, X509Certificate } from 'node:crypto';
import type { MetadataRootQuery, MetadataService } from '@/types';
import { VerificationError } from '@/types';
import { parseCert } from '../x509';

/**
 * Helpers shared by the per-format attestation verifiers (Phase 6).
 *
 * Everything here is synchronous and fail-closed: parsing helpers throw a
 * {@link VerificationError} on malformed input, signature/chain helpers return a
 * plain `boolean`.
 */

/**
 * Read a field from an attStmt that may have decoded as a `Map` (cbor-x with
 * `mapsAsObjects: false`) or as a plain object.
 */
export function readAttField(attStmt: unknown, key: string): unknown {
  if (attStmt instanceof Map) {
    return attStmt.get(key);
  }
  if (attStmt && typeof attStmt === 'object') {
    return (attStmt as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Coerce a CBOR-decoded byte value (`Uint8Array` / Node `Buffer`) to a
 * `Uint8Array`, or `undefined` when the value is not byte-like.
 */
export function asBytes(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) {
    return value;
  }
  return undefined;
}

/**
 * Parse an attestation statement's `x5c` field (an array of DER certificate
 * byte strings, leaf-first) into Node {@link X509Certificate}s.
 *
 * @throws {@link VerificationError} (`ATTESTATION_CERT_INVALID`) when `x5c` is
 * absent, empty, not an array, or contains an unparseable certificate.
 */
export function parseX5cChain(x5c: unknown): X509Certificate[] {
  if (!Array.isArray(x5c) || x5c.length === 0) {
    throw new VerificationError(
      'Attestation statement is missing a non-empty x5c certificate chain',
      'ATTESTATION_CERT_INVALID',
    );
  }

  const chain: X509Certificate[] = [];
  for (const entry of x5c) {
    const der = asBytes(entry);
    if (!der) {
      throw new VerificationError(
        'Attestation x5c entry is not a byte string',
        'ATTESTATION_CERT_INVALID',
      );
    }
    chain.push(parseCert(der));
  }
  return chain;
}

/** Convert a chain of parsed certificates to leaf-first PEM strings for `trustPath`. */
export function certChainToPems(chain: X509Certificate[]): string[] {
  return chain.map((cert) => cert.toString());
}

/**
 * Verify `signature` over `data` against a certificate's public key, pre-hashing
 * with `hash`.
 *
 * This is the cert-based counterpart to `crypto/verify.ts`'s COSE-key path: it
 * relies on Node to handle the SPKI/ASN.1 details, so ECDSA signatures must be
 * ASN.1 DER encoded (the WebAuthn x5c convention) and RSA uses PKCS#1 v1.5.
 *
 * @returns `true` only if the signature verifies; `false` (never throws) on any
 * crypto error or invalid signature.
 */
export function verifyWithCert(
  cert: X509Certificate,
  signature: Uint8Array,
  data: Uint8Array,
  hash: string,
): boolean {
  try {
    return nodeVerify(hash, data, cert.publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * Format a 16-byte AAGUID as a lowercase, hyphenated UUID string
 * (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Returns `undefined` when the input
 * is not exactly 16 bytes.
 */
export function formatAaguid(aaguid: Uint8Array | undefined): string | undefined {
  if (!aaguid || aaguid.length !== 16) {
    return undefined;
  }
  const hex = Array.from(aaguid, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Resolve the trusted root certificates for an authenticator from the
 * relying-party-supplied {@link MetadataService}.
 *
 * Returns the parsed root certificates, skipping any PEM that fails to parse
 * (rather than throwing — a single bad entry must not break trust resolution).
 * Returns an empty array when no service is supplied or no roots are known: the
 * caller then reports the attestation as not trust-anchored (honest framing).
 */
export function resolveRoots(
  metadataService: MetadataService | undefined,
  query: MetadataRootQuery,
): X509Certificate[] {
  if (!metadataService) {
    return [];
  }

  let pems: string[];
  try {
    pems = metadataService.getRootCertificates(query);
  } catch {
    return [];
  }

  const roots: X509Certificate[] = [];
  for (const pem of pems) {
    try {
      roots.push(parseCert(pemToDerLoose(pem)));
    } catch {
      // Skip an unparseable root; a malformed entry must not poison the set.
    }
  }
  return roots;
}

/**
 * Lenient PEM→DER for trust-anchor inputs: accepts a PEM string and returns its
 * DER bytes. Unlike the strict `pemToDer`, this also accepts raw base64 (no
 * armor) so a relying party can hand us either form.
 */
function pemToDerLoose(pem: string): Uint8Array {
  const match = pem.match(
    /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+?)-----END CERTIFICATE-----/,
  );
  const base64 = (match && match[1] ? match[1] : pem).replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/** SHA-256 over the concatenation of `parts`. */
export function sha256Concat(...parts: Uint8Array[]): Uint8Array {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
  }
  return new Uint8Array(hash.digest());
}
