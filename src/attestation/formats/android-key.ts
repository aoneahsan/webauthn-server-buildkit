import { VerificationError } from '@/types';
import { concatBuffers, timingSafeEqualBytes } from '@/utils/buffer';
import type { AttestationFormatVerifier, AttestationVerificationResult } from '../types';
import { publicKeyMatchesCOSE, verifyCertChain } from '../x509';
import { findExtension, readOctetString, readSequence } from '../asn1';
import {
  asBytes,
  certChainToPems,
  formatAaguid,
  parseX5cChain,
  readAttField,
  resolveRoots,
  verifyWithCert,
} from './shared';

/** Android Key Attestation extension OID (`KeyDescription`). */
const ANDROID_KEY_OID = '1.3.6.1.4.1.11129.2.1.17';

/** Index of `attestationChallenge` within the `KeyDescription` SEQUENCE. */
const ATTESTATION_CHALLENGE_INDEX = 4;

/**
 * Verify an `android-key` attestation statement.
 *
 * Cryptographically verified:
 * - `sig` over `authData ‖ clientDataHash` with the leaf certificate's public
 *   key (ECDSA/SHA-256).
 * - The leaf certificate public key equals the credential public key.
 * - The `attestationChallenge` field of the Android Key Attestation extension
 *   (`1.3.6.1.4.1.11129.2.1.17`) equals the client-data hash — binding the
 *   hardware-backed key to this exact ceremony.
 *
 * Trust anchoring:
 * - `attestationVerified` is `true` only when the x5c chain anchors to a Google
 *   hardware-attestation root supplied via the MetadataService. A valid
 *   statement with no available trust anchor yields `attestationVerified: false`
 *   (honest framing).
 *
 * Caveat (documented): the authorization-list constraints (`purpose`,
 * `origin`, absence of `allApplications`) are NOT additionally enforced here;
 * the security-critical challenge binding + leaf-key match + hardware-root chain
 * are. Relying parties needing the full Keymaster authorization-list policy
 * should inspect `trustPath`.
 *
 * @throws {@link VerificationError} only when a present statement is invalid
 * (missing `sig`, bad signature, leaf-key mismatch, missing/mismatched
 * attestation challenge).
 */
export const verifyAndroidKeyAttestation: AttestationFormatVerifier = (input) => {
  const { fmt, attStmt, authData, clientDataHash, credentialPublicKey, aaguid, metadataService } =
    input;

  const chain = parseX5cChain(readAttField(attStmt, 'x5c'));
  const leaf = chain[0]!;

  const sig = asBytes(readAttField(attStmt, 'sig'));
  if (!sig) {
    throw new VerificationError('android-key attestation is missing sig', 'ATTESTATION_INVALID');
  }

  // 1. Signature over authData ‖ clientDataHash with the leaf key.
  const signatureBase = concatBuffers(authData, clientDataHash);
  if (!verifyWithCert(leaf, sig, signatureBase, 'sha256')) {
    throw new VerificationError(
      'android-key attestation signature is invalid',
      'ATTESTATION_SIGNATURE_INVALID',
    );
  }

  // 2. Leaf certificate public key must equal the credential public key.
  if (!publicKeyMatchesCOSE(leaf, credentialPublicKey)) {
    throw new VerificationError(
      'android-key attestation leaf certificate key does not match the credential public key',
      'ATTESTATION_KEY_MISMATCH',
    );
  }

  // 3. attestationChallenge must equal the client-data hash.
  const challenge = extractAttestationChallenge(leaf.raw);
  if (!timingSafeEqualBytes(challenge, clientDataHash)) {
    throw new VerificationError(
      'android-key attestationChallenge does not match the client data hash',
      'ATTESTATION_CHALLENGE_MISMATCH',
    );
  }

  // 4. Trust-anchor the chain to a Google hardware-attestation root.
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

/**
 * Extract the `attestationChallenge` OCTET STRING from the Android Key
 * Attestation `KeyDescription` extension.
 *
 * @throws {@link VerificationError} when the extension is absent or malformed.
 */
function extractAttestationChallenge(certDer: Uint8Array): Uint8Array {
  const extValue = findExtension(certDer, ANDROID_KEY_OID);
  if (!extValue) {
    throw new VerificationError(
      'android-key certificate is missing the KeyDescription extension',
      'ATTESTATION_INVALID',
    );
  }
  const fields = readSequence(extValue, 0);
  const challengeNode = fields[ATTESTATION_CHALLENGE_INDEX];
  if (!challengeNode) {
    throw new VerificationError(
      'android-key KeyDescription is missing the attestationChallenge field',
      'ATTESTATION_INVALID',
    );
  }
  return readOctetString(challengeNode);
}
