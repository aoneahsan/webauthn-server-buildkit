import { createHash } from 'node:crypto';
import {
  COSEAlgorithmIdentifier,
  COSEEllipticCurve,
  COSEKeyType,
  VerificationError,
} from '@/types';
import { concatBuffers, timingSafeEqualBytes } from '@/utils/buffer';
import type { COSEPublicKey } from '@/crypto';
import type { AttestationFormatVerifier, AttestationVerificationResult } from '../types';
import { verifyCertChain } from '../x509';
import { decodeOID, findExtension, readSequence } from '../asn1';
import {
  asBytes,
  certChainToPems,
  formatAaguid,
  parseX5cChain,
  readAttField,
  resolveRoots,
  verifyWithCert,
} from './shared';
import {
  parseCertInfo,
  parsePubArea,
  TPM_ALG,
  TPM_ECC_CURVE,
  tpmHashToNodeDigest,
  type TpmtPublic,
} from './tpm-structs';

/** Extended Key Usage extension OID. */
const EXT_KEY_USAGE_OID = '2.5.29.37';
/** tcg-kp-AIKCertificate EKU OID required on a TPM AIK certificate. */
const AIK_CERT_EKU_OID = '2.23.133.8.3';

/**
 * Verify a `tpm` attestation statement (TPM 2.0).
 *
 * Cryptographically verified (full path, when a trust anchor is available):
 * - `certInfo` (TPMS_ATTEST) parses with the correct magic/type.
 * - The `pubArea` (TPMT_PUBLIC) public key equals the credential public key
 *   (RSA modulus+exponent, or ECC curve+point).
 * - `certInfo.attested.name` equals `nameAlg ‖ digest(pubArea)` under the TPM
 *   name-hash algorithm.
 * - `certInfo.extraData` equals `hash(authData ‖ clientDataHash)` under the
 *   statement `alg` digest.
 * - `sig` over `certInfo` verifies with the AIK certificate (`x5c[0]`).
 * - The AIK certificate carries the tcg-kp-AIKCertificate EKU
 *   (`2.23.133.8.3`).
 *
 * Trust anchoring:
 * - `attestationVerified` is `true` only when the AIK chain anchors to a root
 *   supplied via the MetadataService. A fully cryptographically valid statement
 *   with no available trust anchor yields `attestationVerified: false` (honest
 *   framing).
 *
 * Caveat (documented): the AIK Subject Alternative Name fields (TPM
 * manufacturer / model / version) are NOT additionally asserted here; the
 * security-critical key/name/extraData binding + AIK signature + EKU + chain
 * are. The SAN is available to relying parties via `trustPath`.
 *
 * @throws {@link VerificationError} only when a present statement is invalid
 * (malformed TPM structures, key/name/extraData mismatch, bad AIK signature, or
 * missing AIK EKU).
 */
