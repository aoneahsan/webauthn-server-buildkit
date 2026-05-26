import { randomBytes, createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
import { SessionData, SessionError } from '@/types';
import { bufferToBase64URL, base64URLToBuffer } from '@/utils/base64url';

const ALGORITHM = 'aes-256-gcm';
// AES-256-GCM uses a 96-bit (12-byte) IV — the value recommended by NIST SP 800-38D.
const IV_LENGTH = 12;
// AES-GCM authentication tag is 128-bit (16 bytes).
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const HKDF_INFO = 'webauthn-server-buildkit/session-token';

/**
 * Encrypted token structure
 */
interface EncryptedToken {
  iv: string;
  data: string;
  tag: string;
  salt: string;
}

/**
 * Derive a 256-bit encryption key from the configured secret using HKDF-SHA256.
 *
 * HKDF (RFC 5869) is a proper key-derivation function (extract + expand) and is
 * the correct primitive here, replacing the previous bare HMAC. Each token uses
 * a fresh random salt, so derived keys are unique per token.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), salt, Buffer.from(HKDF_INFO), KEY_LENGTH),
  );
}

/**
 * Create a session token
 */
export function createSessionToken(sessionId: string, data: SessionData, secret: string): string {
  try {
    // Generate salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key
    const key = deriveKey(secret, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const jsonData = JSON.stringify({
      sessionId,
      data,
      createdAt: new Date().toISOString(),
    });

    const encrypted = Buffer.concat([cipher.update(jsonData, 'utf8'), cipher.final()]);

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Build token
    const token: EncryptedToken = {
      iv: bufferToBase64URL(iv),
      data: bufferToBase64URL(encrypted),
      tag: bufferToBase64URL(tag),
      salt: bufferToBase64URL(salt),
    };

    // Encode as base64url
    return bufferToBase64URL(Buffer.from(JSON.stringify(token)));
  } catch {
    throw new SessionError('Failed to create session token', 'TOKEN_CREATION_FAILED');
  }
}

/**
 * Parse a session token
 */
export function parseSessionToken(
  token: string,
  secret: string,
): {
  sessionId: string;
  data: SessionData;
  createdAt: Date;
} {
  try {
    // Decode token
    const tokenData = JSON.parse(
      Buffer.from(base64URLToBuffer(token)).toString('utf8'),
    ) as EncryptedToken;

    // Extract components
    const salt = base64URLToBuffer(tokenData.salt);
    const iv = base64URLToBuffer(tokenData.iv);
    const encrypted = base64URLToBuffer(tokenData.data);
    const tag = base64URLToBuffer(tokenData.tag);

    // Validate field shapes before handing them to the cipher primitives so a
    // malformed token (e.g. a zero-length IV or oversized tag) is rejected
    // up-front rather than producing a confusing low-level crypto error.
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || salt.length !== SALT_LENGTH) {
      throw new SessionError('Invalid session token', 'INVALID_TOKEN');
    }

    // Derive key
    const key = deriveKey(secret, Buffer.from(salt));

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(tag));

    // Decrypt data
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]);

    // Parse JSON
    const parsed = JSON.parse(decrypted.toString('utf8')) as {
      sessionId: string;
      data: SessionData;
      createdAt: string;
    };

    return {
      sessionId: parsed.sessionId,
      data: parsed.data,
      createdAt: new Date(parsed.createdAt),
    };
  } catch {
    throw new SessionError('Invalid or expired session token', 'INVALID_TOKEN');
  }
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  return bufferToBase64URL(randomBytes(32));
}
