import type {
  AttestationFormat,
  Base64URLString,
  COSEAlgorithmIdentifier,
  PublicKeyCredentialType,
  AuthenticatorTransportFuture,
} from './base';

/**
 * Authenticator attestation response
 */
export interface AuthenticatorAttestationResponseJSON {
  clientDataJSON: Base64URLString;
  attestationObject: Base64URLString;
  transports?: string[];
}

/**
 * Authenticator assertion response
 */
export interface AuthenticatorAssertionResponseJSON {
  clientDataJSON: Base64URLString;
  authenticatorData: Base64URLString;
  signature: Base64URLString;
  userHandle?: Base64URLString;
}

/**
 * Registration credential
 */
export interface RegistrationCredentialJSON {
  id: Base64URLString;
  rawId: Base64URLString;
  response: AuthenticatorAttestationResponseJSON;
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  type: PublicKeyCredentialType;
}

/**
 * Authentication credential
 */
export interface AuthenticationCredentialJSON {
  id: Base64URLString;
  rawId: Base64URLString;
  response: AuthenticatorAssertionResponseJSON;
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  type: PublicKeyCredentialType;
}

/**
 * Client extension outputs returned by the authenticator/client, mirroring the
 * WebAuthn `AuthenticationExtensionsClientOutputs` dictionary. Only the
 * extensions the client actually processed are present; everything is optional.
 */
export interface AuthenticationExtensionsClientOutputs {
  /** FIDO AppID extension result (legacy U2F app-id compatibility). */
  appid?: boolean;
  /**
   * Credential Properties extension. `rk` (resident key) is the only reliable
   * signal of whether a discoverable credential was actually created.
   */
  credProps?: {
    rk?: boolean;
  };
  /**
   * Pseudo-Random Function extension (the modern replacement for the legacy
   * `hmac-secret`). `results` values are base64url-encoded when present.
   */
  prf?: {
    enabled?: boolean;
    results?: {
      first?: string;
      second?: string;
    };
  };
  /**
   * Large Blob storage extension. `blob` is base64url-encoded when read back.
   */
  largeBlob?: {
    supported?: boolean;
    blob?: string;
    written?: boolean;
  };
  /**
   * @deprecated Legacy `hmac-secret` creation flag. Use {@link prf} instead;
   * retained only for backward compatibility with older clients.
   */
  hmacCreateSecret?: boolean;
}

/**
 * Attestation object
 */
export interface AttestationObject {
  fmt: AttestationFormat;
  attStmt: Record<string, unknown>;
  authData: Uint8Array;
}

/**
 * Verified registration info
 */
export interface VerifiedRegistrationInfo {
  credential: {
    id: Base64URLString;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
    /** COSE algorithm the credential registered with. Persist this on `WebAuthnCredential.alg` to pin the algorithm at authentication. */
    alg?: COSEAlgorithmIdentifier;
  };
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  origin: string;
  rpID?: string;
  aaguid?: string;
  userVerified: boolean;
  /** Attestation statement format from the attestation object (e.g. 'none', 'packed'). */
  fmt?: AttestationFormat;
  /**
   * Whether this library cryptographically verified the attestation statement.
   * `true` only for formats it verifies (currently `packed` self-attestation).
   * `false` for `none` and for certificate-chain formats whose trust anchors are
   * not validated here (`packed` with x5c, `fido-u2f`, `tpm`, `android-key`,
   * `android-safetynet`, `apple`) — verify those out-of-band if you require
   * attestation trust.
   */
  attestationVerified?: boolean;
  attestationObject?: Uint8Array;
  clientDataJSON?: Uint8Array;
  /**
   * The verified attestation certificate chain (leaf-first) as PEM strings.
   * Present only for certificate-chain attestation formats (`apple`, `packed`
   * x5c, `fido-u2f`, `android-key`, `tpm`, `android-safetynet`) that were
   * cryptographically verified AND trust-anchored to a supplied/bundled root.
   */
  trustPath?: string[];
  /**
   * Client extension outputs parsed from `response.clientExtensionResults`.
   * At minimum surfaces `credProps.rk` (whether a discoverable credential was
   * created). Present only when the client returned extension results.
   */
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
}

/**
 * Verified authentication info
 */
export interface VerifiedAuthenticationInfo {
  newCounter: number;
  origin: string;
  rpID?: string;
  userVerified: boolean;
  credentialID: Base64URLString;
  /** The `userHandle` returned by the authenticator (for discoverable credentials), if present. */
  userHandle?: Base64URLString;
  /**
   * Advisory: the authenticator's backup state (BS) flag differs from the
   * credential's stored `backedUp` value — a possible credential migration/clone
   * signal. The relying party decides policy.
   */
  backupStateChanged?: boolean;
  /**
   * Advisory: the credential registered with user verification but this
   * assertion presented UV=false. The relying party decides policy.
   */
  userVerificationDowngraded?: boolean;
  /**
   * `false` when both the stored and asserted signature counters are 0, meaning
   * counter-based clone detection is effectively a no-op for this authenticator
   * (common for platform passkeys).
   */
  counterSupported?: boolean;
  /**
   * Client extension outputs parsed from `response.clientExtensionResults`
   * (e.g. `appid`, `prf`, `largeBlob`). Present only when the client returned
   * extension results.
   */
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
}
