import { describe, it, expect } from 'vitest';
import {
  bufferToNumber,
  numberToBuffer,
  buffersEqual,
  concatBuffers,
  timingSafeEqualBytes,
} from '@/utils/buffer';

describe('buffer utils', () => {
  describe('bufferToNumber — big-endian, unsigned, no 32-bit overflow', () => {
    it.each([
      [[0x00, 0x00, 0x00, 0x00], 0],
      [[0x00, 0x00, 0x00, 0x01], 1],
      [[0x00, 0x00, 0x01, 0x00], 256],
      // 2^24 — the threshold where the previous `<<` implementation began to corrupt.
      [[0x01, 0x00, 0x00, 0x00], 16777216],
      // 2^31 — would become negative under signed 32-bit shifts.
      [[0x80, 0x00, 0x00, 0x00], 2147483648],
      // 2^32 - 1 — max unsigned 32-bit counter.
      [[0xff, 0xff, 0xff, 0xff], 4294967295],
    ] as Array<[number[], number]>)('parses %j as %d', (bytes, expected) => {
      expect(bufferToNumber(new Uint8Array(bytes))).toBe(expected);
    });
  });

  describe('numberToBuffer — round-trips large values', () => {
    it.each([0, 1, 256, 16777216, 2147483648, 4294967295])(
      'round-trips %d through 4 big-endian bytes',
      (value) => {
        const encoded = numberToBuffer(value, 4);
        expect(encoded.length).toBe(4);
        expect(bufferToNumber(encoded)).toBe(value);
      },
    );
  });

  describe('buffersEqual', () => {
    it('returns true for identical buffers and false otherwise', () => {
      expect(buffersEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
      expect(buffersEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
      expect(buffersEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    });
  });

  describe('concatBuffers', () => {
    it('concatenates in order', () => {
      const result = concatBuffers(
        new Uint8Array([1, 2]),
        new Uint8Array([3]),
        new Uint8Array([4, 5]),
      );
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('timingSafeEqualBytes', () => {
    it('returns true for identical buffers, false for differing or unequal-length', () => {
      expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
      expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(
        false,
      );
      // Unequal length must return false without throwing (timingSafeEqual would throw).
      expect(timingSafeEqualBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    });
  });

  describe('buffersEqual vs timingSafeEqualBytes (API-N4)', () => {
    // buffersEqual is variable-time (non-security); timingSafeEqualBytes is the
    // constant-time primitive for secret comparisons. They must agree on the
    // equality result for every case below.
    it.each([
      [[1, 2, 3], [1, 2, 3], true],
      [[1, 2, 3], [1, 2, 4], false],
      [[1, 2], [1, 2, 3], false],
      [[], [], true],
      [[0xff], [0xff], true],
    ] as Array<[number[], number[], boolean]>)('both report %j == %j as %s', (a, b, expected) => {
      const av = new Uint8Array(a);
      const bv = new Uint8Array(b);
      expect(buffersEqual(av, bv)).toBe(expected);
      expect(timingSafeEqualBytes(av, bv)).toBe(expected);
    });
  });
});
