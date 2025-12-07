import { Decoder, encode } from 'cbor-x';
import { VerificationError } from '@/types';

/**
 * CBOR decoder configured for WebAuthn
 *
 * By default, cbor-x decodes CBOR maps as JavaScript Objects.
 * WebAuthn COSE keys use integer keys (1, 2, 3, -1, -2, etc.) which must be
 * accessed as Map keys, so we configure mapsAsObjects: false.
 */
const cborDecoder = new Decoder({
  mapsAsObjects: false, // Decode CBOR maps as JavaScript Map, not Object
});

/**
 * Decode CBOR data
 */
export function decodeCBOR<T = unknown>(data: Uint8Array): T {
  try {
    return cborDecoder.decode(data) as T;
  } catch {
    throw new VerificationError('Failed to decode CBOR data', 'CBOR_DECODE_ERROR');
  }
}

/**
 * Encode data to CBOR
 */
export function encodeCBOR(data: unknown): Uint8Array {
  try {
    const result = encode(data);
    // Ensure we always return a Uint8Array, not a Buffer
    return new Uint8Array(result);
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
    const value = cborDecoder.decode(data) as T;

    // This is a simplified implementation
    // In production, you'd want to properly track the consumed bytes
    return { value, remainingBytes: new Uint8Array(0) };
  } catch {
    throw new VerificationError('Failed to decode first CBOR object', 'CBOR_DECODE_FIRST_ERROR');
  }
}
