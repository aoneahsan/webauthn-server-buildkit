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
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrpentity
 */
export interface PublicKeyCredentialRpEntity {
  /**
   * A unique identifier for the Relying Party entity
   * @see https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialrpentity-id
   */
  id: string;
  /**
   * A human-palatable name for the Relying Party
   * @see https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialentity-name
   */
  name: string;
  /**
   * A URL which resolves to an image associated with the entity
   * @deprecated This field is deprecated in WebAuthn Level 3
   * @see https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialentity-icon
   */
  icon?: string;
}

/**
 * User entity
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialuserentity
 */
export interface PublicKeyCredentialUserEntity {
  /**
   * The user handle of the user account entity
   * @see https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialuserentity-id
   */
  id: Base64URLString;
  /**
   * A human-palatable name for the user account
   * @see https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialentity-name
   */
  name: string;
  /**
   * A human-palatable name for the user account, intended for display
   * @see https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialuserentity-displayname
   */
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
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-authenticatorselectioncriteria
 */
export interface AuthenticatorSelectionCriteria {
  /**
   * Authenticator attachment modality
   * @see https://www.w3.org/TR/webauthn-3/#dom-authenticatorselectioncriteria-authenticatorattachment
   */
  authenticatorAttachment?: AuthenticatorAttachment;
  /**
   * Specifies the extent to which the Relying Party desires to create a client-side discoverable credential
   * @see https://www.w3.org/TR/webauthn-3/#dom-authenticatorselectioncriteria-residentkey
   */
  residentKey?: ResidentKeyRequirement;
  /**
   * This member is retained for backwards compatibility with WebAuthn Level 1
   * @deprecated Use residentKey instead
   */
  requireResidentKey?: boolean;
  /**
   * Specifies the Relying Party's requirements regarding user verification
   * @see https://www.w3.org/TR/webauthn-3/#dom-authenticatorselectioncriteria-userverification
   */
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
