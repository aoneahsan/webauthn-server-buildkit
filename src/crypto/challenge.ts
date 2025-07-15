import { randomBytes } from 'node:crypto';
import { bufferToBase64URL } from '@/utils/base64url';
import type { Base64URLString } from '@/types';

/**
 * Generate a cryptographically secure random challenge
 */
export function generateChallenge(size: number = 32): Base64URLString {
  if (size < 16) {
    throw new Error('Challenge size must be at least 16 bytes');
  }

  if (size > 64) {
    throw new Error('Challenge size must not exceed 64 bytes');
  }

  const buffer = randomBytes(size);
  return bufferToBase64URL(buffer);
}

/**
 * Generate a secure random ID
 */
export function generateRandomId(size: number = 16): Base64URLString {
  const buffer = randomBytes(size);
  return bufferToBase64URL(buffer);
}
