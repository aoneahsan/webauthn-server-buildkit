import { describe, it, expect } from 'vitest';
import { decodeCBOR, decodeCBORFirst, encodeCBOR } from '@/crypto/cbor';
import { VerificationError } from '@/types';

describe('CBOR', () => {
  describe('decodeCBOR', () => {
    it('should decode simple CBOR data', () => {
      // Simple positive integer (1)
      const cborData = new Uint8Array([0x01]);
      const result = decodeCBOR<number>(cborData);
      expect(result).toBe(1);
    });

    it('should decode CBOR object', () => {
      // Object with one key-value pair: {1: 2}
      // CBOR decodes maps as JavaScript Map objects
      const cborData = new Uint8Array([0xa1, 0x01, 0x02]);
      const result = decodeCBOR<Map<number, number>>(cborData);
      expect(result).toBeInstanceOf(Map);
      expect(result.get(1)).toBe(2);
    });

    it('should decode CBOR array', () => {
      // Array with two elements: [1, 2]
      const cborData = new Uint8Array([0x82, 0x01, 0x02]);
      const result = decodeCBOR<number[]>(cborData);
      expect(result).toEqual([1, 2]);
    });

    it('should handle invalid CBOR data', () => {
      const invalidData = new Uint8Array([0xff, 0xff, 0xff]);
      expect(() => {
        decodeCBOR(invalidData);
      }).toThrow(VerificationError);
    });

    it('should handle empty data', () => {
      const emptyData = new Uint8Array([]);
      expect(() => {
        decodeCBOR(emptyData);
      }).toThrow(VerificationError);
    });
  });

  describe('encodeCBOR', () => {
    it('should encode simple values', () => {
      const result = encodeCBOR(1);
      expect(result).toEqual(new Uint8Array([0x01]));
    });

    it('should encode arrays', () => {
      const result = encodeCBOR([1, 2]);
      expect(result).toEqual(new Uint8Array([0x82, 0x01, 0x02]));
    });

    it('should encode objects as maps', () => {
      const result = encodeCBOR({ 1: 2 });
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null values', () => {
      const result = encodeCBOR(null);
      expect(result).toEqual(new Uint8Array([0xf6]));
    });

    it('should handle boolean values', () => {
      const trueResult = encodeCBOR(true);
      const falseResult = encodeCBOR(false);
      expect(trueResult).toEqual(new Uint8Array([0xf5]));
      expect(falseResult).toEqual(new Uint8Array([0xf4]));
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should handle round-trip for simple values', () => {
      const originalValue = 42;
      const encoded = encodeCBOR(originalValue);
      const decoded = decodeCBOR<number>(encoded);
      expect(decoded).toBe(originalValue);
    });

    it('should handle round-trip for arrays', () => {
      const originalArray = [1, 2, 3, 'hello'];
      const encoded = encodeCBOR(originalArray);
      const decoded = decodeCBOR<unknown[]>(encoded);
      expect(decoded).toEqual(originalArray);
    });

    it('should handle round-trip for objects', () => {
      // CBOR encodes objects as maps and decodes them as Map objects
      const originalObject = { name: 'test', value: 123 };
      const encoded = encodeCBOR(originalObject);
      const decoded = decodeCBOR<Map<string, unknown>>(encoded);
      // Verify the Map contains the same key-value pairs
      expect(decoded).toBeInstanceOf(Map);
      expect(decoded.get('name')).toBe('test');
      expect(decoded.get('value')).toBe(123);
    });
  });

  describe('decodeCBORFirst', () => {
    it('decodes the first item and returns the trailing bytes', () => {
      const first = encodeCBOR(new Map<number, unknown>([[1, 2]]));
      const trailing = encodeCBOR({ extension: 'value' });
      const buffer = new Uint8Array([...first, ...trailing]);

      const { value, remainingBytes } = decodeCBORFirst<Map<number, unknown>>(buffer);
      expect(value).toBeInstanceOf(Map);
      expect((value as Map<number, unknown>).get(1)).toBe(2);
      expect(Array.from(remainingBytes)).toEqual(Array.from(trailing));
    });

    it('returns empty remaining bytes when only one item is present', () => {
      const only = encodeCBOR({ a: 1, b: [2, 3] });
      const { remainingBytes } = decodeCBORFirst(only);
      expect(remainingBytes.length).toBe(0);
    });

    it('handles a byte-string item followed by trailing data', () => {
      const first = encodeCBOR(new Uint8Array([10, 20, 30, 40]));
      const trailing = new Uint8Array([0x01, 0x02]); // a couple of extra CBOR ints
      const buffer = new Uint8Array([...first, ...trailing]);

      const { remainingBytes } = decodeCBORFirst(buffer);
      expect(Array.from(remainingBytes)).toEqual([0x01, 0x02]);
    });

    it('throws VerificationError on truncated input', () => {
      // 0x82 = array of 2 items, but no items follow
      expect(() => decodeCBORFirst(new Uint8Array([0x82]))).toThrow(VerificationError);
    });
  });
});
