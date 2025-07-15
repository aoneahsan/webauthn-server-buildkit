import type { Base64URLString } from '@/types';

/**
 * Convert a buffer to base64url string
 */
export function bufferToBase64URL(buffer: Uint8Array | ArrayBuffer): Base64URLString {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert a base64url string to buffer
 */
export function base64URLToBuffer(base64url: Base64URLString): Uint8Array {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');

  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Convert a string to base64url
 */
export function stringToBase64URL(str: string): Base64URLString {
  return bufferToBase64URL(Buffer.from(str, 'utf8'));
}

/**
 * Convert a base64url string to string
 */
export function base64URLToString(base64url: Base64URLString): string {
  return Buffer.from(base64URLToBuffer(base64url)).toString('utf8');
}

/**
 * Check if a string is valid base64url
 */
export function isBase64URL(str: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(str);
}
