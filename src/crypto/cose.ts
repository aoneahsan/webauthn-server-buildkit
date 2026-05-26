import {
  COSEAlgorithmIdentifier,
  COSEEllipticCurve,
  COSEKeyType,
  VerificationError,
} from '@/types';
import { decodeCBOR } from './cbor';

/**
 * COSE key common parameters
 */
export interface COSEKeyCommon {
  kty: COSEKeyType;
  alg?: COSEAlgorithmIdentifier;
  key_ops?: number[];
  base_iv?: Uint8Array;
  kid?: Uint8Array;
}

/**
 * COSE EC2 key parameters
 */
export interface COSEEC2Key extends COSEKeyCommon {
  kty: COSEKeyType.EC2;
  crv: COSEEllipticCurve;
  x: Uint8Array;
  y: Uint8Array;
}

/**
 * COSE RSA key parameters
 */
export interface COSERSAKey extends COSEKeyCommon {
  kty: COSEKeyType.RSA;
  n: Uint8Array;
  e: Uint8Array;
}

/**
 * COSE OKP key parameters
 */
export interface COSEOKPKey extends COSEKeyCommon {
  kty: COSEKeyType.OKP;
  crv: COSEEllipticCurve;
  x: Uint8Array;
}

/**
 * COSE public key type
 */
export type COSEPublicKey = COSEEC2Key | COSERSAKey | COSEOKPKey;

/**
 * COSE key parameter numbers
 */
const COSE_KEY_PARAMS = {
  kty: 1,
  kid: 2,
  alg: 3,
  key_ops: 4,
  base_iv: 5,
  crv: -1,
  x: -2,
  y: -3,
  n: -1,
  e: -2,
} as const;

/**
 * Parse a COSE public key from CBOR
 */
export function parseCOSEPublicKey(publicKeyBytes: Uint8Array): COSEPublicKey {
  let coseKey: Map<number, unknown>;

  try {
    coseKey = decodeCBOR<Map<number, unknown>>(publicKeyBytes);
  } catch {
    throw new VerificationError('Failed to decode COSE public key', 'COSE_DECODE_ERROR');
  }

  if (!(coseKey instanceof Map)) {
    throw new VerificationError('COSE public key must be a CBOR map', 'COSE_INVALID_FORMAT');
  }

  const kty = coseKey.get(COSE_KEY_PARAMS.kty) as number;
  const alg = coseKey.get(COSE_KEY_PARAMS.alg) as number | undefined;

  if (!kty) {
    throw new VerificationError('COSE public key missing key type (kty)', 'COSE_MISSING_KTY');
  }

  switch (kty as COSEKeyType) {
    case COSEKeyType.EC2: {
      const crv = coseKey.get(COSE_KEY_PARAMS.crv) as number;
      const x = coseKey.get(COSE_KEY_PARAMS.x) as Uint8Array;
      const y = coseKey.get(COSE_KEY_PARAMS.y) as Uint8Array;

      if (!crv || !x || !y) {
        throw new VerificationError('COSE EC2 key missing required parameters', 'COSE_EC2_INVALID');
      }

      return {
        kty: COSEKeyType.EC2,
        alg,
        crv,
        x,
        y,
      };
    }

    case COSEKeyType.RSA: {
      const n = coseKey.get(COSE_KEY_PARAMS.n) as Uint8Array;
      const e = coseKey.get(COSE_KEY_PARAMS.e) as Uint8Array;

      if (!n || !e) {
        throw new VerificationError('COSE RSA key missing required parameters', 'COSE_RSA_INVALID');
      }

      return {
        kty: COSEKeyType.RSA,
        alg,
        n,
        e,
      };
    }

    case COSEKeyType.OKP: {
      const crv = coseKey.get(COSE_KEY_PARAMS.crv) as number;
      const x = coseKey.get(COSE_KEY_PARAMS.x) as Uint8Array;

      if (!crv || !x) {
        throw new VerificationError('COSE OKP key missing required parameters', 'COSE_OKP_INVALID');
      }

      return {
        kty: COSEKeyType.OKP,
        alg,
        crv,
        x,
      };
    }

    default:
      throw new VerificationError(`Unsupported COSE key type: ${kty}`, 'COSE_UNSUPPORTED_KEY_TYPE');
  }
}

