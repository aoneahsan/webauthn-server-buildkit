# WebAuthn Server Buildkit - Implementation Details

## Core Implementation

### WebAuthn Server Class

The main `WebAuthnServer` class serves as the primary interface for all WebAuthn operations:

```typescript
class WebAuthnServer {
  constructor(config: WebAuthnServerConfig)
  
  // Registration methods
  createRegistrationOptions(user: UserModel, excludeCredentials?: WebAuthnCredential[]): Promise<RegistrationOptionsResult>
  verifyRegistration(response: RegistrationResponseJSON, challenge: string, origin?: string): Promise<VerificationResult>
  
  // Authentication methods
  createAuthenticationOptions(allowCredentials?: WebAuthnCredential[]): Promise<AuthenticationOptionsResult>
  verifyAuthentication(response: AuthenticationResponseJSON, challenge: string, credential: WebAuthnCredential, origin?: string): Promise<VerificationResult>
  
  // Session management
  createSession(userId: string | number, credentialId: string, userVerified: boolean, additionalData?: Record<string, unknown>): Promise<string>
  validateSession(token: string): Promise<SessionValidationResult>
  refreshSession(token: string): Promise<string>
  revokeSession(token: string): Promise<boolean>
  revokeUserSessions(userId: string | number): Promise<boolean>
  
  // Utility methods
  cleanup(): Promise<void>
  getStorageAdapter(): StorageAdapter
}
```

### Registration Flow Implementation

#### 1. Options Generation (`registration/generate-options.ts`)
```typescript
export async function generateRegistrationOptions(
  user: UserModel,
  config: WebAuthnServerConfig,
  excludeCredentials?: WebAuthnCredential[]
): Promise<RegistrationOptionsResult>
```

**Key Features:**
- Generates secure random challenge (32 bytes default)
- Creates user object with base64url encoded ID
- Handles exclude credentials for preventing re-registration
- Supports all major authenticator selection criteria
- Returns standardized PublicKeyCredentialCreationOptions

#### 2. Response Verification (`registration/verify-response.ts`)
```typescript
export async function verifyRegistrationResponse(
  response: RegistrationResponseJSON,
  challenge: string,
  config: WebAuthnServerConfig,
  origin?: string
): Promise<VerificationResult>
```

**Verification Steps:**
1. Parse and validate attestation object
2. Verify challenge matches stored challenge
3. Validate origin against configured origins
4. Parse CBOR attestation data
5. Verify signature using COSE public key
6. Extract credential information

### Authentication Flow Implementation

#### 1. Options Generation (`authentication/generate-options.ts`)
```typescript
export async function generateAuthenticationOptions(
  allowCredentials?: WebAuthnCredential[],
  config: WebAuthnServerConfig
): Promise<AuthenticationOptionsResult>
```

**Key Features:**
- Generates secure random challenge
- Configures user verification requirements
- Handles allow credentials list
- Supports timeout configuration

#### 2. Response Verification (`authentication/verify-response.ts`)
```typescript
export async function verifyAuthenticationResponse(
  response: AuthenticationResponseJSON,
  challenge: string,
  credential: WebAuthnCredential,
  config: WebAuthnServerConfig,
  origin?: string
): Promise<VerificationResult>
```

**Verification Steps:**
1. Parse authenticator data
2. Verify challenge matches
3. Validate origin
4. Check counter progression
5. Verify signature using stored public key
6. Update credential counter

### Cryptographic Implementation

#### COSE Key Handling (`crypto/cose.ts`)
```typescript
export interface COSEPublicKey {
  kty: COSEKeyType;
  alg?: COSEAlgorithmIdentifier;
  // ... other properties
}

export function parseCOSEPublicKey(publicKeyBytes: Uint8Array): COSEPublicKey
export function getCOSEAlgorithmIdentifier(publicKey: COSEPublicKey): COSEAlgorithmIdentifier
```

**Supported Key Types:**
- **EC2**: Elliptic Curve keys (P-256, P-384, P-521)
- **RSA**: RSA keys with PKCS#1 and PSS padding
- **OKP**: Octet Key Pairs (Ed25519)

#### Signature Verification (`crypto/verify.ts`)
```typescript
export function verifySignature(
  signature: Uint8Array,
  data: Uint8Array,
  publicKey: COSEPublicKey
): boolean
```

