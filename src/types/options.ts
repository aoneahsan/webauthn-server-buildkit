import type {
  AttestationConveyancePreference,
  AuthenticatorAttachment,
  AuthenticatorTransportFuture,
  Base64URLString,
  COSEAlgorithmIdentifier,
  PublicKeyCredentialType,
  ResidentKeyRequirement,
  UserVerificationRequirement,
} from './base';

/**
 * Relying Party entity
 */
export interface PublicKeyCredentialRpEntity {
  id: string;
  name: string;
}

/**
 * User entity
 */
export interface PublicKeyCredentialUserEntity {
  id: Base64URLString;
  name: string;
  displayName: string;
}

/**
 * Credential parameters
 */
export interface PublicKeyCredentialParameters {
  type: PublicKeyCredentialType;
  alg: COSEAlgorithmIdentifier;
}

/**
 * Credential descriptor
 */
export interface PublicKeyCredentialDescriptor {
  type: PublicKeyCredentialType;
  id: Base64URLString;
  transports?: AuthenticatorTransportFuture[];
}

/**
 * Authenticator selection criteria
 */
export interface AuthenticatorSelectionCriteria {
  authenticatorAttachment?: AuthenticatorAttachment;
  residentKey?: ResidentKeyRequirement;
  requireResidentKey?: boolean;
  userVerification?: UserVerificationRequirement;
}

/**
 * Registration options
 */
export interface PublicKeyCredentialCreationOptionsJSON {
  rp: PublicKeyCredentialRpEntity;
  user: PublicKeyCredentialUserEntity;
  challenge: Base64URLString;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptor[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  extensions?: Record<string, unknown>;
}

/**
 * Authentication options
 */
export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: Base64URLString;
  timeout?: number;
  rpId?: string;
  allowCredentials?: PublicKeyCredentialDescriptor[];
  userVerification?: UserVerificationRequirement;
  extensions?: Record<string, unknown>;
}
