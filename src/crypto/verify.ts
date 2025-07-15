import { createVerify, constants } from 'node:crypto';
import { COSEAlgorithmIdentifier, COSEKeyType, VerificationError } from '@/types';
import { COSEPublicKey, COSEEC2Key, COSERSAKey, getCOSEAlgorithmIdentifier } from './cose';

/**
 * Algorithm details for signature verification
 */
interface AlgorithmInfo {
  name: string;
  hash: string;
  namedCurve?: string;
}

/**
 * Get algorithm info from COSE algorithm identifier
 */
function getAlgorithmInfo(alg: COSEAlgorithmIdentifier): AlgorithmInfo {
  switch (alg) {
    case COSEAlgorithmIdentifier.ES256:
      return { name: 'ECDSA', hash: 'SHA-256', namedCurve: 'P-256' };
    case COSEAlgorithmIdentifier.ES384:
      return { name: 'ECDSA', hash: 'SHA-384', namedCurve: 'P-384' };
    case COSEAlgorithmIdentifier.ES512:
      return { name: 'ECDSA', hash: 'SHA-512', namedCurve: 'P-521' };
    case COSEAlgorithmIdentifier.RS256:
      return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    case COSEAlgorithmIdentifier.RS384:
      return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' };
    case COSEAlgorithmIdentifier.RS512:
      return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' };
    case COSEAlgorithmIdentifier.PS256:
      return { name: 'RSA-PSS', hash: 'SHA-256' };
    case COSEAlgorithmIdentifier.PS384:
      return { name: 'RSA-PSS', hash: 'SHA-384' };
    case COSEAlgorithmIdentifier.PS512:
      return { name: 'RSA-PSS', hash: 'SHA-512' };
    case COSEAlgorithmIdentifier.EdDSA:
      return { name: 'Ed25519', hash: 'SHA-512' };
    default:
      throw new VerificationError(`Unsupported algorithm: ${String(alg)}`, 'UNSUPPORTED_ALGORITHM');
  }
}

/**
 * Convert EC2 key to SubjectPublicKeyInfo format
 */
function ec2KeyToSPKI(key: COSEEC2Key, namedCurve: string): Buffer {
  // Create uncompressed point (0x04 || x || y)
  const point = Buffer.concat([Buffer.from([0x04]), Buffer.from(key.x), Buffer.from(key.y)]);

  // EC public key OID based on curve
  let curveOid: Buffer;
  switch (namedCurve) {
    case 'P-256':
      curveOid = Buffer.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
      break;
    case 'P-384':
      curveOid = Buffer.from([0x2b, 0x81, 0x04, 0x00, 0x22]);
      break;
    case 'P-521':
      curveOid = Buffer.from([0x2b, 0x81, 0x04, 0x00, 0x23]);
      break;
    default:
      throw new VerificationError(`Unsupported curve: ${namedCurve}`, 'UNSUPPORTED_CURVE');
  }

  // Build ASN.1 structure
  const algorithmIdentifier = Buffer.concat([
    Buffer.from([0x30, 0x13]), // SEQUENCE
    Buffer.from([0x06, 0x07]), // OID for ecPublicKey
    Buffer.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]),
    Buffer.from([0x06, curveOid.length]),
    curveOid,
  ]);

  const bitString = Buffer.concat([Buffer.from([0x03, point.length + 1, 0x00]), point]);

  const spki = Buffer.concat([
    Buffer.from([0x30, algorithmIdentifier.length + bitString.length]),
    algorithmIdentifier,
    bitString,
  ]);

  return spki;
}

/**
 * Convert RSA key to SubjectPublicKeyInfo format
 */
function rsaKeyToSPKI(key: COSERSAKey): Buffer {
  // Build ASN.1 RSA public key
  const modulus = Buffer.concat([Buffer.from([0x02, key.n.length]), Buffer.from(key.n)]);

  const exponent = Buffer.concat([Buffer.from([0x02, key.e.length]), Buffer.from(key.e)]);

  const rsaPublicKey = Buffer.concat([
    Buffer.from([0x30, modulus.length + exponent.length]),
    modulus,
    exponent,
  ]);

  // RSA algorithm identifier
  const algorithmIdentifier = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);

  const bitString = Buffer.concat([
    Buffer.from([0x03, rsaPublicKey.length + 1, 0x00]),
    rsaPublicKey,
  ]);

  const spki = Buffer.concat([
    Buffer.from([0x30, algorithmIdentifier.length + bitString.length]),
    algorithmIdentifier,
    bitString,
  ]);

  return spki;
}

/**
 * Verify a signature using a COSE public key
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
        const spki = ec2KeyToSPKI(publicKey, algInfo.namedCurve!);
        const verify = createVerify(algInfo.hash);
        verify.update(data);
        return verify.verify(
          {
            key: spki,
            format: 'der',
            type: 'spki',
          },
          signature,
        );
      }

      case COSEKeyType.RSA: {
        const spki = rsaKeyToSPKI(publicKey);
        const verify = createVerify(algInfo.hash);
        verify.update(data);

        if (algInfo.name === 'RSA-PSS') {
          return verify.verify(
            {
              key: spki,
              format: 'der',
              type: 'spki',
              padding: constants.RSA_PKCS1_PSS_PADDING,
              saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
            },
            signature,
          );
        }

        return verify.verify(
          {
            key: spki,
            format: 'der',
            type: 'spki',
          },
          signature,
        );
      }

      case COSEKeyType.OKP: {
        if (alg !== COSEAlgorithmIdentifier.EdDSA) {
          throw new VerificationError(
            'Only EdDSA is supported for OKP keys',
            'UNSUPPORTED_OKP_ALGORITHM',
          );
        }

        // Ed25519 doesn't use standard verify API
        // For now, we'll throw an error as Ed25519 requires specific handling
        throw new VerificationError(
          'Ed25519 verification not yet implemented',
          'ED25519_NOT_IMPLEMENTED',
        );
      }

      default:
        throw new VerificationError(
          `Unsupported key type: ${publicKey.kty}`,
          'UNSUPPORTED_KEY_TYPE',
        );
    }
  } catch (error) {
    if (error instanceof VerificationError) {
      throw error;
    }

    throw new VerificationError('Signature verification failed', 'SIGNATURE_VERIFICATION_FAILED');
  }
}
