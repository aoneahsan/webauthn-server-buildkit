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
  AttestationObject,
  AuthenticatorDataFlags,
  ParsedAuthenticatorData,
  COSEAlgorithmIdentifier,
  COSEEllipticCurve,
  COSEKeyType,
  InternalConfig,
  ParsedClientDataJSON,
} from './types';

// Utility functions
export {
  generateChallenge,
  generateRandomId,
  COSEEC2Key,
  COSEKeyCommon,
  COSEOKPKey,
  COSEPublicKey,
  COSERSAKey,
  decodeCBOR,
  decodeCBORFirst,
  encodeCBOR,
  getCOSEAlgorithmIdentifier,
  parseAuthenticatorData,
  parseCOSEPublicKey,
  validateAuthenticatorDataFlags,
  verifySignature,
} from './crypto';

export {
  bufferToBase64URL,
  base64URLToBuffer,
  stringToBase64URL,
  base64URLToString,
  isBase64URL,
  bufferToHex,
  bufferToNumber,
  buffersEqual,
  concatBuffers,
  hexToBuffer,
  numberToBuffer,
  sha256,
  sha384,
  sha512,
  verifyHash,
} from './utils';

// Version
export const VERSION = '1.0.0';
