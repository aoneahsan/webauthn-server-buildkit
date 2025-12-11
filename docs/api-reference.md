# API Reference

## Table of Contents

- [WebAuthnServer Class](#webauthnserver-class)
  - [Constructor](#constructor)
  - [Registration Methods](#registration-methods)
  - [Authentication Methods](#authentication-methods)
  - [Session Methods](#session-methods)
- [Types](#types)
  - [Configuration Types](#configuration-types)
  - [Registration Types](#registration-types)
  - [Authentication Types](#authentication-types)
- [Storage Adapter Interface](#storage-adapter-interface)
- [Error Types](#error-types)

## WebAuthnServer Class

### Constructor

```typescript
new WebAuthnServer(config: WebAuthnServerConfig)
```

Creates a new instance of the WebAuthn server.

#### Parameters

- `config` - Server configuration object

#### Example

```typescript
const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  rpIcon: 'https://example.com/icon.png', // Optional, deprecated
  origin: 'https://example.com',
  encryptionSecret: 'your-32-character-or-longer-secret-key',
  storageAdapter: myStorageAdapter, // Optional
});
```

### Registration Methods

#### createRegistrationOptions

```typescript
async createRegistrationOptions(
  user: UserModel,
  params?: Partial<Omit<GenerateRegistrationOptionsParams, 'user'>>
): Promise<{
  options: PublicKeyCredentialCreationOptionsJSON;
  challenge: string;
}>
```

Generates registration options for creating a new credential.

##### Parameters

- `user` - User information
- `params` - Optional parameters to customize registration:
  - `excludeCredentials` - List of credentials to exclude
  - `authenticatorSelection` - Authenticator selection criteria
  - `preferredAuthenticatorType` - Preferred authenticator type
  - `extensions` - WebAuthn extensions to request
  - `timeout` - Custom timeout for this operation
  - `attestation` - Attestation preference
  - `rpIcon` - RP icon URL (deprecated)

##### Example

```typescript
const { options, challenge } = await webauthn.createRegistrationOptions(user, {
  excludeCredentials: existingCredentials,
  extensions: {
    credProps: true,
    largeBlob: { support: 'preferred' }
  },
  timeout: 120000, // 2 minutes
  attestation: 'direct'
});
```

#### verifyRegistration

```typescript
async verifyRegistration(
  response: RegistrationCredentialJSON,
  expectedChallenge: string,
  expectedOrigin?: string | string[]
): Promise<{
  verified: boolean;
  registrationInfo?: VerifiedRegistrationInfo;
}>
```

Verifies a registration response from the client.

##### Parameters

- `response` - Registration response from the client
- `expectedChallenge` - The challenge that was sent to the client
- `expectedOrigin` - Optional custom origin(s) to verify against

### Authentication Methods

#### createAuthenticationOptions

```typescript
async createAuthenticationOptions(
  params?: GenerateAuthenticationOptionsParams
): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  challenge: string;
}>
```

Generates authentication options for verifying an existing credential.

##### Parameters

- `params` - Optional parameters to customize authentication:
  - `allowCredentials` - List of allowed credentials
  - `userVerification` - User verification requirement
  - `rpId` - RP ID
  - `extensions` - WebAuthn extensions to request
  - `timeout` - Custom timeout for this operation

##### Example

```typescript
const { options, challenge } = await webauthn.createAuthenticationOptions({
  allowCredentials: userCredentials,
  extensions: {
    largeBlob: { read: true }
  },
  timeout: 60000,
  userVerification: 'required'
});
```

#### verifyAuthentication

```typescript
async verifyAuthentication(
  response: AuthenticationCredentialJSON,
  expectedChallenge: string,
  credential: WebAuthnCredential,
  expectedOrigin?: string | string[]
): Promise<{
  verified: boolean;
  authenticationInfo?: VerifiedAuthenticationInfo;
}>
```

Verifies an authentication response from the client.

### Session Methods

#### createSession

```typescript
async createSession(
  userId: string | number,
  credentialId: Base64URLString,
  userVerified: boolean,
  additionalData?: Record<string, unknown>
): Promise<string>
```

Creates a new session token after successful authentication.

#### validateSession

```typescript
async validateSession(token: string): Promise<{
  valid: boolean;
  sessionData?: SessionData;
  sessionId?: string;
}>
```

Validates a session token.

#### refreshSession

```typescript
async refreshSession(token: string): Promise<string>
```

Refreshes a session token, extending its expiration.

#### revokeSession

```typescript
async revokeSession(token: string): Promise<void>
```

Revokes a specific session.

#### revokeUserSessions

```typescript
async revokeUserSessions(userId: string | number): Promise<void>
```

Revokes all sessions for a specific user.

## Types

### Configuration Types

#### WebAuthnServerConfig

```typescript
interface WebAuthnServerConfig {
  rpName: string;                          // Relying Party name
  rpID: string;                            // Relying Party ID (domain)
  rpIcon?: string;                         // RP icon URL (deprecated)
  origin: string | string[];               // Expected origin(s)
  sessionDuration?: number;                // Session duration in ms (default: 24h)
  encryptionSecret: string;                // Secret for session encryption (min 32 chars)
  attestationType?: AttestationConveyancePreference; // Default: 'none'
  userVerification?: UserVerificationRequirement;    // Default: 'preferred'
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  supportedAlgorithms?: COSEAlgorithmIdentifier[];  // Default: ES256, RS256
  challengeSize?: number;                  // Challenge size in bytes (16-64)
  timeout?: number;                        // Operation timeout in ms
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  storageAdapter?: StorageAdapter;         // Storage adapter instance
  debug?: boolean;                         // Enable debug logging
  logger?: LoggerFunction;                 // Custom logger function
}
```

### Registration Types

#### GenerateRegistrationOptionsParams

```typescript
interface GenerateRegistrationOptionsParams {
  user: UserModel;
  excludeCredentials?: WebAuthnCredential[];
  authenticatorSelection?: Partial<AuthenticatorSelectionCriteria>;
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  extensions?: Record<string, unknown>;
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  rpIcon?: string;
}
```

#### PublicKeyCredentialCreationOptionsJSON

Complete WebAuthn registration options following W3C spec, including:
- RP information with optional icon
- User information
- Challenge
- Supported algorithms
- Authenticator selection criteria
- Extensions
- Timeout
- Attestation preference

### Authentication Types

#### GenerateAuthenticationOptionsParams

```typescript
interface GenerateAuthenticationOptionsParams {
  allowCredentials?: WebAuthnCredential[];
  userVerification?: UserVerificationRequirement;
  rpId?: string;
  extensions?: Record<string, unknown>;
  timeout?: number;
}
```

## Storage Adapter Interface

```typescript
interface StorageAdapter {
  users: {
    findById(id: string | number): Promise<UserModel | null>;
    findByUsername(username: string): Promise<UserModel | null>;
    create(user: UserModel): Promise<UserModel>;
    update(id: string | number, data: Partial<UserModel>): Promise<void>;
    delete(id: string | number): Promise<void>;
  };
  
  credentials: {
    findById(id: Base64URLString): Promise<WebAuthnCredential | null>;
    findByUserId(userId: string | number): Promise<WebAuthnCredential[]>;
    create(credential: WebAuthnCredential): Promise<void>;
    updateCounter(id: Base64URLString, counter: number): Promise<void>;
    updateLastUsed(id: Base64URLString): Promise<void>;
    delete(id: Base64URLString): Promise<void>;
  };
  
  challenges: {
    create(challenge: ChallengeData): Promise<void>;
    findByChallenge(challenge: string): Promise<ChallengeData | null>;
    delete(challenge: string): Promise<void>;
    deleteExpired(): Promise<void>;
  };
  
  sessions: {
    create(id: string, data: SessionData): Promise<void>;
    findById(id: string): Promise<SessionData | null>;
    update(id: string, data: Partial<SessionData>): Promise<void>;
    delete(id: string): Promise<void>;
    deleteByUserId(userId: string | number): Promise<void>;
    deleteExpired(): Promise<void>;
  };
}
```

## Mobile Attestation Functions

These functions handle attestation data from mobile platforms (iOS/Android) that may use a simplified format instead of standard WebAuthn attestation objects.

### isMobileAttestation

```typescript
function isMobileAttestation(
  response: RegistrationCredentialJSON
): boolean
```

Detects if a registration response is in mobile attestation format.

#### Parameters

- `response` - Registration response from the client

#### Returns

`true` if the response appears to be mobile attestation format (has `publicKey` and `signature` fields instead of standard attestation object).

#### Example

```typescript
import { isMobileAttestation } from 'webauthn-server-buildkit';

if (isMobileAttestation(response)) {
  // Use mobile attestation validation
  const result = await validateMobileAttestation(response, challenge, rpId);
} else {
  // Use standard WebAuthn verification
  const result = await webauthn.verifyRegistration(response, challenge);
}
```

### validateMobileAttestation

```typescript
async function validateMobileAttestation(
  response: RegistrationCredentialJSON,
  expectedChallenge: string,
  rpId: string,
  expectedOrigin?: string
): Promise<{
  verified: boolean;
  registrationInfo?: VerifiedRegistrationInfo;
}>
```

Validates a mobile attestation response.

#### Parameters

- `response` - Mobile attestation response
- `expectedChallenge` - The challenge that was sent to the client
- `rpId` - Relying party ID
- `expectedOrigin` - Optional custom origin (defaults to platform-specific origin based on detected platform)

#### Platform Detection

The function automatically detects the platform from the origin:
- iOS: Origins starting with `ios-app://`
- Android: Origins starting with `android-app://`

#### Example

```typescript
import { validateMobileAttestation } from 'webauthn-server-buildkit';

const result = await validateMobileAttestation(
  response,
  challenge,
  'example.com',
  'ios-app://com.example.app' // Optional: explicit origin
);

if (result.verified) {
  // Store credential
  const credential = {
    id: response.id,
    publicKey: result.registrationInfo.credentialPublicKey,
    counter: result.registrationInfo.counter,
    // ...
  };
}
```

### isCborParsingError

```typescript
function isCborParsingError(error: unknown): boolean
```

Detects if an error is related to CBOR parsing failures.

#### Parameters

- `error` - Any caught error

#### Returns

`true` if the error is related to CBOR decoding failures (useful for falling back to mobile attestation).

#### Example

```typescript
import { isCborParsingError, validateMobileAttestation } from 'webauthn-server-buildkit';

try {
  // Try standard verification first
  const result = await webauthn.verifyRegistration(response, challenge);
  return result;
} catch (error) {
  if (isCborParsingError(error)) {
    // Fall back to mobile attestation
    return await validateMobileAttestation(response, challenge, rpId);
  }
  throw error;
}
```

## Error Types

The package exports specific error types for different scenarios:

- `WebAuthnError` - Base error class
- `RegistrationError` - Registration-related errors
- `AuthenticationError` - Authentication-related errors
- `VerificationError` - Verification failures
- `ConfigurationError` - Configuration issues
- `StorageError` - Storage adapter errors
- `SessionError` - Session management errors

Each error includes a descriptive message and can be caught specifically:

```typescript
try {
  const result = await webauthn.verifyRegistration(response, challenge);
} catch (error) {
  if (error instanceof RegistrationError) {
    // Handle registration error
  } else if (error instanceof VerificationError) {
    // Handle verification error
  }
}
```

## Complete Example

```typescript
import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

// Initialize with all options
const webauthn = new WebAuthnServer({
  rpName: 'My Secure App',
  rpID: 'example.com',
  rpIcon: 'https://example.com/icon.png',
  origin: ['https://example.com', 'https://app.example.com'],
  sessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  encryptionSecret: process.env.ENCRYPTION_SECRET!,
  attestationType: 'indirect',
  userVerification: 'preferred',
  authenticatorSelection: {
    authenticatorAttachment: 'cross-platform',
    residentKey: 'preferred',
    userVerification: 'preferred'
  },
  supportedAlgorithms: [-7, -257], // ES256, RS256
  challengeSize: 32,
  timeout: 300000, // 5 minutes
  preferredAuthenticatorType: 'securityKey',
  storageAdapter: new MemoryStorageAdapter(),
  debug: true,
  logger: (level, message, data) => {
    console.log(`[${level}] ${message}`, data);
  }
});

// Use with full customization
const { options } = await webauthn.createRegistrationOptions(user, {
  extensions: {
    credProps: true,
    largeBlob: { support: 'preferred' },
    minPinLength: true
  },
  timeout: 120000,
  attestation: 'direct',
  authenticatorSelection: {
    authenticatorAttachment: 'platform',
    residentKey: 'required'
  }
});
```