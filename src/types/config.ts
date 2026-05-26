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
   * Relying Party icon URL
   * @deprecated This field is deprecated in WebAuthn Level 3
   */
  rpIcon?: string;

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
   * Enable the non-standard mobile JSON attestation path used by some native
   * (e.g. Capacitor) clients (default: `false`).
   *
   * ⚠️ Security: this path does **not** perform cryptographic WebAuthn
   * attestation — it trusts a client-supplied `{ publicKey, credentialId }`
   * payload without verifying a challenge signature. Leave it disabled unless
   * you fully control the client and transport, in which case you MUST enforce
   * freshness/authenticity by other means. When disabled, only the standard
   * WebAuthn (CBOR) verification path runs.
   */
  enableMobileAttestation?: boolean;

  /**
   * Enforce that the verification challenge exists in the configured storage
   * adapter — unexpired and scoped to the matching operation — and consume it
   * once (default: `true` when a `storageAdapter` is configured).
   *
   * When enabled, `verifyRegistration` / `verifyAuthentication` reject a
   * challenge that is absent from storage (`CHALLENGE_NOT_FOUND`), expired
   * (`CHALLENGE_EXPIRED`), or issued for a different operation
   * (`CHALLENGE_OPERATION_MISMATCH`), and delete it after the attempt so it can
   * never be replayed. Set to `false` to manage challenge lifecycle yourself
   * (the library then only compares the caller-supplied `expectedChallenge`).
   * Has no effect when no `storageAdapter` is configured.
   */
  enforceChallengeStore?: boolean;

  /**
   * Allow ceremonies performed in a cross-origin iframe (`clientData.crossOrigin
   * === true`). Default `false` — cross-origin ceremonies are rejected, per the
   * W3C recommendation, unless you explicitly opt in.
   */
  allowCrossOriginIframe?: boolean;

  /**
   * Optional custom origin matcher. When provided, it replaces the default
   * exact-string match against `origin` for verifying `clientData.origin` (useful
   * for advanced normalization or native `android:apk-key-hash:` origins).
   * Return `true` to accept the origin.
   */
  originVerifier?: (origin: string) => boolean;

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
export interface InternalConfig extends Required<
  Omit<
    WebAuthnServerConfig,
    'storageAdapter' | 'preferredAuthenticatorType' | 'logger' | 'rpIcon' | 'originVerifier'
  >
> {
  storageAdapter?: StorageAdapter;
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
  rpIcon?: string;
  originVerifier?: (origin: string) => boolean;
}
