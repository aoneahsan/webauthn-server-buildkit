import { X509Certificate } from 'node:crypto';
import { COSEKeyType, VerificationError } from '@/types';
import { bufferToBase64URL } from '@/utils/base64url';
import type { COSEPublicKey } from '@/crypto';

/**
 * Thin, synchronous wrappers over Node's built-in `crypto.X509Certificate`
 * (Node 15+, this package requires >=24.13.0). These provide the cert parsing,
 * chain verification, and "leaf cert key == credential key" comparison the
 * attestation formats need, without adding any npm dependency.
 *
 * Everything here is SYNCHRONOUS and fail-closed: verification helpers return a
 * plain `boolean` and never throw on an untrusted-but-well-formed chain.
 */

/**
 * Convert a PEM-encoded certificate to its raw DER bytes.
 *
 * @throws {@link VerificationError} (`X509_INVALID_PEM`) if no certificate
 * block is found.
 */
export function pemToDer(pem: string): Uint8Array {
  const match = pem.match(
    /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+?)-----END CERTIFICATE-----/,
  );
  if (!match || !match[1]) {
    throw new VerificationError('No PEM certificate block found', 'X509_INVALID_PEM');
  }
  const base64 = match[1].replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Parse DER certificate bytes into a Node {@link X509Certificate}.
 *
 * @throws {@link VerificationError} (`X509_PARSE_ERROR`) on malformed input.
 */
export function parseCert(der: Uint8Array): X509Certificate {
  try {
    return new X509Certificate(Buffer.from(der));
  } catch {
    throw new VerificationError('Failed to parse X.509 certificate', 'X509_PARSE_ERROR');
  }
}

/**
 * Parse a PEM-encoded certificate into a Node {@link X509Certificate}.
 *
 * @throws {@link VerificationError} on malformed input.
 */
export function derToX509(der: Uint8Array): X509Certificate {
  return parseCert(der);
}

/**
 * Parse a PEM-encoded certificate string into a Node {@link X509Certificate}.
 *
 * @throws {@link VerificationError} on malformed input.
 */
export function parseCertPem(pem: string): X509Certificate {
  return parseCert(pemToDer(pem));
}

/**
 * Whether `now` falls within the certificate's validity window
 * (`validFrom <= now <= validTo`).
 */
export function isValidAt(cert: X509Certificate, now: Date = new Date()): boolean {
  const from = new Date(cert.validFrom).getTime();
  const to = new Date(cert.validTo).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return false;
  }
  const t = now.getTime();
  return t >= from && t <= to;
}

/**
 * Verify that `subject` was issued by and is signed by `issuer`.
 *
 * Uses Node's `checkIssued` (name/AKI/SKI linkage) AND `verify` (cryptographic
 * signature). Returns `false` (never throws) on any failure.
 */
export function isIssuedBy(subject: X509Certificate, issuer: X509Certificate): boolean {
  try {
    return subject.checkIssued(issuer) && subject.verify(issuer.publicKey);
  } catch {
    return false;
  }
}

/**
 * Verify an X.509 certificate chain, fail-closed.
 *
 * The chain is expected leaf-first: `chain[0]` is the leaf (attestation cert),
 * each subsequent entry is the issuer of the previous one. The function checks:
 *
 * 1. Every certificate in `chain` is valid at `now` (validity window).
 * 2. Each certificate is issued + cryptographically signed by the next entry.
 * 3. The top of the chain links to one of the supplied trust-anchor `roots`
 *    (either the top cert IS a root by signature, or it is one of the roots).
 *
 * Revocation (CRL/OCSP) and policy constraints are NOT checked — the package is
 * offline-by-default; the relying party supplies the trusted `roots` (typically
 * sourced from FIDO MDS via a {@link MetadataService}).
 *
 * @returns `true` only if the chain fully verifies to a trusted root.
 */
export function verifyCertChain(
  chain: X509Certificate[],
  roots: X509Certificate[],
  now: Date = new Date(),
): boolean {
  if (chain.length === 0 || roots.length === 0) {
    return false;
  }

  // 1. Validity window for every cert in the presented chain.
  for (const cert of chain) {
    if (!isValidAt(cert, now)) {
      return false;
    }
  }

  // 2. Each cert issued + signed by the next in the presented chain.
  for (let i = 0; i < chain.length - 1; i++) {
    if (!isIssuedBy(chain[i]!, chain[i + 1]!)) {
      return false;
    }
  }

  // 3. Link the top of the presented chain to a trusted root.
  const top = chain[chain.length - 1]!;
  for (const root of roots) {
    if (!isValidAt(root, now)) {
      continue;
    }
    // The top cert may itself be the root (same cert supplied as anchor)...
    if (top.raw.equals(root.raw)) {
      return true;
    }
    // ...or it may be issued + signed by the root.
    if (isIssuedBy(top, root)) {
      return true;
    }
  }

  return false;
}

/** Fields extracted from a certificate's public key for COSE comparison. */
type CertJwk = {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
};

/**
 * Compare a certificate's public key to a {@link COSEPublicKey}, returning
 * `true` only if they represent the same key.
 *
 * Both sides are normalized to JWK fields: EC keys compare `crv`/`x`/`y`, RSA
 * keys compare `n`/`e`, OKP (Ed25519) keys compare `crv`/`x`. This is the
 * "leaf cert key == credential public key" check several attestation formats
 * (apple, android-key, tpm) require.
 *
 * @returns `false` (never throws) if the cert key cannot be exported or the key
 * types/material differ.
 */
export function publicKeyMatchesCOSE(cert: X509Certificate, coseKey: COSEPublicKey): boolean {
  let jwk: CertJwk;
  try {
    jwk = cert.publicKey.export({ format: 'jwk' }) as CertJwk;
  } catch {
    return false;
  }

  switch (coseKey.kty) {
    case COSEKeyType.EC2: {
      return (
        jwk.kty === 'EC' &&
        jwk.x === bufferToBase64URL(coseKey.x) &&
        jwk.y === bufferToBase64URL(coseKey.y)
      );
    }
    case COSEKeyType.RSA: {
      return (
        jwk.kty === 'RSA' &&
        jwk.n === bufferToBase64URL(coseKey.n) &&
        jwk.e === bufferToBase64URL(coseKey.e)
      );
    }
    case COSEKeyType.OKP: {
      return jwk.kty === 'OKP' && jwk.x === bufferToBase64URL(coseKey.x);
    }
    default:
      return false;
  }
}
