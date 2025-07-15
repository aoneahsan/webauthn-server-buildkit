/**
 * Base64URL encoded string
 */
export type Base64URLString = string;

/**
 * Supported signature algorithms
 */
export enum COSEAlgorithmIdentifier {
  ES256 = -7,
  ES384 = -35,
  ES512 = -36,
  RS256 = -257,
  RS384 = -258,
  RS512 = -259,
  PS256 = -37,
  PS384 = -38,
  PS512 = -39,
  EdDSA = -8,
}

/**
 * Supported key types
 */
export enum COSEKeyType {
  OKP = 1,
  EC2 = 2,
  RSA = 3,
}

/**
 * Supported elliptic curves
 */
export enum COSEEllipticCurve {
  P256 = 1,
  P384 = 2,
  P521 = 3,
  Ed25519 = 6,
  Ed448 = 7,
  secp256k1 = 8,
}

/**
 * Attestation conveyance preference
 */
export type AttestationConveyancePreference = 'none' | 'indirect' | 'direct' | 'enterprise';

/**
 * User verification requirement
 */
export type UserVerificationRequirement = 'required' | 'preferred' | 'discouraged';

/**
 * Authenticator attachment
 */
export type AuthenticatorAttachment = 'platform' | 'cross-platform';

/**
 * Resident key requirement
 */
export type ResidentKeyRequirement = 'discouraged' | 'preferred' | 'required';

/**
 * Authenticator transport
 */
export type AuthenticatorTransportFuture =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';

/**
 * Credential device type
 */
export type CredentialDeviceType = 'singleDevice' | 'multiDevice';

/**
 * Attestation statement format
 */
export type AttestationFormat =
  | 'fido-u2f'
  | 'packed'
  | 'android-safetynet'
  | 'android-key'
  | 'tpm'
  | 'apple'
  | 'none';

/**
 * Public key credential type
 */
export type PublicKeyCredentialType = 'public-key';

/**
 * Credential flags from authenticator data
 */
export interface AuthenticatorDataFlags {
  userPresent: boolean;
  userVerified: boolean;
  backupEligibility: boolean;
  backupState: boolean;
  attestedCredentialData: boolean;
  extensionData: boolean;
}

/**
 * Parsed authenticator data
 */
export interface ParsedAuthenticatorData {
  rpIdHash: Uint8Array;
  flags: AuthenticatorDataFlags;
  counter: number;
  aaguid?: Uint8Array;
  credentialId?: Uint8Array;
  credentialPublicKey?: Uint8Array;
  extensionsData?: Uint8Array;
}

/**
 * Client data type
 */
export type ClientDataType = 'webauthn.create' | 'webauthn.get';

/**
 * Parsed client data JSON
 */
export interface ParsedClientDataJSON {
  type: ClientDataType;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
  tokenBinding?: {
    status: string;
    id?: string;
  };
}
