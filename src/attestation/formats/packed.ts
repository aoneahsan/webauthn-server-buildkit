import type { X509Certificate } from 'node:crypto';
import { COSEAlgorithmIdentifier, VerificationError } from '@/types';
import { verifySignature } from '@/crypto';
import { concatBuffers, timingSafeEqualBytes } from '@/utils/buffer';
import type { AttestationFormatVerifier, AttestationVerificationResult } from '../types';
import { verifyCertChain } from '../x509';
import { findExtension, readChildren, readOctetString, readSequence, readTLV } from '../asn1';
import {
  asBytes,
  certChainToPems,
  formatAaguid,
  parseX5cChain,
  readAttField,
  resolveRoots,
  verifyWithCert,
} from './shared';

/** FIDO "id-fido-gen-ce-aaguid" extension OID embedded in packed attestation leaf certs. */
const PACKED_AAGUID_OID = '1.3.6.1.4.1.45724.1.1.4';

/**
 * Verify a `packed` attestation statement (both the self and x5c variants).
 *
 * **Self attestation (no `x5c`):** `sig` over `authData ‖ clientDataHash` is
 * verified with the *credential* public key. `attestationVerified: true` on
 * success — no certificate chain is involved, so this needs no trust anchor.
 *
 * **Full attestation (`x5c` present):**
 * - `sig` over `authData ‖ clientDataHash` is verified with the **leaf**
 *   certificate's public key, using the digest implied by the statement `alg`.
 * - Leaf certificate requirements are enforced: X.509 version 3, subject OU
 *   exactly `"Authenticator Attestation"`, and BasicConstraints CA = false.
 * - If the leaf carries the FIDO AAGUID extension (`1.3.6.1.4.1.45724.1.1.4`),
 *   its value must equal the authenticator-data AAGUID.
 * - `attestationVerified: true` **only** when the x5c chain anchors to a root
 *   supplied via the MetadataService. A valid signature with no available trust
 *   anchor yields `attestationVerified: false` (honest framing) — not a throw.
 *
 * @throws {@link VerificationError} only when a present statement is
 * cryptographically invalid (missing `sig`, bad signature, leaf-cert
 * requirements unmet, or an AAGUID-extension mismatch).
 */
export const verifyPackedAttestation: AttestationFormatVerifier = (input) => {
  const { fmt, attStmt, authData, clientDataHash, credentialPublicKey, aaguid, metadataService } =
    input;

  const sig = asBytes(readAttField(attStmt, 'sig'));
  if (!sig) {
    throw new VerificationError('packed attestation is missing sig', 'ATTESTATION_INVALID');
  }

  const x5c = readAttField(attStmt, 'x5c');
  const signatureBase = concatBuffers(authData, clientDataHash);

  // Self attestation: no x5c → verify with the credential key.
  if (x5c === undefined || x5c === null) {
    if (!verifySignature(sig, signatureBase, credentialPublicKey)) {
      throw new VerificationError(
        'Packed self-attestation signature is invalid',
        'ATTESTATION_SIGNATURE_INVALID',
      );
    }
    return { fmt, attestationVerified: true, aaguid: formatAaguid(aaguid) };
  }

  // Full attestation: verify with the leaf cert key + trust-anchor the chain.
  const chain = parseX5cChain(x5c);
  const leaf = chain[0]!;

  const alg = readAttField(attStmt, 'alg');
  const hash = hashForAlg(typeof alg === 'number' ? alg : undefined);
  if (!verifyWithCert(leaf, sig, signatureBase, hash)) {
    throw new VerificationError(
      'packed attestation signature is invalid',
      'ATTESTATION_SIGNATURE_INVALID',
    );
  }

  enforcePackedLeafRequirements(leaf);
  assertAaguidExtensionMatches(leaf, aaguid);

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

/** Node digest name implied by a COSE signature algorithm; defaults to sha256. */
function hashForAlg(alg: number | undefined): string {
  switch (alg) {
    case COSEAlgorithmIdentifier.ES384:
    case COSEAlgorithmIdentifier.RS384:
    case COSEAlgorithmIdentifier.PS384:
      return 'sha384';
    case COSEAlgorithmIdentifier.ES512:
    case COSEAlgorithmIdentifier.RS512:
    case COSEAlgorithmIdentifier.PS512:
      return 'sha512';
    default:
      return 'sha256';
  }
}

/**
 * Enforce the WebAuthn §8.2 packed leaf-certificate requirements: X.509 v3,
 * subject organizational unit exactly `"Authenticator Attestation"`, and
 * BasicConstraints CA = false.
 *
 * @throws {@link VerificationError} (`ATTESTATION_CERT_INVALID`) on any breach.
 */
function enforcePackedLeafRequirements(leaf: X509Certificate): void {
  if (getCertVersion(leaf.raw) !== 3) {
    throw new VerificationError(
      'packed attestation leaf certificate must be X.509 version 3',
      'ATTESTATION_CERT_INVALID',
    );
  }

  const ou = subjectField(leaf.subject, 'OU');
  if (ou !== 'Authenticator Attestation') {
    throw new VerificationError(
      'packed attestation leaf certificate subject OU must be "Authenticator Attestation"',
      'ATTESTATION_CERT_INVALID',
    );
  }

  if (leaf.ca) {
    throw new VerificationError(
      'packed attestation leaf certificate must have BasicConstraints CA = false',
      'ATTESTATION_CERT_INVALID',
    );
  }
}

/**
 * When the leaf carries the FIDO AAGUID extension, assert its 16-byte value
 * equals the authenticator-data AAGUID. Absence of the extension is allowed.
 *
 * @throws {@link VerificationError} (`ATTESTATION_INVALID`) on mismatch.
 */
function assertAaguidExtensionMatches(leaf: X509Certificate, aaguid: Uint8Array | undefined): void {
  const extValue = findExtension(leaf.raw, PACKED_AAGUID_OID);
  if (!extValue) {
    return;
  }
  // extValue is an OCTET STRING wrapping the 16-byte AAGUID.
  const inner = readTLV(extValue, 0);
  const certAaguid = readOctetString(inner);
  if (!aaguid || !timingSafeEqualBytes(certAaguid, aaguid)) {
    throw new VerificationError(
      'packed attestation leaf AAGUID extension does not match the authenticator data AAGUID',
      'ATTESTATION_INVALID',
    );
  }
}

/** Read the X.509 version number (1, 2, or 3) from a certificate's DER. */
function getCertVersion(certDer: Uint8Array): number {
  const certChildren = readSequence(certDer, 0);
  const tbs = certChildren[0];
  if (!tbs) {
    return 1;
  }
  const tbsChildren = readChildren(tbs.content);
  // The first tbsCertificate field is the OPTIONAL `[0] EXPLICIT Version`.
  const versionWrapper = tbsChildren[0];
  if (!versionWrapper || versionWrapper.tag !== 0xa0) {
    // No explicit version field → defaults to v1.
    return 1;
  }
  const versionInt = readTLV(versionWrapper.content, 0);
  // INTEGER value 0/1/2 corresponds to v1/v2/v3.
  const raw = versionInt.content;
  const value = raw.length > 0 ? raw[raw.length - 1]! : 0;
  return value + 1;
}

/**
 * Extract a single subject relative-distinguished-name field value (e.g. `"OU"`)
 * from Node's newline-separated `cert.subject` string.
 */
function subjectField(subject: string, key: string): string | undefined {
  for (const line of subject.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && line.slice(0, eq).trim() === key) {
      return line.slice(eq + 1).trim();
    }
  }
  return undefined;
}
