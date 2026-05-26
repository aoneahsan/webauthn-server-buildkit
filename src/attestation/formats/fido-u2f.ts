import { COSEEllipticCurve, COSEKeyType, VerificationError } from '@/types';
import { parseAuthenticatorData } from '@/crypto';
import { bufferToBase64URL } from '@/utils/base64url';
import { concatBuffers } from '@/utils/buffer';
import { sha256 } from '@/utils/hash';
import type { AttestationFormatVerifier } from '../types';
import { ASN1_TAG, readBitString, readChildren, readSequence } from '../asn1';
import { verifyCertChain } from '../x509';
import {
  asBytes,
  certChainToPems,
  formatAaguid,
  parseX5cChain,
  readAttField,
  resolveRoots,
  verifyWithCert,
} from './shared';

/**
 * Verify a `fido-u2f` attestation statement.
 *
 * Cryptographically verified:
 * - `sig` (ECDSA P-256 / SHA-256) over the U2F verification data
 *   `0x00 ‖ rpIdHash ‖ clientDataHash ‖ credentialId ‖ (0x04 ‖ x ‖ y)` with the
 *   public key of the attestation certificate (`x5c[0]`).
 *
 * Trust anchoring:
 * - `attestationVerified` is `true` only when the x5c chain anchors to a root
 *   supplied by the MetadataService. If the signature is valid but no trust
 *   anchor is available, the result is `attestationVerified: false` (honest
 *   framing) — NOT a throw.
 *
 * fido-u2f credentials are always EC P-256.
 *
 * @throws {@link VerificationError} only when the statement is present but
 * cryptographically invalid (non-P-256 credential key, missing `sig`, or a
 * signature that fails to verify against the attestation certificate).
 */
export const verifyFidoU2fAttestation: AttestationFormatVerifier = (input) => {
  const { fmt, attStmt, authData, clientDataHash, credentialPublicKey, aaguid, metadataService } =
    input;

  const chain = parseX5cChain(readAttField(attStmt, 'x5c'));
  const attestationCert = chain[0]!;

  const sig = asBytes(readAttField(attStmt, 'sig'));
  if (!sig) {
    throw new VerificationError('fido-u2f attestation is missing sig', 'ATTESTATION_INVALID');
  }

  // fido-u2f is EC P-256 only: reconstruct the uncompressed public key point.
  if (
    credentialPublicKey.kty !== COSEKeyType.EC2 ||
    credentialPublicKey.crv !== COSEEllipticCurve.P256
  ) {
    throw new VerificationError(
      'fido-u2f requires an EC P-256 credential public key',
      'ATTESTATION_INVALID',
    );
  }

  const parsed = parseAuthenticatorData(authData);
  if (!parsed.credentialId) {
    throw new VerificationError(
      'fido-u2f authenticator data is missing the credential ID',
      'ATTESTATION_INVALID',
    );
  }

  const rpIdHash = authData.subarray(0, 32);
  const publicKeyU2F = concatBuffers(
    Uint8Array.from([0x04]),
    credentialPublicKey.x,
    credentialPublicKey.y,
  );
  const verificationData = concatBuffers(
    Uint8Array.from([0x00]),
    rpIdHash,
    clientDataHash,
    parsed.credentialId,
    publicKeyU2F,
  );

  if (!verifyWithCert(attestationCert, sig, verificationData, 'sha256')) {
    throw new VerificationError(
      'fido-u2f attestation signature is invalid',
      'ATTESTATION_SIGNATURE_INVALID',
    );
  }

  // Signature is valid. Trust-anchor the attestation cert chain (fido-u2f has no
  // AAGUID, so resolve roots by the attestation cert key identifier).
  const certKeyId = u2fCertKeyId(attestationCert.raw);
  const roots = resolveRoots(metadataService, {
    attestationCertificateKeyIdentifier: certKeyId,
  });
  const trustAnchored = roots.length > 0 && verifyCertChain(chain, roots);

  return {
    fmt,
    attestationVerified: trustAnchored,
    trustPath: trustAnchored ? certChainToPems(chain) : undefined,
    aaguid: formatAaguid(aaguid),
  };
};

/**
 * Derive a base64url key identifier for the attestation certificate (the
 * SHA-256 of its `subjectPublicKey` BIT STRING). fido-u2f carries no AAGUID, so
 * this is how the relying party keys fido-u2f roots in its MetadataService.
 *
 * Returns `undefined` if the SPKI cannot be located; trust resolution then falls
 * through to the MetadataService's default roots.
 */
function u2fCertKeyId(certDer: Uint8Array): string | undefined {
  try {
    const spki = subjectPublicKeyBits(certDer);
    return spki ? bufferToBase64URL(sha256(spki)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract the raw `subjectPublicKey` BIT STRING payload from a certificate DER.
 * Walks Certificate → tbsCertificate → subjectPublicKeyInfo → subjectPublicKey
 * (the SPKI is the tbsCertificate child SEQUENCE whose children are an
 * algorithm SEQUENCE followed by a BIT STRING).
 */
function subjectPublicKeyBits(certDer: Uint8Array): Uint8Array | undefined {
  const certChildren = readSequence(certDer, 0);
  const tbs = certChildren[0];
  if (!tbs || tbs.tag !== ASN1_TAG.SEQUENCE) {
    return undefined;
  }
  const tbsChildren = readChildren(tbs.content);
  for (const node of tbsChildren) {
    if (node.tag !== ASN1_TAG.SEQUENCE) {
      continue;
    }
    const spkiChildren = readChildren(node.content);
    const algNode = spkiChildren[0];
    const bitStringNode = spkiChildren[1];
    if (
      algNode &&
      algNode.tag === ASN1_TAG.SEQUENCE &&
      bitStringNode &&
      bitStringNode.tag === ASN1_TAG.BIT_STRING
    ) {
      return readBitString(bitStringNode);
    }
  }
  return undefined;
}
