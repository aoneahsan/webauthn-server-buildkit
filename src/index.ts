// Main export
export { WebAuthnServer } from './server';

// Storage adapters
export { MemoryStorageAdapter } from './adapters';

// Types
export type {
  // Configuration
  WebAuthnServerConfig,
  PreferredAuthenticatorType,

  // Base types
  Base64URLString,
  AttestationConveyancePreference,
  UserVerificationRequirement,
  AuthenticatorAttachment,
  ResidentKeyRequirement,
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  AttestationFormat,
  PublicKeyCredentialType,
  ClientDataType,

  // Models
  UserModel,
  WebAuthnCredential,
  SessionData,
  ChallengeData,

  // Options
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  PublicKeyCredentialRpEntity,
  PublicKeyCredentialUserEntity,
  PublicKeyCredentialParameters,
  PublicKeyCredentialDescriptor,
  AuthenticatorSelectionCriteria,

  // Responses
  RegistrationCredentialJSON,
  AuthenticationCredentialJSON,
  AuthenticatorAttestationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  AuthenticationExtensionsClientOutputs,
  VerifiedRegistrationInfo,
  VerifiedAuthenticationInfo,

  // Storage
  StorageAdapter,

  // Errors
  WebAuthnError,
  RegistrationError,
  AuthenticationError,
  VerificationError,
  ConfigurationError,
  StorageError,
  SessionError,
} from './types';

// Enums
export { COSEAlgorithmIdentifier, COSEKeyType, COSEEllipticCurve } from './types';

// Utility functions
export { generateChallenge, generateRandomId } from './crypto';

export {
  bufferToBase64URL,
  base64URLToBuffer,
  stringToBase64URL,
  base64URLToString,
  isBase64URL,
} from './utils';

// Version
export const VERSION = '1.0.0';
