import { decode, encode } from 'cbor-x';
import { VerificationError } from '@/types';

/**
 * Decode CBOR data
 */
export function decodeCBOR<T = unknown>(data: Uint8Array): T {
  try {
    return decode(data) as T;
  } catch {
    throw new VerificationError('Failed to decode CBOR data', 'CBOR_DECODE_ERROR');
  }
}

/**
 * Encode data to CBOR
 */
export function encodeCBOR(data: unknown): Uint8Array {
  try {
    return encode(data);
  } catch {
    throw new VerificationError('Failed to encode CBOR data', 'CBOR_ENCODE_ERROR');
  }
}

/**
 * Decode the first CBOR object from data
 */
export function decodeCBORFirst<T = unknown>(
  data: Uint8Array,
): {
  value: T;
  remainingBytes: Uint8Array;
} {
  try {
    // For now, we'll just use the regular decode
    // cbor-x doesn't expose position tracking in a simple way
    const value = decode(data) as T;

    // This is a simplified implementation
    // In production, you'd want to properly track the consumed bytes
    return { value, remainingBytes: new Uint8Array(0) };
  } catch {
    throw new VerificationError('Failed to decode first CBOR object', 'CBOR_DECODE_FIRST_ERROR');
  }
}
