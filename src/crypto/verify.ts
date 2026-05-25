import { constants, createPublicKey, verify as nodeVerify, type KeyObject } from 'node:crypto';
import {
  COSEAlgorithmIdentifier,
  COSEEllipticCurve,
  COSEKeyType,
  VerificationError,
} from '@/types';
import { bufferToBase64URL } from '@/utils/base64url';
import {
  COSEPublicKey,
  COSEEC2Key,
  COSERSAKey,
  COSEOKPKey,
  getCOSEAlgorithmIdentifier,
} from './cose';

/**
 * Algorithm details for signature verification
 */
interface AlgorithmInfo {
  /** Whether this algorithm uses RSA-PSS padding */
  isPSS: boolean;
  /** Node hash algorithm name, or null for algorithms that do not pre-hash (EdDSA) */
  hash: string | null;
}

/**
 * Get algorithm info from COSE algorithm identifier.
 *
 * The curve/key shape is taken from the COSE key itself (which is authoritative);
 * this only resolves the digest + padding implied by the registered algorithm.
 */
function getAlgorithmInfo(alg: COSEAlgorithmIdentifier): AlgorithmInfo {
  switch (alg) {
    case COSEAlgorithmIdentifier.ES256:
      return { isPSS: false, hash: 'sha256' };
    case COSEAlgorithmIdentifier.ES384:
      return { isPSS: false, hash: 'sha384' };
    case COSEAlgorithmIdentifier.ES512:
      return { isPSS: false, hash: 'sha512' };
    case COSEAlgorithmIdentifier.RS256:
      return { isPSS: false, hash: 'sha256' };
    case COSEAlgorithmIdentifier.RS384:
      return { isPSS: false, hash: 'sha384' };
    case COSEAlgorithmIdentifier.RS512:
      return { isPSS: false, hash: 'sha512' };
    case COSEAlgorithmIdentifier.PS256:
      return { isPSS: true, hash: 'sha256' };
    case COSEAlgorithmIdentifier.PS384:
      return { isPSS: true, hash: 'sha384' };
    case COSEAlgorithmIdentifier.PS512:
      return { isPSS: true, hash: 'sha512' };
    case COSEAlgorithmIdentifier.EdDSA:
      return { isPSS: false, hash: null };
    default:
      throw new VerificationError(`Unsupported algorithm: ${String(alg)}`, 'UNSUPPORTED_ALGORITHM');
  }
}

/**
 * Map a COSE elliptic curve to the JWK `crv` name.
 */
function ec2NamedCurve(key: COSEEC2Key): 'P-256' | 'P-384' | 'P-521' {
  switch (key.crv) {
    case COSEEllipticCurve.P256:
      return 'P-256';
    case COSEEllipticCurve.P384:
      return 'P-384';
    case COSEEllipticCurve.P521:
      return 'P-521';
    default:
      throw new VerificationError(`Unsupported EC2 curve: ${String(key.crv)}`, 'UNSUPPORTED_CURVE');
  }
}

/**
 * Import an EC2 COSE key as a Node public key via JWK.
 * Node validates that the point lies on the named curve.
 */
function ec2KeyToKeyObject(key: COSEEC2Key): KeyObject {
  return createPublicKey({
    key: {
      kty: 'EC',
      crv: ec2NamedCurve(key),
      x: bufferToBase64URL(key.x),
      y: bufferToBase64URL(key.y),
    },
    format: 'jwk',
  });
}

/**
 * Import an RSA COSE key as a Node public key via JWK.
 */
function rsaKeyToKeyObject(key: COSERSAKey): KeyObject {
  return createPublicKey({
    key: {
      kty: 'RSA',
      n: bufferToBase64URL(key.n),
      e: bufferToBase64URL(key.e),
    },
    format: 'jwk',
  });
}

/**
 * Import an Ed25519 (OKP) COSE key as a Node public key via JWK.
 */
function okpKeyToKeyObject(key: COSEOKPKey): KeyObject {
  return createPublicKey({
    key: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: bufferToBase64URL(key.x),
    },
    format: 'jwk',
  });
}

/**
 * Verify a signature using a COSE public key.
 *
 * Keys are imported via JWK so Node performs all ASN.1/SPKI handling and curve
 * validation — this supports EC2 (ES256/384/512), RSA (RS256/384/512, PS256/384/512)
 * and OKP (Ed25519) correctly, including large RSA moduli and P-521.
 *
 * @returns `true` if the signature is valid, `false` if it is invalid (or the key
 * cannot be imported). Throws {@link VerificationError} only for unsupported
 * algorithms/curves/key types.
 */
export function verifySignature(
  signature: Uint8Array,
  data: Uint8Array,
  publicKey: COSEPublicKey,
): boolean {
  const alg = getCOSEAlgorithmIdentifier(publicKey);
  const algInfo = getAlgorithmInfo(alg);

  try {
    switch (publicKey.kty) {
      case COSEKeyType.EC2: {
        const keyObject = ec2KeyToKeyObject(publicKey);
        // WebAuthn ECDSA signatures are ASN.1 DER encoded (Node's default dsaEncoding).
        return nodeVerify(algInfo.hash, data, keyObject, signature);
      }

      case COSEKeyType.RSA: {
        const keyObject = rsaKeyToKeyObject(publicKey);
        if (algInfo.isPSS) {
          return nodeVerify(
            algInfo.hash,
            data,
            {
              key: keyObject,
              padding: constants.RSA_PKCS1_PSS_PADDING,
              saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
            },
            signature,
          );
        }
        return nodeVerify(algInfo.hash, data, keyObject, signature);
      }

      case COSEKeyType.OKP: {
        if (alg !== COSEAlgorithmIdentifier.EdDSA) {
          throw new VerificationError(
            'Only EdDSA is supported for OKP keys',
            'UNSUPPORTED_OKP_ALGORITHM',
          );
        }

        // Ed25519 public keys are exactly 32 bytes.
        if (publicKey.x.length !== 32) {
          return false;
        }

        const keyObject = okpKeyToKeyObject(publicKey);
        // Ed25519 signs the message directly (no pre-hash).
        return nodeVerify(null, data, keyObject, signature);
      }

      default: {
        // This should never happen with proper types, but provides runtime safety
        const exhaustiveCheck: never = publicKey;
        throw new VerificationError(
          `Unsupported key type: ${(exhaustiveCheck as { kty: number }).kty}`,
          'UNSUPPORTED_KEY_TYPE',
        );
      }
    }
  } catch (error) {
    if (error instanceof VerificationError) {
      throw error;
    }

    // For crypto errors (invalid signatures, un-importable/invalid keys), fail closed.
    return false;
  }
}
