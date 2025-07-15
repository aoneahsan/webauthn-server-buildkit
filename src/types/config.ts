import type {
  AttestationConveyancePreference,
  COSEAlgorithmIdentifier,
  UserVerificationRequirement,
} from './base';
import type { AuthenticatorSelectionCriteria } from './options';
import type { StorageAdapter } from './storage';

/**
 * Preferred authenticator type for registration
 */
export type PreferredAuthenticatorType = 'securityKey' | 'localDevice' | 'remoteDevice';

/**
 * WebAuthn server configuration
 */
export interface WebAuthnServerConfig {
  /**
   * Relying Party name (human-readable)
   */
  rpName: string;

  /**
   * Relying Party ID (domain)
   */
  rpID: string;

  /**
   * Expected origin(s) for requests
   */
  origin: string | string[];

  /**
   * Session duration in milliseconds (default: 24 hours)
   */
  sessionDuration?: number;

  /**
   * Secret key for encrypting session tokens
   */
  encryptionSecret: string;

  /**
   * Attestation preference (default: 'none')
   */
  attestationType?: AttestationConveyancePreference;

  /**
   * User verification requirement (default: 'preferred')
   */
  userVerification?: UserVerificationRequirement;

  /**
   * Authenticator selection criteria
   */
  authenticatorSelection?: AuthenticatorSelectionCriteria;

  /**
   * Supported algorithm identifiers (default: ES256, RS256)
   */
  supportedAlgorithms?: COSEAlgorithmIdentifier[];

  /**
   * Challenge size in bytes (default: 32)
   */
  challengeSize?: number;

  /**
   * Timeout for operations in milliseconds (default: 60000)
   */
  timeout?: number;

  /**
   * Preferred authenticator type for registration
   */
  preferredAuthenticatorType?: PreferredAuthenticatorType;

  /**
   * Storage adapter for persisting data
   */
  storageAdapter?: StorageAdapter;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Custom logger function
   */
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

/**
 * Internal configuration with defaults applied
 */
export interface InternalConfig
  extends Required<
    Omit<WebAuthnServerConfig, 'storageAdapter' | 'preferredAuthenticatorType' | 'logger'>
  > {
  storageAdapter?: StorageAdapter;
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}
