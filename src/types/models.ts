import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  COSEAlgorithmIdentifier,
  CredentialDeviceType,
} from './base';

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
  /**
   * COSE algorithm the credential registered with (e.g. ES256 = -7). When set,
   * `verifyAuthenticationResponse` enforces that the asserted key uses the same
   * algorithm (`ALGORITHM_MISMATCH`). Populated from
   * `VerifiedRegistrationInfo.credential.alg`.
   */
  alg?: COSEAlgorithmIdentifier;
  /**
   * Whether user verification was performed at registration. When set,
   * `verifyAuthenticationResponse` reports `userVerificationDowngraded` if a
   * later assertion presents UV=false. Populated from
   * `VerifiedRegistrationInfo.userVerified`.
   */
  userVerified?: boolean;
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