**Algorithm Support:**
- **ES256**: ECDSA with SHA-256 (P-256)
- **ES384**: ECDSA with SHA-384 (P-384)
- **ES512**: ECDSA with SHA-512 (P-521)
- **RS256**: RSASSA-PKCS1-v1_5 with SHA-256
- **RS384**: RSASSA-PKCS1-v1_5 with SHA-384
- **RS512**: RSASSA-PKCS1-v1_5 with SHA-512
- **PS256**: RSASSA-PSS with SHA-256
- **PS384**: RSASSA-PSS with SHA-384
- **PS512**: RSASSA-PSS with SHA-512
- **EdDSA**: Ed25519 signature verification

#### CBOR Implementation (`crypto/cbor.ts`)
```typescript
export function decodeCBOR<T>(data: Uint8Array): T
export function encodeCBOR(value: unknown): Uint8Array
```

**Features:**
- Full CBOR decoding/encoding support
- Handles all WebAuthn CBOR data structures
- Type-safe decoding with generic support
- Efficient buffer handling

### Session Management

#### Token Creation (`session/token.ts`)
```typescript
export function createSessionToken(
  sessionId: string,
  data: SessionData,
  secret: string
): string
```

**Security Features:**
- AES-256-GCM encryption
- Random salt generation (32 bytes)
- Random IV generation (16 bytes)
- HMAC-SHA256 key derivation
- Base64URL encoding

#### Token Validation (`session/token.ts`)
```typescript
export function parseSessionToken(
  token: string,
  secret: string
): {
  sessionId: string;
  data: SessionData;
  createdAt: Date;
}
```

**Validation Steps:**
1. Base64URL decode token
2. Parse encrypted token structure
3. Derive key from secret and salt
4. Decrypt data using AES-256-GCM
5. Verify authentication tag
6. Parse and return session data

### Storage Architecture

#### Storage Adapter Interface (`types/storage.ts`)
```typescript
export interface StorageAdapter {
  users: UserStorage;
  credentials: CredentialStorage;
  challenges: ChallengeStorage;
  sessions: SessionStorage;
}
```

#### Memory Storage Implementation (`adapters/memory.ts`)
- In-memory storage for development
- Thread-safe operations
- Automatic cleanup capabilities
- Full interface compliance

### Error Handling

#### Error Types (`types/errors.ts`)
```typescript
export class WebAuthnError extends Error
export class RegistrationError extends WebAuthnError
export class AuthenticationError extends WebAuthnError
export class VerificationError extends WebAuthnError
export class ConfigurationError extends WebAuthnError
export class StorageError extends WebAuthnError
export class SessionError extends WebAuthnError
```

**Error Handling Strategy:**
- Typed error classes for different error categories
- Structured error codes for programmatic handling
- Detailed error messages for debugging
- Graceful degradation for non-critical errors

### Security Considerations

#### Challenge Generation
- Cryptographically secure random number generation
- Configurable challenge size (16-64 bytes)
- Base64URL encoding for safe transmission
- Automatic expiration handling

#### Session Security
- AES-256-GCM encryption for session tokens
- Random salt and IV for each token
- Key derivation using HMAC-SHA256
- Configurable session duration

#### Origin Validation
- Strict origin checking for WebAuthn responses
- Support for multiple allowed origins
- Configurable origin validation rules

#### Counter Tracking
- Authenticator counter verification
- Clone detection through counter regression
- Automatic counter updates

### Performance Optimizations

#### Efficient Data Structures
- Uint8Array for binary data handling
- Map objects for fast key lookups
- Lazy initialization of expensive operations

#### Memory Management
- Automatic cleanup of expired data
- Efficient buffer pooling
- Minimal memory allocations

### Testing Strategy

#### Unit Tests
- Individual function testing
- Mock implementations for dependencies
- Edge case coverage
- Error condition testing

#### Integration Tests
- End-to-end WebAuthn flows
- Storage adapter compliance
- Cross-browser compatibility
- Performance benchmarking

---

**Implementation Notes:**
- All cryptographic operations use Node.js built-in crypto module
- Binary data handling uses Uint8Array for consistency
- Error handling follows fail-fast principles
- All async operations are properly handled
- Type safety is maintained throughout the codebase