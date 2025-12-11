# WebAuthn Server Buildkit

[![npm version](https://img.shields.io/npm/v/webauthn-server-buildkit.svg?style=flat-square)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![npm downloads](https://img.shields.io/npm/dm/webauthn-server-buildkit.svg?style=flat-square)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/webauthn-server-buildkit.svg?style=flat-square)](https://nodejs.org/)

## 📚 Documentation

- [**API Reference**](./docs/api-reference.md) - Detailed API documentation
- [**Storage Adapters**](./docs/examples/storage-adapters/README.md) - Database integration examples
- [**Troubleshooting Guide**](./docs/troubleshooting.md) - Common issues and solutions
- [**Migration Guide**](./docs/migration.md) - Upgrading between versions
- [**Changelog**](./CHANGELOG.md) - Release history
- [**WebAuthn Specification**](https://www.w3.org/TR/webauthn-3/) - W3C WebAuthn standard

A comprehensive WebAuthn server package for TypeScript that provides secure, type-safe, and framework-independent biometric authentication.

## Features

### 🔐 Security & Compliance
- **Full WebAuthn Level 3 Implementation** - Complete server-side implementation following the latest W3C standards
- **Secure by Default** - Built-in AES-256-GCM session encryption, cryptographically secure challenge generation
- **Algorithm Support** - ES256, RS256, EdDSA, and more COSE algorithms
- **Attestation Support** - Full attestation verification with multiple formats

### 🛠️ Developer Experience
- **Framework Independent** - Works with Express, Fastify, Koa, Next.js, or any Node.js framework
- **Full TypeScript Support** - 100% type-safe with comprehensive type definitions and strict mode
- **Simple API** - Intuitive methods with sensible defaults, get started in minutes
- **Extensive Configuration** - Every WebAuthn option is configurable with user values taking priority

### 📦 Integration & Storage
- **Storage Agnostic** - Pluggable adapter system for any database (MongoDB, PostgreSQL, Redis, etc.)
- **Session Management** - Built-in secure session handling with token-based authentication
- **Extension Support** - Full support for WebAuthn extensions
- **Modern Architecture** - ES2022 features, Node.js 20+ support, ESM and CommonJS builds

## Installation

```bash
npm install webauthn-server-buildkit
# or
yarn add webauthn-server-buildkit
```

## Quick Start

```typescript
import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

// Initialize the server
const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
  encryptionSecret: 'your-32-character-or-longer-secret-key-here',
});

// Registration flow
async function handleRegistration(user: UserModel) {
  // 1. Generate registration options
  const { options, challenge } = await webauthn.createRegistrationOptions(user);

  // 2. Send options to client
  // ... client performs WebAuthn registration ...

  // 3. Verify registration response
  const { verified, registrationInfo } = await webauthn.verifyRegistration(
    clientResponse,
    challenge,
  );

  if (verified && registrationInfo) {
    // Save credential to database
    await saveCredential({
      ...registrationInfo.credential,
      userId: user.id,
      webAuthnUserID: options.user.id,
    });
  }
}

// Authentication flow
async function handleAuthentication(credentials: WebAuthnCredential[]) {
  // 1. Generate authentication options
  const { options, challenge } = await webauthn.createAuthenticationOptions(credentials);

  // 2. Send options to client
  // ... client performs WebAuthn authentication ...

  // 3. Verify authentication response
  const credential = credentials.find((c) => c.id === clientResponse.id);
  const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
    clientResponse,
    challenge,
    credential,
  );

  if (verified && authenticationInfo) {
    // Create session
    const sessionToken = await webauthn.createSession(
      credential.userId,
      credential.id,
      authenticationInfo.userVerified,
    );

    return sessionToken;
  }
}
```

## Configuration

```typescript
const webauthn = new WebAuthnServer({
  // Required
  rpName: 'My App', // Relying Party name
  rpID: 'example.com', // Relying Party ID (domain)
  origin: 'https://example.com', // Expected origin(s)
  encryptionSecret: 'secret-key', // Min 32 chars for session encryption

  // Optional
  sessionDuration: 86400000, // Session duration in ms (default: 24h)
  attestationType: 'none', // Attestation preference
  userVerification: 'preferred', // User verification requirement
  authenticatorSelection: {
    // Authenticator selection criteria
    residentKey: 'preferred',
    userVerification: 'preferred',
    authenticatorAttachment: 'platform',
  },
  supportedAlgorithms: [-7, -257], // COSE algorithm identifiers
  challengeSize: 32, // Challenge size in bytes
  timeout: 60000, // Operation timeout in ms
  preferredAuthenticatorType: 'localDevice', // Preferred authenticator
  storageAdapter: customAdapter, // Custom storage adapter
  debug: true, // Enable debug logging
  logger: customLogger, // Custom logger function
});
```

## Storage Adapters

The package includes an in-memory storage adapter for development. For production, implement your own storage adapter:

```typescript
import { StorageAdapter } from 'webauthn-server-buildkit';

class MySQLStorageAdapter implements StorageAdapter {
  users = {
    async findById(id: string | number) {
      /* ... */
    },
    async findByUsername(username: string) {
      /* ... */
    },
    async create(user: Omit<UserModel, 'id'>) {
      /* ... */
    },
    async update(id: string | number, updates: Partial<UserModel>) {
      /* ... */
    },
    async delete(id: string | number) {
      /* ... */
    },
  };

  credentials = {
    async findById(id: Base64URLString) {
      /* ... */
    },
    async findByUserId(userId: string | number) {
      /* ... */
    },
    async findByWebAuthnUserId(webAuthnUserId: Base64URLString) {
      /* ... */
    },
    async create(credential: Omit<WebAuthnCredential, 'createdAt'>) {
      /* ... */
    },
    async updateCounter(id: Base64URLString, counter: number) {
      /* ... */
    },
    async updateLastUsed(id: Base64URLString) {
      /* ... */
    },
    async delete(id: Base64URLString) {
      /* ... */
    },
    async deleteByUserId(userId: string | number) {
      /* ... */
    },
  };

  challenges = {
    async create(challenge: ChallengeData) {
      /* ... */
    },
    async find(challenge: string) {
      /* ... */
    },
    async delete(challenge: string) {
      /* ... */
    },
    async deleteExpired() {
      /* ... */
    },
  };

  sessions = {
    async create(sessionId: string, data: SessionData) {
      /* ... */
    },
    async find(sessionId: string) {
      /* ... */
    },
    async update(sessionId: string, data: Partial<SessionData>) {
      /* ... */
    },
    async delete(sessionId: string) {
      /* ... */
    },
    async deleteExpired() {
      /* ... */
    },
    async deleteByUserId(userId: string | number) {
      /* ... */
    },
  };
}
```

## Session Management

Built-in secure session management with encrypted tokens:

```typescript
// Create session after authentication
const token = await webauthn.createSession(
  userId,
  credentialId,
  userVerified,
  { customData: 'value' }, // Optional additional data
);

// Validate session
const { valid, sessionData } = await webauthn.validateSession(token);

// Refresh session
const newToken = await webauthn.refreshSession(token);

// Revoke session
await webauthn.revokeSession(token);

// Revoke all user sessions
await webauthn.revokeUserSessions(userId);
```

## Express.js Example

```typescript
import express from 'express';
import { WebAuthnServer } from 'webauthn-server-buildkit';

const app = express();
const webauthn = new WebAuthnServer({
  rpName: 'My Express App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
  encryptionSecret: process.env.ENCRYPTION_SECRET,
});

app.use(express.json());

// Registration endpoint
app.post('/api/register/options', async (req, res) => {
  const user = req.user; // From your auth middleware
  // getUserCredentials should return an array of previously registered credentials for this user
  // This comes from your database where you stored credentials during registration
  // Each credential object should contain:
  // - id: The credential ID (credentialId from registrationInfo.credential)
  // - publicKey: The public key bytes (publicKey from registrationInfo.credential)
  // - counter: Usage counter for replay protection (counter from registrationInfo.credential)
  // - transports: Array of transport methods like ['usb', 'nfc', 'ble', 'internal']
  //   (transports from registrationInfo.credential or authenticator response)
  // You get all this data when you save the credential after successful registration
  const credentials = await getUserCredentials(user.id);
  const { options } = await webauthn.createRegistrationOptions(user, credentials);
  req.session.challenge = options.challenge;
  res.json(options);
});

app.post('/api/register/verify', async (req, res) => {
  const challenge = req.session.challenge;
  const { verified, registrationInfo } = await webauthn.verifyRegistration(req.body, challenge);

  if (verified && registrationInfo) {
    await saveCredential(registrationInfo.credential);
    res.json({ verified: true });
  } else {
    res.status(400).json({ verified: false });
  }
});

// Authentication endpoint
app.post('/api/authenticate/options', async (req, res) => {
  const credentials = await getCredentialsByUsername(req.body.username);
  const { options } = await webauthn.createAuthenticationOptions(credentials);
  req.session.challenge = options.challenge;
  res.json(options);
});

app.post('/api/authenticate/verify', async (req, res) => {
  const challenge = req.session.challenge;
  const credential = await getCredentialById(req.body.id);
  const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
    req.body,
    challenge,
    credential,
  );

  if (verified && authenticationInfo) {
    const token = await webauthn.createSession(
      credential.userId,
      credential.id,
      authenticationInfo.userVerified,
    );
    res.json({ verified: true, token });
  } else {
    res.status(401).json({ verified: false });
  }
});
```

## API Reference

### WebAuthnServer

#### Constructor

```typescript
new WebAuthnServer(config: WebAuthnServerConfig)
```

#### Methods

##### Registration

- `createRegistrationOptions(user, excludeCredentials?)`: Generate registration options
- `verifyRegistration(response, challenge, origin?)`: Verify registration response

##### Authentication

- `createAuthenticationOptions(allowCredentials?)`: Generate authentication options
- `verifyAuthentication(response, challenge, credential, origin?)`: Verify authentication response

##### Session Management

- `createSession(userId, credentialId, userVerified, additionalData?)`: Create session
- `validateSession(token)`: Validate session token
- `refreshSession(token)`: Refresh session token
- `revokeSession(token)`: Revoke session
- `revokeUserSessions(userId)`: Revoke all user sessions

##### Utilities

- `cleanup()`: Clean up expired data
- `getStorageAdapter()`: Get storage adapter instance

## Supported Algorithms

- ES256 (ECDSA with SHA-256) - Default
- RS256 (RSASSA-PKCS1-v1_5 with SHA-256) - Default
- ES384 (ECDSA with SHA-384)
- ES512 (ECDSA with SHA-512)
- RS384 (RSASSA-PKCS1-v1_5 with SHA-384)
- RS512 (RSASSA-PKCS1-v1_5 with SHA-512)
- PS256 (RSASSA-PSS with SHA-256)
- PS384 (RSASSA-PSS with SHA-384)
- PS512 (RSASSA-PSS with SHA-512)

Note: EdDSA (Ed25519) is defined but not yet implemented.

## Mobile Attestation Support

v2.0 adds full support for mobile platform attestation from iOS and Android apps. The package automatically handles the simplified attestation format used by mobile SDKs.

### Mobile Attestation Functions

```typescript
import {
  isMobileAttestation,
  validateMobileAttestation,
  isCborParsingError
} from 'webauthn-server-buildkit';

// Detect and handle mobile attestation
async function verifyRegistration(response, challenge) {
  if (isMobileAttestation(response)) {
    // Use mobile attestation validation
    return await validateMobileAttestation(response, challenge, 'example.com');
  }

  try {
    // Standard WebAuthn verification
    return await webauthn.verifyRegistration(response, challenge);
  } catch (error) {
    // Fall back to mobile attestation if CBOR parsing fails
    if (isCborParsingError(error)) {
      return await validateMobileAttestation(response, challenge, 'example.com');
    }
    throw error;
  }
}
```

### Mobile Origin Configuration

Configure origins for mobile apps:

```typescript
const webauthn = new WebAuthnServer({
  origin: [
    'https://example.com',           // Web
    'ios-app://com.example.app',     // iOS app bundle identifier
    'android-app://com.example.app', // Android app package name
  ],
  // ...
});
```

### Platform Detection

The library automatically detects the platform from the origin URL and validates accordingly:
- **iOS**: Origins starting with `ios-app://`
- **Android**: Origins starting with `android-app://`

## Security Considerations

1. **Encryption Secret**: Use a strong, unique secret of at least 32 characters
2. **HTTPS Required**: Always use HTTPS in production for WebAuthn
3. **Origin Validation**: The package validates origins to prevent phishing
4. **Counter Tracking**: Authenticator counters are tracked to detect cloned credentials
5. **Session Security**: Sessions are encrypted with AES-256-GCM
6. **Mobile Security**: Mobile attestation includes public key and signature validation

## Error Handling

The package exports typed error classes:

```typescript
import {
  WebAuthnError,
  RegistrationError,
  AuthenticationError,
  VerificationError,
  ConfigurationError,
  StorageError,
  SessionError,
} from 'webauthn-server-buildkit';

try {
  await webauthn.verifyRegistration(response, challenge);
} catch (error) {
  if (error instanceof RegistrationError) {
    console.error('Registration failed:', error.code, error.message);
  }
}
```

## Requirements

- Node.js 20.0.0 or higher
- TypeScript 5.0 or higher (for TypeScript projects)

## License

MIT

## 👨‍💻 Author

**Ahsan Mahmood**

- Website: [https://aoneahsan.com](https://aoneahsan.com)
- GitHub: [@aoneahsan](https://github.com/aoneahsan)
- Email: [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Package info

- GitHub: [https://github.com/aoneahsan/webauthn-server-buildkit](https://github.com/aoneahsan/webauthn-server-buildkit)
- npm: [https://www.npmjs.com/package/webauthn-server-buildkit](https://www.npmjs.com/package/webauthn-server-buildkit)
