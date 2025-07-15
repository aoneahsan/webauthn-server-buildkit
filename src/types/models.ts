import type { AuthenticatorTransportFuture, Base64URLString, CredentialDeviceType } from './base';

/**
 * User model interface
 */
export interface UserModel {
  id: string | number;
  username: string;
  displayName?: string;
}

/**
 * WebAuthn credential (Passkey)
 */
export interface WebAuthnCredential {
  id: Base64URLString;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  deviceType: CredentialDeviceType;
  backedUp: boolean;
  userId: string | number;
  webAuthnUserID: Base64URLString;
  createdAt: Date;
  lastUsedAt?: Date;
  aaguid?: string;
  userAgent?: string;
}

/**
 * Session data
 */
export interface SessionData {
  userId: string | number;
  credentialId: Base64URLString;
  expiresAt: Date;
  userVerified: boolean;
  [key: string]: unknown;
}

/**
 * Challenge data stored temporarily during registration/authentication
 */
export interface ChallengeData {
  challenge: string;
  userId?: string | number;
  operation: 'registration' | 'authentication';
  createdAt: Date;
  expiresAt: Date;
}
