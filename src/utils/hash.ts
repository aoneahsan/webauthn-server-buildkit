import { createHash } from 'node:crypto';

/**
 * Create SHA-256 hash of data
 */
export function sha256(data: string | Uint8Array): Uint8Array {
  const hash = createHash('sha256');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

/**
 * Create SHA-384 hash of data
 */
export function sha384(data: string | Uint8Array): Uint8Array {
  const hash = createHash('sha384');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

/**
 * Create SHA-512 hash of data
 */
export function sha512(data: string | Uint8Array): Uint8Array {
  const hash = createHash('sha512');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

/**
 * Verify that a hash matches the expected value
 */
export function verifyHash(
  data: string | Uint8Array,
  expectedHash: Uint8Array,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256',
): boolean {
  let actualHash: Uint8Array;

  switch (algorithm) {
    case 'sha256':
      actualHash = sha256(data);
      break;
    case 'sha384':
      actualHash = sha384(data);
      break;
    case 'sha512':
      actualHash = sha512(data);
      break;
  }

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < actualHash.length; i++) {
    result |= actualHash[i]! ^ expectedHash[i]!;
  }

  return result === 0;
}
