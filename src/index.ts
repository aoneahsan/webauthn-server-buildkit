/**
 * WebAuthn Server Buildkit
 *
 * A comprehensive WebAuthn server implementation for Node.js/TypeScript.
 * Provides secure, type-safe biometric authentication with:
 *
 * - **Registration and Authentication Flows**: Complete WebAuthn Level 3 support
 * - **Session Management**: Encrypted tokens using AES-256-GCM
 * - **Flexible Storage Adapters**: Memory adapter included, custom adapters supported
 * - **Mobile Attestation Support**: iOS and Android platform validation
 * - **Comprehensive Crypto**: CBOR/COSE encoding, signature verification
 *
 * @example
 * ```typescript
 * import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';
 *
 * const webauthn = new WebAuthnServer({
 *   rpName: 'My App',
 *   rpID: 'example.com',
 *   origin: 'https://example.com',
 *   encryptionSecret: 'your-32-char-secret-key-here',
 *   storageAdapter: new MemoryStorageAdapter(),
 * });
 *
 * // Registration
 * const { options, challenge } = await webauthn.createRegistrationOptions(user);
 * // ... send options to client, receive response ...
 * const result = await webauthn.verifyRegistration(response, challenge);
 *
 * // Authentication
 * const { options, challenge } = await webauthn.createAuthenticationOptions();
 * // ... send options to client, receive response ...
 * const result = await webauthn.verifyAuthentication(response, challenge, credential);
 * ```
 *
 * @packageDocumentation
 * @module webauthn-server-buildkit
 */

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

// Registration and Authentication parameter types
export type { GenerateRegistrationOptionsParams } from './registration';
export type { GenerateAuthenticationOptionsParams } from './authentication';

// Version - injected at build time from package.json
declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';
