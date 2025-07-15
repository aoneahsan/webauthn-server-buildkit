import type {
  AttestationFormat,
  Base64URLString,
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
 * Client extension results
 */
export interface AuthenticationExtensionsClientOutputs {
  appid?: boolean;
  credProps?: {
    rk?: boolean;
  };
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
  };
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  origin: string;
  rpID?: string;
  aaguid?: string;
  userVerified: boolean;
  attestationObject?: Uint8Array;
  clientDataJSON?: Uint8Array;
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
}
