import { describe, it, expect } from 'vitest';
import {
  bufferToBase64URL,
  base64URLToBuffer,
  stringToBase64URL,
  base64URLToString,
  isBase64URL,
} from '@/utils/base64url';

describe('Base64URL utilities', () => {
  describe('bufferToBase64URL', () => {
    it('should convert buffer to base64url string', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = bufferToBase64URL(buffer);
      expect(result).toBe('SGVsbG8');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should handle empty buffer', () => {
      const buffer = new Uint8Array([]);
      const result = bufferToBase64URL(buffer);
      expect(result).toBe('');
    });

    it('should handle ArrayBuffer input', () => {
      const arrayBuffer = new ArrayBuffer(5);
      const view = new Uint8Array(arrayBuffer);
      view.set([72, 101, 108, 108, 111]); // "Hello"
      const result = bufferToBase64URL(arrayBuffer);
      expect(result).toBe('SGVsbG8');
    });

    it('should handle binary data', () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
      const result = bufferToBase64URL(buffer);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('base64URLToBuffer', () => {
    it('should convert base64url string to buffer', () => {
      const base64url = 'SGVsbG8';
      const result = base64URLToBuffer(base64url);
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should handle empty string', () => {
      const result = base64URLToBuffer('');
      expect(result).toEqual(new Uint8Array([]));
    });

    it('should handle padding correctly', () => {
      // Test strings that would need padding in regular base64
      const testCases = [
        'SGVsbG8', // "Hello" - no padding needed
        'SGVsbA', // "Hell" - would need == padding
        'SGVs', // "Hel" - would need = padding
      ];

      testCases.forEach(testCase => {
        const result = base64URLToBuffer(testCase);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should handle base64url special characters', () => {
      // Test with - and _ characters specific to base64url
      const base64url = 'SGVsbG8-_';
      const result = base64URLToBuffer(base64url);
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe('stringToBase64URL', () => {
    it('should convert string to base64url', () => {
      const str = 'Hello, World!';
      const result = stringToBase64URL(str);
      expect(result).toBe('SGVsbG8sIFdvcmxkIQ');
    });

    it('should handle empty string', () => {
      const result = stringToBase64URL('');
      expect(result).toBe('');
    });

    it('should handle Unicode characters', () => {
      const str = 'Hello 世界! 🌍';
      const result = stringToBase64URL(str);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const str = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = stringToBase64URL(str);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('base64URLToString', () => {
    it('should convert base64url to string', () => {
      const base64url = 'SGVsbG8sIFdvcmxkIQ';
      const result = base64URLToString(base64url);
      expect(result).toBe('Hello, World!');
    });

    it('should handle empty string', () => {
      const result = base64URLToString('');
      expect(result).toBe('');
    });

    it('should handle Unicode characters', () => {
      const original = 'Hello 世界! 🌍';
      const encoded = stringToBase64URL(original);
      const decoded = base64URLToString(encoded);
      expect(decoded).toBe(original);
    });
  });

  describe('isBase64URL', () => {
    it('should validate correct base64url strings', () => {
      const validStrings = [
        'SGVsbG8',
        'SGVsbG8tX123',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        'abcdefghijklmnopqrstuvwxyz',
        '0123456789',
        'A-_z',
        '',
      ];

      validStrings.forEach(str => {
        expect(isBase64URL(str)).toBe(true);
      });
    });

    it('should reject invalid base64url strings', () => {
      const invalidStrings = [
        'SGVsbG8+', // contains +
        'SGVsbG8/', // contains /
        'SGVsbG8=', // contains =
        'SGVsbG8 ', // contains space
        'SGVsbG8\n', // contains newline
        'SGVsbG8!', // contains !
        'SGVsbG8@', // contains @
        'SGVsbG8#', // contains #
      ];

      invalidStrings.forEach(str => {
        expect(isBase64URL(str)).toBe(false);
      });
    });
  });

  describe('round-trip conversions', () => {
    it('should handle buffer round-trip', () => {
      const originalBuffer = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
      const base64url = bufferToBase64URL(originalBuffer);
      const decodedBuffer = base64URLToBuffer(base64url);
      expect(decodedBuffer).toEqual(originalBuffer);
    });

    it('should handle string round-trip', () => {
      const originalString = 'Hello, World! 🌍 Unicode test: 你好世界';
      const base64url = stringToBase64URL(originalString);
      const decodedString = base64URLToString(base64url);
      expect(decodedString).toBe(originalString);
    });

    it('should handle empty values round-trip', () => {
      const emptyBuffer = new Uint8Array([]);
      const emptyString = '';

      expect(base64URLToBuffer(bufferToBase64URL(emptyBuffer))).toEqual(emptyBuffer);
      expect(base64URLToString(stringToBase64URL(emptyString))).toBe(emptyString);
    });
  });
});