/** RSA-family COSE algorithms (PKCS#1 v1.5 and PSS). */
const RSA_ALGORITHMS: ReadonlySet<COSEAlgorithmIdentifier> = new Set([
  COSEAlgorithmIdentifier.RS256,
  COSEAlgorithmIdentifier.RS384,
  COSEAlgorithmIdentifier.RS512,
  COSEAlgorithmIdentifier.PS256,
  COSEAlgorithmIdentifier.PS384,
  COSEAlgorithmIdentifier.PS512,
]);

/**
 * The canonical ECDSA algorithm for an EC2 curve.
 */
function ec2CanonicalAlg(crv: COSEEllipticCurve): COSEAlgorithmIdentifier {
  switch (crv) {
    case COSEEllipticCurve.P256:
      return COSEAlgorithmIdentifier.ES256;
    case COSEEllipticCurve.P384:
      return COSEAlgorithmIdentifier.ES384;
    case COSEEllipticCurve.P521:
      return COSEAlgorithmIdentifier.ES512;
    default:
      throw new VerificationError(
        `Cannot determine algorithm for EC2 curve: ${String(crv)}`,
        'COSE_UNKNOWN_ALGORITHM',
      );
  }
}

/**
 * Reject a declared COSE `alg` that is inconsistent with the key's type/curve.
 *
 * Without this, an attacker-supplied key could declare an `alg` that selects a
 * different digest or padding scheme than its actual shape implies (e.g. a
 * P-256 key declaring ES512, or an RSA key declaring ES256), decoupling the
 * verification algorithm from the key.
 */
function assertAlgorithmConsistent(coseKey: COSEPublicKey, alg: COSEAlgorithmIdentifier): void {
  switch (coseKey.kty) {
    case COSEKeyType.EC2: {
      const expected = ec2CanonicalAlg(coseKey.crv);
      if (alg !== expected) {
        throw new VerificationError(
          `COSE EC2 key on its curve declares an incompatible algorithm (${String(alg)})`,
          'COSE_ALG_MISMATCH',
        );
      }
      return;
    }
    case COSEKeyType.RSA: {
      if (!RSA_ALGORITHMS.has(alg)) {
        throw new VerificationError(
          `COSE RSA key declares a non-RSA algorithm (${String(alg)})`,
          'COSE_ALG_MISMATCH',
        );
      }
      return;
    }
    case COSEKeyType.OKP: {
      if (coseKey.crv !== COSEEllipticCurve.Ed25519 || alg !== COSEAlgorithmIdentifier.EdDSA) {
        throw new VerificationError(
          `COSE OKP key declares an incompatible algorithm (${String(alg)})`,
          'COSE_ALG_MISMATCH',
        );
      }
      return;
    }
  }
}

/**
 * Get the algorithm identifier from a COSE key.
 *
 * When the key declares an explicit `alg`, it is validated against the key
 * type/curve (see {@link assertAlgorithmConsistent}) before being trusted; when
 * absent, the canonical algorithm is inferred from the key type/curve.
 */
export function getCOSEAlgorithmIdentifier(coseKey: COSEPublicKey): COSEAlgorithmIdentifier {
  if (coseKey.alg !== undefined) {
    assertAlgorithmConsistent(coseKey, coseKey.alg);
    return coseKey.alg;
  }

  // Infer algorithm from key type and curve
  switch (coseKey.kty) {
    case COSEKeyType.EC2:
      return ec2CanonicalAlg(coseKey.crv);

    case COSEKeyType.RSA:
      // Default to RS256 for RSA keys that omit `alg`.
      return COSEAlgorithmIdentifier.RS256;

    case COSEKeyType.OKP:
      if (coseKey.crv === COSEEllipticCurve.Ed25519) {
        return COSEAlgorithmIdentifier.EdDSA;
      }
      throw new VerificationError(
        `Cannot infer algorithm for OKP curve: ${String(coseKey.crv)}`,
        'COSE_UNKNOWN_ALGORITHM',
      );

    default:
      throw new VerificationError('Cannot infer algorithm from key type', 'COSE_UNKNOWN_ALGORITHM');
  }
}
