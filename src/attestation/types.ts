import type { AttestationFormat, MetadataService } from '@/types';
import type { COSEPublicKey } from '@/crypto';

/**
 * Input passed to a per-format attestation verifier (implemented in Phase 6).
 *
 * Every format receives the parsed authenticator data, the SHA-256 client-data
 * hash, the credential public key parsed from `authData`, and (optionally) the
 * AAGUID and the relying-party-supplied {@link MetadataService} used to resolve
 * trust anchors.
 */
export interface AttestationVerifierInput {
  /** The attestation statement format identifier (`attestationObject.fmt`). */
  fmt: AttestationFormat;
  /** The raw attestation statement (`attestationObject.attStmt`); shape is format-specific. */
  attStmt: unknown;
  /** The raw authenticator data bytes from the attestation object. */
  authData: Uint8Array;
  /** SHA-256 hash of the client data JSON. */
  clientDataHash: Uint8Array;
  /** The credential public key parsed from the attested credential data. */
  credentialPublicKey: COSEPublicKey;
  /** The 16-byte AAGUID from the attested credential data, when present. */
  aaguid?: Uint8Array;
  /** Trust-anchor / FIDO MDS provider supplied by the relying party, when configured. */
  metadataService?: MetadataService;
}

/**
 * Result of attestation-statement verification.
 *
 * Extends the shape that `registration/attestation.ts` currently returns
 * (`fmt` + `attestationVerified`) so existing callers and tests keep working;
 * Phase 6 verifiers additionally populate `trustPath` and `aaguid`.
 */
export interface AttestationVerificationResult {
  /** The attestation statement format that was evaluated. */
  fmt: AttestationFormat;
  /**
   * `true` only when the attestation statement was cryptographically verified
   * (and, for chain-based formats, trust-anchored to a supplied root).
   */
  attestationVerified: boolean;
  /** The verified certificate chain (leaf-first) as PEM strings, when applicable. */
  trustPath?: string[];
  /** The authenticator AAGUID (lowercase, hyphenated UUID string), when known. */
  aaguid?: string;
}

/**
 * The contract every per-format attestation verifier implements in Phase 6.
 * Synchronous by design — it is invoked from the synchronous registration
 * verification path.
 */
export type AttestationFormatVerifier = (
  input: AttestationVerifierInput,
) => AttestationVerificationResult;
