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
 * Decode CBOR data.
 *
 * Note: cbor-x throws if the buffer contains trailing bytes beyond a single
 * item. Use {@link decodeCBORFirst} when the buffer may contain more than one
 * concatenated item (e.g. a COSE key followed by extension data).
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

function ensure(data: Uint8Array, end: number): void {
  if (end > data.length) {
    throw new VerificationError('Unexpected end of CBOR data', 'CBOR_DECODE_FIRST_ERROR');
  }
}

/**
 * Compute the byte length of the single CBOR data item beginning at `offset`,
 * per the item-size rules of RFC 8949. Supports all major types with
 * definite-length encoding (which is what WebAuthn COSE keys and extension maps
 * use). Indefinite-length encoding is rejected — it does not occur in WebAuthn
 * authenticator data and allowing it would complicate fail-closed bounds.
 */
function cborItemLength(data: Uint8Array, offset: number): number {
  const start = offset;
  ensure(data, offset + 1);
  const initialByte = data[offset]!;
  offset += 1;
  const majorType = initialByte >> 5;
  const info = initialByte & 0x1f;

  if (info === 31) {
    throw new VerificationError(
      'Indefinite-length CBOR items are not supported',
      'CBOR_DECODE_FIRST_ERROR',
    );
  }

  // Read the argument (length / value) encoded by the additional-info bits and
  // advance past its bytes.
  const readArgument = (): number => {
    if (info < 24) {
      return info;
    }
    if (info === 24) {
      ensure(data, offset + 1);
      const value = data[offset]!;
      offset += 1;
      return value;
    }
    if (info === 25) {
      ensure(data, offset + 2);
      const value = (data[offset]! << 8) | data[offset + 1]!;
      offset += 2;
      return value;
    }
    if (info === 26) {
      ensure(data, offset + 4);
      const value =
        data[offset]! * 0x1000000 +
        ((data[offset + 1]! << 16) | (data[offset + 2]! << 8) | data[offset + 3]!);
      offset += 4;
      return value >>> 0;
    }
    if (info === 27) {
      ensure(data, offset + 8);
      // 8-byte argument. JS numbers safely cover buffer lengths well below 2^53.
      let value = 0;
      for (let i = 0; i < 8; i++) {
        value = value * 256 + data[offset + i]!;
      }
      offset += 8;
      return value;
    }
    throw new VerificationError('Invalid CBOR additional info', 'CBOR_DECODE_FIRST_ERROR');
  };

  switch (majorType) {
    case 0: // unsigned integer
    case 1: // negative integer
      readArgument();
      return offset - start;

    case 2: // byte string
    case 3: {
      // text string
      const len = readArgument();
      offset += len;
      ensure(data, offset);
      return offset - start;
    }

    case 4: {
      // array of `count` items
      const count = readArgument();
      for (let i = 0; i < count; i++) {
        offset += cborItemLength(data, offset);
      }
      return offset - start;
    }

    case 5: {
      // map of `count` key/value pairs
      const count = readArgument();
      for (let i = 0; i < count * 2; i++) {
        offset += cborItemLength(data, offset);
      }
      return offset - start;
    }

    case 6: {
      // tag: the tag argument followed by one tagged item
      readArgument();
      offset += cborItemLength(data, offset);
      return offset - start;
    }

    case 7: {
      // simple value / float
      if (info <= 23) {
        return offset - start;
      }
      if (info === 24) {
        offset += 1;
      } else if (info === 25) {
        offset += 2;
      } else if (info === 26) {
        offset += 4;
      } else if (info === 27) {
        offset += 8;
      } else {
        throw new VerificationError('Invalid CBOR simple/float value', 'CBOR_DECODE_FIRST_ERROR');
      }
      ensure(data, offset);
      return offset - start;
    }

    default:
      throw new VerificationError('Invalid CBOR major type', 'CBOR_DECODE_FIRST_ERROR');
  }
}

/**
 * Decode the first CBOR item from a buffer that may contain additional
 * concatenated data, returning the decoded value and the bytes that follow it.
 *
 * Used to split a credential public key (a COSE_Key map) from any trailing
 * authenticator extension data without losing the boundary.
 */
export function decodeCBORFirst<T = unknown>(
  data: Uint8Array,
): {
  value: T;
  remainingBytes: Uint8Array;
} {
  try {
    const length = cborItemLength(data, 0);
    const value = cborDecoder.decode(data.subarray(0, length)) as T;
    return { value, remainingBytes: data.subarray(length) };
  } catch (error) {
    if (error instanceof VerificationError) {
      throw error;
    }
    throw new VerificationError('Failed to decode first CBOR object', 'CBOR_DECODE_FIRST_ERROR');
  }
}
