/**
 * Per-format attestation verifiers. Each implements the synchronous
 * {@link AttestationFormatVerifier} contract and is dispatched by
 * `registration/attestation.ts` from the standard WebAuthn verification path.
 */

export { verifyAppleAttestation } from './apple';
export { verifyFidoU2fAttestation } from './fido-u2f';
export { verifyPackedAttestation } from './packed';
export { verifyAndroidKeyAttestation } from './android-key';
export { verifyTpmAttestation } from './tpm';
export { verifyAndroidSafetyNetAttestation } from './android-safetynet';
