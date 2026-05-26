/**
 * Attestation foundation — reusable, security-critical primitives the per-format
 * attestation verifiers (Phase 6) build on. Offline-by-default and synchronous:
 * trust anchors come from the relying-party-supplied {@link MetadataService},
 * never from the network.
 */

// Phase 6 verifier contract (type-only).
export type {
  AttestationVerifierInput,
  AttestationVerificationResult,
  AttestationFormatVerifier,
} from './types';

// Trust-anchor / FIDO MDS provider.
export { StaticMetadataService } from './metadata';
export type { StaticMetadataServiceOptions } from './metadata';

// Bundled Apple WebAuthn Root CA.
export { APPLE_WEBAUTHN_ROOT_CA_PEM } from './roots/apple-webauthn-root-ca';

// Per-format attestation verifiers (Phase 6).
export {
  verifyAppleAttestation,
  verifyFidoU2fAttestation,
  verifyPackedAttestation,
  verifyAndroidKeyAttestation,
  verifyTpmAttestation,
  verifyAndroidSafetyNetAttestation,
} from './formats';

// X.509 helpers (Node built-in crypto wrappers).
export {
  parseCert,
  parseCertPem,
  derToX509,
  pemToDer,
  isValidAt,
  isIssuedBy,
  verifyCertChain,
  publicKeyMatchesCOSE,
} from './x509';

// Minimal DER/ASN.1 reader.
export {
  ASN1_TAG,
  readTLV,
  readChildren,
  readSequence,
  readSet,
  decodeOID,
  readOctetString,
  readInteger,
  readBitString,
  findExtension,
} from './asn1';
export type { Asn1Node } from './asn1';