export const verifyTpmAttestation: AttestationFormatVerifier = (input) => {
  const { fmt, attStmt, authData, clientDataHash, credentialPublicKey, aaguid, metadataService } =
    input;

  const certInfoBytes = asBytes(readAttField(attStmt, 'certInfo'));
  const pubAreaBytes = asBytes(readAttField(attStmt, 'pubArea'));
  const sig = asBytes(readAttField(attStmt, 'sig'));
  const algRaw = readAttField(attStmt, 'alg');
  if (!certInfoBytes || !pubAreaBytes || !sig) {
    throw new VerificationError(
      'tpm attestation is missing certInfo, pubArea, or sig',
      'ATTESTATION_INVALID',
    );
  }
  const alg = typeof algRaw === 'number' ? algRaw : undefined;

  const chain = parseX5cChain(readAttField(attStmt, 'x5c'));
  const aikCert = chain[0]!;

  const pubArea = parsePubArea(pubAreaBytes);
  const certInfo = parseCertInfo(certInfoBytes);

  // 1. pubArea public key must equal the credential public key.
  if (!pubAreaMatchesCredential(pubArea, credentialPublicKey)) {
    throw new VerificationError(
      'tpm pubArea public key does not match the credential public key',
      'ATTESTATION_KEY_MISMATCH',
    );
  }

  // 2. attested.name must equal nameAlg ‖ digest(pubArea).
  if (!attestedNameMatches(certInfo.attestedName, pubArea.nameAlg, pubAreaBytes)) {
    throw new VerificationError(
      'tpm certInfo attested name does not match the pubArea',
      'ATTESTATION_INVALID',
    );
  }

  // 3. extraData must equal hash(authData ‖ clientDataHash) under the alg digest.
  const attDigest = hashForCoseAlg(alg);
  const expectedExtraData = digest(attDigest, concatBuffers(authData, clientDataHash));
  if (!timingSafeEqualBytes(certInfo.extraData, expectedExtraData)) {
    throw new VerificationError(
      'tpm certInfo extraData does not match hash(authData ‖ clientDataHash)',
      'ATTESTATION_INVALID',
    );
  }

  // 4. Verify sig over certInfo with the AIK certificate.
  if (!verifyWithCert(aikCert, sig, certInfoBytes, attDigest)) {
    throw new VerificationError(
      'tpm attestation signature is invalid',
      'ATTESTATION_SIGNATURE_INVALID',
    );
  }

  // 5. AIK cert must carry the tcg-kp-AIKCertificate EKU.
  if (!hasAikEku(aikCert.raw)) {
    throw new VerificationError(
      'tpm AIK certificate is missing the tcg-kp-AIKCertificate EKU',
      'ATTESTATION_CERT_INVALID',
    );
  }

  // 6. Trust-anchor the AIK chain.
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

/** Node digest implied by a COSE signature algorithm; defaults to sha256. */
function hashForCoseAlg(alg: number | undefined): string {
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

function digest(hash: string, data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash(hash).update(data).digest());
}

/** Compare the pubArea key material to the COSE credential key. */
function pubAreaMatchesCredential(pubArea: TpmtPublic, cose: COSEPublicKey): boolean {
  if (pubArea.type === TPM_ALG.RSA) {
    if (cose.kty !== COSEKeyType.RSA || !pubArea.rsaModulus) {
      return false;
    }
    // Compare the modulus, tolerating a single leading zero on either side
    // (TPM stores the magnitude; COSE may include a sign byte).
    if (!bytesEqualIgnoringLeadingZero(pubArea.rsaModulus, cose.n)) {
      return false;
    }
    const coseExp = beBytesToNumber(cose.e);
    return pubArea.rsaExponent === coseExp;
  }

  if (pubArea.type === TPM_ALG.ECC) {
    if (cose.kty !== COSEKeyType.EC2 || !pubArea.eccX || !pubArea.eccY) {
      return false;
    }
    if (!eccCurveMatches(pubArea.eccCurve, cose.crv)) {
      return false;
    }
    return timingSafeEqualBytes(pubArea.eccX, cose.x) && timingSafeEqualBytes(pubArea.eccY, cose.y);
  }

  return false;
}

/** Whether a TPM_ECC_CURVE id corresponds to the COSE curve. */
function eccCurveMatches(tpmCurve: number | undefined, coseCurve: COSEEllipticCurve): boolean {
  switch (coseCurve) {
    case COSEEllipticCurve.P256:
      return tpmCurve === TPM_ECC_CURVE.NIST_P256;
    case COSEEllipticCurve.P384:
      return tpmCurve === TPM_ECC_CURVE.NIST_P384;
    case COSEEllipticCurve.P521:
      return tpmCurve === TPM_ECC_CURVE.NIST_P521;
    default:
      return false;
  }
}

/** `attested.name` == 2-byte nameAlg ‖ digest(pubArea) under that algorithm. */
function attestedNameMatches(
  attestedName: Uint8Array,
  nameAlg: number,
  pubArea: Uint8Array,
): boolean {
  const nodeHash = tpmHashToNodeDigest(nameAlg);
  if (!nodeHash) {
    return false;
  }
  const algId = Uint8Array.from([(nameAlg >> 8) & 0xff, nameAlg & 0xff]);
  const expected = concatBuffers(algId, digest(nodeHash, pubArea));
  return timingSafeEqualBytes(attestedName, expected);
}

/** Whether the certificate carries the tcg-kp-AIKCertificate EKU. */
function hasAikEku(certDer: Uint8Array): boolean {
  const extValue = findExtension(certDer, EXT_KEY_USAGE_OID);
  if (!extValue) {
    return false;
  }
  try {
    // ExtKeyUsageSyntax ::= SEQUENCE OF KeyPurposeId (OID).
    const oids = readSequence(extValue, 0);
    return oids.some((node) => node.tag === 0x06 && decodeOID(node) === AIK_CERT_EKU_OID);
  } catch {
    return false;
  }
}

/** Compare two big-endian magnitudes, ignoring a single leading 0x00 sign byte. */
function bytesEqualIgnoringLeadingZero(a: Uint8Array, b: Uint8Array): boolean {
  return timingSafeEqualBytes(stripLeadingZero(a), stripLeadingZero(b));
}

function stripLeadingZero(bytes: Uint8Array): Uint8Array {
  return bytes.length > 1 && bytes[0] === 0x00 ? bytes.subarray(1) : bytes;
}

/** Interpret big-endian bytes as an unsigned integer (small values only). */
function beBytesToNumber(bytes: Uint8Array): number {
  let value = 0;
  for (const b of bytes) {
    value = value * 256 + b;
  }
  return value;
}
