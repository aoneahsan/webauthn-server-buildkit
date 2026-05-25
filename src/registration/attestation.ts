import { AttestationFormat, AttestationObject, VerificationError } from '@/types';
import { COSEPublicKey, verifySignature } from '@/crypto';
import { concatBuffers } from '@/utils/buffer';

/**
 * Result of attestation-statement verification.
 */
export interface AttestationVerificationResult {
  fmt: AttestationFormat;
  /**
   * `true` only when this library cryptographically verified the attestation
   * statement. See {@link verifyAttestationStatement} for which formats qualify.
   */
  attestationVerified: boolean;
}

/**
 * Read a field from an attStmt that may have decoded as a `Map` (cbor-x with
 * `mapsAsObjects: false`) or a plain object.
 */
function readAttField(attStmt: unknown, key: string): unknown {
  if (attStmt instanceof Map) {
    return attStmt.get(key);
  }
  if (attStmt && typeof attStmt === 'object') {
    return (attStmt as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Verify the attestation statement of a registration.
 *
 * Verified by this library:
 * - `none` — no statement; nothing to verify (returns `attestationVerified: false`).
 * - `packed` self-attestation (no `x5c`) — verifies the `sig` over
 *   `authData || clientDataHash` using the credential public key.
 *
 * NOT trust-anchored here (returned with `attestationVerified: false`, not
 * rejected): `packed` with `x5c`, `fido-u2f`, `tpm`, `android-key`,
 * `android-safetynet`, `apple`. These require X.509 certificate-chain validation
 * against format-specific roots; relying parties that need attestation trust
 * must verify the chain out-of-band. (Full chain verification is a documented
 * future enhancement.)
 *
 * @throws {@link VerificationError} only when a statement it *does* verify is
 * cryptographically invalid (a present-but-wrong `packed` self-attestation).
 */
export function verifyAttestationStatement(params: {
  attestationObject: AttestationObject;
  clientDataHash: Uint8Array;
  credentialPublicKey: COSEPublicKey;
}): AttestationVerificationResult {
  const { attestationObject, clientDataHash, credentialPublicKey } = params;
  const fmt = attestationObject.fmt;

  if (fmt === 'packed') {
    const x5c = readAttField(attestationObject.attStmt, 'x5c');
    const sig = readAttField(attestationObject.attStmt, 'sig');

    // Only self-attestation (no x5c) is cryptographically verified here.
    if (!x5c && sig instanceof Uint8Array) {
      const signatureBase = concatBuffers(attestationObject.authData, clientDataHash);
      if (!verifySignature(sig, signatureBase, credentialPublicKey)) {
        throw new VerificationError(
          'Packed self-attestation signature is invalid',
          'ATTESTATION_SIGNATURE_INVALID',
        );
      }
      return { fmt, attestationVerified: true };
    }

    // packed with x5c: certificate-chain trust is not validated here.
    return { fmt, attestationVerified: false };
  }

  // `none` and all certificate-chain formats: structurally accepted, not
  // cryptographically trust-anchored by this library.
  return { fmt, attestationVerified: false };
}
