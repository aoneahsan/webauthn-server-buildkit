import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'node:crypto';
import { SessionData, SessionError } from '@/types';
import { bufferToBase64URL, base64URLToBuffer } from '@/utils/base64url';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

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
 * Derive encryption key from secret
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return createHmac('sha256', salt).update(secret).digest();
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

    // Derive key
    const key = deriveKey(secret, salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

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
