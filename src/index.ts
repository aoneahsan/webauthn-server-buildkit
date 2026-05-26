/**
 * WebAuthn Server Buildkit
 *
 * A framework-independent WebAuthn server library for Node.js/TypeScript.
 * Provides type-safe, secure-by-default biometric authentication with:
 *
 * - **Registration & Authentication**: Standard WebAuthn ceremony verification
 *   (challenge, origin, RP-ID hash, flags, signature counter, signature) with
 *   ES256/384/512, RS/PS256-512 and Ed25519, and pinned algorithms.
 * - **Attestation**: `none` accepted; `packed` self-attestation cryptographically
 *   verified. Certificate-chain formats (`packed` x5c, `fido-u2f`, `tpm`,
 *   `android-key`, `android-safetynet`, `apple`) are surfaced via `fmt` /
 *   `attestationVerified` but are **not yet trust-anchored** here — verify them
 *   out-of-band if you require attestation trust.
 * - **Session Management**: Encrypted session tokens (AES-256-GCM with
 *   HKDF-SHA256 key derivation), managed via `WebAuthnServer`.
 * - **Flexible Storage Adapters**: Memory adapter included; custom adapters
 *   supported. Challenges are enforced single-use and unexpired by default.
 * - **Crypto**: CBOR/COSE decoding and signature verification using Node's
 *   built-in `crypto`.
 * - **Optional mobile JSON path**: an opt-in (`enableMobileAttestation`,
 *   default off) non-standard JSON registration path that does NOT perform
 *   cryptographic WebAuthn attestation.
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

// Error classes and COSE enums — runtime VALUES (so consumers can `instanceof`
// errors and use enum members).
export {
  WebAuthnError,
  RegistrationError,
  AuthenticationError,
  VerificationError,
  ConfigurationError,
  StorageError,
  SessionError,
  COSEAlgorithmIdentifier,
  COSEEllipticCurve,
  COSEKeyType,
} from './types';

// Types (type-only)
export type {
  // Error codes
  WebAuthnErrorCode,

  // Configuration
  WebAuthnServerConfig,
  PreferredAuthenticatorType,
  InternalConfig,

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
  AuthenticatorDataFlags,
  ParsedAuthenticatorData,
  ParsedClientDataJSON,

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
  AttestationObject,
  RegistrationCredentialJSON,
  AuthenticationCredentialJSON,
  AuthenticatorAttestationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  AuthenticationExtensionsClientOutputs,
  VerifiedRegistrationInfo,
  VerifiedAuthenticationInfo,

  // Storage
  StorageAdapter,
} from './types';

// Crypto functions (runtime values)
export {
  generateChallenge,
  generateRandomId,
  decodeCBOR,
  decodeCBORFirst,
  encodeCBOR,
  getCOSEAlgorithmIdentifier,
  parseAuthenticatorData,
  parseCOSEPublicKey,
  validateAuthenticatorDataFlags,
  verifySignature,
} from './crypto';

// COSE key shapes (type-only)
export type { COSEEC2Key, COSEKeyCommon, COSEOKPKey, COSEPublicKey, COSERSAKey } from './crypto';

// Utility functions
export {
  bufferToBase64URL,
  base64URLToBuffer,
  stringToBase64URL,
  base64URLToString,
  isBase64URL,
  bufferToHex,
  bufferToNumber,
  buffersEqual,
  timingSafeEqualBytes,
  concatBuffers,
  hexToBuffer,
  numberToBuffer,
  sha256,
  sha384,
  sha512,
  verifyHash,
} from './utils';

// Support / funding info
export { SUPPORT_CONFIG } from './config/support';

// Registration and Authentication parameter types
export type { GenerateRegistrationOptionsParams } from './registration';
export type { GenerateAuthenticationOptionsParams } from './authentication';

// Version - injected at build time from package.json
declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';
