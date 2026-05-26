import { AttestationFormat, AttestationObject, MetadataService, VerificationError } from '@/types';
import { COSEPublicKey, parseAuthenticatorData } from '@/crypto';
import type { AttestationVerificationResult, AttestationVerifierInput } from '@/attestation';
import {
  verifyAndroidKeyAttestation,
  verifyAndroidSafetyNetAttestation,
  verifyAppleAttestation,
  verifyFidoU2fAttestation,
  verifyPackedAttestation,
  verifyTpmAttestation,
} from '@/attestation/formats';

export type { AttestationVerificationResult } from '@/attestation';

/**
 * Verify the attestation statement of a registration, dispatching by format to
 * the per-format verifiers (Phase 6).
 *
 * Cryptographic verification + trust anchoring per format:
 * - `none` — no statement; nothing to verify (`attestationVerified: false`).
 * - `packed` self-attestation (no `x5c`) — `sig` over `authData ‖ clientDataHash`
 *   with the credential key; `attestationVerified: true` on success.
 * - `packed` (x5c), `fido-u2f`, `android-key`, `tpm` — cryptographically
 *   verified, then `attestationVerified: true` **only** when the certificate
 *   chain anchors to a root supplied via `metadataService`. Without a trust
 *   anchor the statement verifies cryptographically but reports
 *   `attestationVerified: false` (honest framing).
 * - `apple` — chain + nonce + key verified against the bundled Apple WebAuthn
 *   Root CA; trust-anchored without a `metadataService`.
 * - `android-safetynet` — JWS verified; trust-anchored only with an RP-supplied
 *   GlobalSign root. Deprecated by Google (prefer Play Integrity).
 *
 * @throws {@link VerificationError} only when a present statement is
 * cryptographically invalid (bad signature, nonce/key/challenge mismatch, or a
 * malformed structure) — never merely because a trust anchor is missing.
 */
export function verifyAttestationStatement(params: {
  attestationObject: AttestationObject;
  clientDataHash: Uint8Array;
  credentialPublicKey: COSEPublicKey;
  /** The 16-byte AAGUID; derived from `attestationObject.authData` when omitted. */
  aaguid?: Uint8Array;
  /** Trust-anchor / FIDO MDS provider supplied by the relying party. */
  metadataService?: MetadataService;
}): AttestationVerificationResult {
  const { attestationObject, clientDataHash, credentialPublicKey, metadataService } = params;
  const fmt = attestationObject.fmt;

  // `none`: structurally accepted, nothing to cryptographically verify.
  if (fmt === 'none') {
    return { fmt, attestationVerified: false };
  }

  // Derive the AAGUID from the authenticator data when the caller did not supply
  // it (keeps the historical call shape working).
  const aaguid = params.aaguid ?? parseAuthenticatorData(attestationObject.authData).aaguid;

  const verifierInput: AttestationVerifierInput = {
    fmt,
    attStmt: attestationObject.attStmt,
    authData: attestationObject.authData,
    clientDataHash,
    credentialPublicKey,
    aaguid,
    metadataService,
  };

  const verifier = FORMAT_VERIFIERS[fmt];
  if (!verifier) {
    throw new VerificationError(
      `Unsupported attestation format: ${fmt}`,
      'ATTESTATION_UNSUPPORTED_FORMAT',
    );
  }
  return verifier(verifierInput);
}

/** Dispatch table from attestation format to its verifier. */
const FORMAT_VERIFIERS: Partial<
  Record<AttestationFormat, (input: AttestationVerifierInput) => AttestationVerificationResult>
> = {
  packed: verifyPackedAttestation,
  'fido-u2f': verifyFidoU2fAttestation,
  'android-key': verifyAndroidKeyAttestation,
  tpm: verifyTpmAttestation,
  apple: verifyAppleAttestation,
  'android-safetynet': verifyAndroidSafetyNetAttestation,
};
