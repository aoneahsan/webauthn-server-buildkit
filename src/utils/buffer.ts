import { timingSafeEqual } from 'node:crypto';

/**
 * Concatenate multiple buffers
 */
export function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

/**
 * Compare two buffers for equality (NON-constant-time).
 *
 * WARNING: this short-circuits on the first differing byte, so its runtime
 * leaks how many leading bytes matched. It MUST NOT be used to compare secret
 * or attacker-influenced values (hashes, MACs, GCM tags, RP-ID hashes,
 * signatures). For any security-sensitive comparison use
 * {@link timingSafeEqualBytes}, which is constant-time. This helper is intended
 * only for non-secret equality checks.
 */
export function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Constant-time comparison of two byte arrays, for security-sensitive values
 * (e.g. RP ID hashes). Unequal lengths return `false` without leaking content;
 * equal-length inputs are compared in constant time via {@link timingSafeEqual}.
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Convert buffer to hex string
 */
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to buffer
 */
export function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return bytes;
}

/**
 * Convert a number to buffer (big-endian).
 *
 * Uses arithmetic rather than bitwise operators so values above 2^31 (e.g. a
 * 32-bit signature counter) are encoded correctly — JS bitwise ops are 32-bit
 * signed and would corrupt large values.
 */
export function numberToBuffer(num: number, length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    buffer[i] = num % 256;
    num = Math.floor(num / 256);
  }
  return buffer;
}

/**
 * Convert buffer to number (big-endian).
 *
 * Uses multiplication rather than the bitwise `<<` so 4-byte values above 2^24
 * (notably authenticator signature counters, which are unsigned 32-bit) are not
 * corrupted by 32-bit signed integer overflow.
 */
export function bufferToNumber(buffer: Uint8Array): number {
  let num = 0;
  for (let i = 0; i < buffer.length; i++) {
    num = num * 256 + buffer[i]!;
  }
  return num;
}
