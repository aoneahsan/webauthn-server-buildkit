import type { X509Certificate } from 'node:crypto';
import { VerificationError } from '@/types';
import { timingSafeEqualBytes } from '@/utils/buffer';
import type { AttestationFormatVerifier } from '../types';
import { APPLE_WEBAUTHN_ROOT_CA_PEM } from '../roots/apple-webauthn-root-ca';
import { parseCertPem, publicKeyMatchesCOSE, verifyCertChain } from '../x509';
import { findExtension, readChildren, readSequence } from '../asn1';
import {
  certChainToPems,
  formatAaguid,
  parseX5cChain,
  readAttField,
  resolveRoots,
  sha256Concat,
} from './shared';

/**
 * Apple Anonymous Attestation OID carrying the nonce in the leaf credential
 * certificate. The extension value is a `SEQUENCE { [1] EXPLICIT OCTET STRING }`
 * where the OCTET STRING is the nonce.
 */
const APPLE_NONCE_OID = '1.2.840.113635.100.8.2';

/** Context-class constructed tag `[1]` (0xA0 | 0x01). */
const CONTEXT_TAG_1 = 0xa1;

/**
 * Extract the 32-byte nonce from the Apple credential certificate's nonce
 * extension.
 *
 * @throws {@link VerificationError} when the extension is absent or malformed.
 */
function extractAppleNonce(leaf: X509Certificate): Uint8Array {
  const extValue = findExtension(leaf.raw, APPLE_NONCE_OID);
  if (!extValue) {
    throw new VerificationError(
      'Apple attestation certificate is missing the nonce extension',
      'ATTESTATION_INVALID',
    );
  }

  // extValue is a SEQUENCE { [1] { OCTET STRING nonce } }.
  const seqChildren = readSequence(extValue, 0);
  const tagged = seqChildren.find((node) => node.tag === CONTEXT_TAG_1);
  if (!tagged) {
    throw new VerificationError(
      'Apple nonce extension is missing its [1] tagged value',
      'ATTESTATION_INVALID',
    );
  }

  // The [1] element explicitly wraps a single OCTET STRING holding the nonce.
  const inner = readChildren(tagged.content);
  const octet = inner[0];
  if (!octet || octet.tag !== 0x04) {
    throw new VerificationError(
      'Apple nonce extension does not wrap an OCTET STRING',
      'ATTESTATION_INVALID',
    );
  }
  return octet.content;
}

/**
 * Verify an `apple` (Apple Anonymous Attestation) statement.
 *
 * Cryptographically verified:
 * - The x5c chain links the per-credential leaf certificate to the bundled
 *   Apple WebAuthn Root CA (or to a root supplied via the MetadataService).
 * - The leaf's nonce extension (`1.2.840.113635.100.8.2`) equals
 *   `SHA-256(authData ‖ clientDataHash)`.
 * - The leaf certificate public key equals the credential public key.
 *
 * Apple's attestation carries **no `sig`** — trust derives entirely from the
 * chain + nonce binding. Because Apple's root is bundled, `apple` can be
 * trust-anchored without a MetadataService (the bundled root is added to any
 * RP-supplied roots).
 *
 * @throws {@link VerificationError} when a present statement is invalid (missing
 * x5c, malformed nonce extension, nonce mismatch, key mismatch, or a chain that
 * fails to anchor to the known Apple root).
 */
export const verifyAppleAttestation: AttestationFormatVerifier = (input) => {
  const { fmt, attStmt, authData, clientDataHash, credentialPublicKey, aaguid, metadataService } =
    input;

  const chain = parseX5cChain(readAttField(attStmt, 'x5c'));
  const leaf = chain[0]!;

  // 1. Nonce binding: ext nonce == SHA-256(authData ‖ clientDataHash).
  const expectedNonce = sha256Concat(authData, clientDataHash);
  const certNonce = extractAppleNonce(leaf);
  if (!timingSafeEqualBytes(certNonce, expectedNonce)) {
    throw new VerificationError(
      'Apple attestation nonce does not match SHA-256(authData ‖ clientDataHash)',
      'ATTESTATION_NONCE_MISMATCH',
    );
  }

  // 2. Leaf certificate public key must equal the credential public key.
  if (!publicKeyMatchesCOSE(leaf, credentialPublicKey)) {
    throw new VerificationError(
      'Apple attestation leaf certificate key does not match the credential public key',
      'ATTESTATION_KEY_MISMATCH',
    );
  }

  // 3. Chain to the bundled Apple root (plus any RP-supplied roots).
  const appleRoot = parseCertPem(APPLE_WEBAUTHN_ROOT_CA_PEM);
  const roots = [appleRoot, ...resolveRoots(metadataService, { aaguid: formatAaguid(aaguid) })];
  if (!verifyCertChain(chain, roots)) {
    throw new VerificationError(
      'Apple attestation certificate chain does not anchor to the Apple WebAuthn Root CA',
      'ATTESTATION_CHAIN_INVALID',
    );
  }

  return {
    fmt,
    attestationVerified: true,
    trustPath: certChainToPems(chain),
    aaguid: formatAaguid(aaguid),
  };
};
