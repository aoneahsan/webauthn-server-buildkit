# AI Integration Guide: Biometric Authentication System

> **For AI Development Agents**: This guide provides complete implementation instructions for integrating `webauthn-server-buildkit` (backend) with `capacitor-biometric-authentication` (frontend) for biometric authentication.

> **Backend version: `webauthn-server-buildkit` v2.3.2.** This release is
> secure-by-default: the challenge lifecycle is enforced from storage, the
> credential algorithm is pinned at authentication, cross-origin-iframe ceremonies
> are rejected, and full per-format attestation verification is available. Node
> `>=24.13.0` is required. See [What's new in 2.3.0](#whats-new-in-230-backend)
> for the API deltas an integrator must know.

## What's new in 2.3.0 (backend)

| Change                                                                                                                  | What an integrator must do                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRegistrationOptions` / `createAuthenticationOptions` take an **options object**, not positional credential lists | Pass `{ excludeCredentials }` / `{ allowCredentials }` (see examples below). The old positional `(user, excludeCredentials)` form is not the API.   |
| `createRegistrationOptions` returns `webAuthnUserId`                                                                    | Persist it as the credential's `webAuthnUserID` for usernameless login.                                                                             |
| Challenge lifecycle enforced from storage (`enforceChallengeStore`, default `true` with a storage adapter)              | If you use a `storageAdapter`, do not reuse a challenge across verifications; it is consumed once. Set `enforceChallengeStore: false` to opt out.   |
| Algorithm pinned at authentication                                                                                      | Persist `registrationInfo.credential.alg` onto the credential's `alg`.                                                                              |
| `userHandle` validated at authentication (`USER_HANDLE_MISMATCH`)                                                       | For usernameless flows, look credentials up by `response.userHandle`; the library re-checks it against `credential.webAuthnUserID`.                 |
| Cross-origin-iframe ceremonies rejected (`allowCrossOriginIframe`, default `false`)                                     | If your ceremonies legitimately run in a cross-origin iframe, set `allowCrossOriginIframe: true`.                                                   |
| Full attestation verification + `metadataService`                                                                       | To require trust-anchored attestation, set `attestationType !== 'none'` + supply a `metadataService` (Apple works via the bundled root). See below. |
| Exported `WebAuthnErrorCode` union; `WebAuthnError.statusCode`                                                          | Branch on `error.code`; use `error.statusCode` for the HTTP response status.                                                                        |

## Package Overview

| Package                              | Role                    | npm                                                                     |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------------------- |
| `webauthn-server-buildkit`           | Backend WebAuthn server | [npm](https://www.npmjs.com/package/webauthn-server-buildkit)           |
| `capacitor-biometric-authentication` | Frontend biometric UI   | [npm](https://www.npmjs.com/package/capacitor-biometric-authentication) |

## Quick Setup

### 1. Install Packages

**Backend (Node.js):**

```bash
yarn add webauthn-server-buildkit
```

**Frontend (Web/Mobile App):**

```bash
yarn add capacitor-biometric-authentication
```

### 2. Backend Setup (Express.js Example)

```typescript
import express from 'express';
import { WebAuthnServer } from 'webauthn-server-buildkit';

const app = express();
app.use(express.json());

// Initialize WebAuthn server
const webauthn = new WebAuthnServer({
  rpName: 'My App', // Your app name
  rpID: 'myapp.com', // Your domain (no protocol)
  origin: [
    'https://myapp.com', // Web origin
    'android-app://com.myapp.app', // Android (optional)
    'ios-app://com.myapp.app', // iOS (optional)
  ],
  encryptionSecret: process.env.ENCRYPTION_SECRET!, // Min 32 chars
});

// NOTE: If your native client sends a standard WebAuthn (CBOR) attestation, the
// config above is all you need. If it sends the non-standard mobile JSON
// attestation format, add `enableMobileAttestation: true` — but that path performs
// NO cryptographic attestation (it trusts the client payload), so only enable it
// on a fully trusted client/transport. It is disabled by default.

// In-memory storage for demo (use database in production)
const users = new Map();
const credentials = new Map();

// REGISTRATION FLOW
// Step 1: Generate registration options
app.post('/api/webauthn/register/options', async (req, res) => {
  const { userId, username, displayName } = req.body;

  const user = {
    id: userId,
    username,
    displayName: displayName || username,
  };

  // Get existing credentials for this user (to exclude)
  const existingCredentials = Array.from(credentials.values()).filter((c) => c.userId === userId);

  // v2.3.0: params is an options object; createRegistrationOptions also returns
  // the generated `webAuthnUserId` (the user handle) for usernameless login.
  const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user, {
    excludeCredentials: existingCredentials,
  });

  // Store challenge temporarily (use session/cache in production). When a
  // storageAdapter is configured, the library also stores + enforces this
  // challenge single-use automatically (enforceChallengeStore, default true).
  users.set(userId, { ...user, challenge, webAuthnUserId });

  res.json(options);
});

// Step 2: Verify registration response
app.post('/api/webauthn/register/verify', async (req, res) => {
  const { userId, response } = req.body;
  const user = users.get(userId);

  if (!user || !user.challenge) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  // v2.3.0: optionally enforce excludeCredentials server-side by passing the
  // user's existing credential IDs — verification throws
  // CREDENTIAL_ALREADY_REGISTERED if this authenticator is already registered.
  const existingIds = Array.from(credentials.values())
    .filter((c) => c.userId === userId)
    .map((c) => c.id);

  const { verified, registrationInfo } = await webauthn.verifyRegistration(
    response,
    user.challenge,
    undefined, // expectedOrigin (defaults to configured origin)
    { existingCredentialIds: existingIds },
  );

  if (verified && registrationInfo) {
    // Save credential to database. Persist `alg` (pins the algorithm at
    // authentication), `userVerified` (enables the UV-downgrade signal), and the
    // generated `webAuthnUserId` (so usernameless login can match userHandle).
    // Note: credentialDeviceType / credentialBackedUp live on the parent object,
    // not on `.credential` — map them to deviceType / backedUp.
    credentials.set(registrationInfo.credential.id, {
      id: registrationInfo.credential.id,
      publicKey: registrationInfo.credential.publicKey,
      counter: registrationInfo.credential.counter,
      transports: registrationInfo.credential.transports,
      alg: registrationInfo.credential.alg,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      userVerified: registrationInfo.userVerified,
      userId,
      webAuthnUserID: user.webAuthnUserId,
      createdAt: new Date(),
    });

    // Clear challenge
    delete user.challenge;

    res.json({ verified: true, credentialId: registrationInfo.credential.id });
  } else {
    res.status(400).json({ verified: false });
  }
});

// AUTHENTICATION FLOW
// Step 1: Generate authentication options
app.post('/api/webauthn/authenticate/options', async (req, res) => {
  const { userId } = req.body;

  // Get user's credentials from database
  const userCredentials = Array.from(credentials.values()).filter((c) => c.userId === userId);

  if (userCredentials.length === 0) {
    return res.status(400).json({ error: 'No credentials found' });
  }

  // v2.3.0: params is an options object. Omit `allowCredentials` entirely for a
  // usernameless (discoverable-credential) flow.
  const { options, challenge } = await webauthn.createAuthenticationOptions({
    allowCredentials: userCredentials,
  });

  // Store challenge
  const user = users.get(userId) || { id: userId };
  users.set(userId, { ...user, authChallenge: challenge });

  res.json(options);
});

// Step 2: Verify authentication response
app.post('/api/webauthn/authenticate/verify', async (req, res) => {
  const { userId, response } = req.body;
  const user = users.get(userId);

  if (!user || !user.authChallenge) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  // Find the credential used
  const credential = credentials.get(response.id);

  if (!credential) {
    return res.status(400).json({ error: 'Credential not found' });
  }

  const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
    response,
    user.authChallenge,
    credential,
  );

  if (verified && authenticationInfo) {
    // Update credential counter for replay protection
    credential.counter = authenticationInfo.newCounter;

    // Create session token
    const token = await webauthn.createSession(
      userId,
      credential.id,
      authenticationInfo.userVerified,
    );

    // Clear challenge
    delete user.authChallenge;

    res.json({ verified: true, token });
  } else {
    res.status(401).json({ verified: false });
  }
});

// SESSION VALIDATION
app.get('/api/session/validate', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  const { valid, sessionData } = await webauthn.validateSession(token);

  res.json({ valid, userId: sessionData?.userId });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### 3. Frontend Setup (React Example)

```typescript
import BiometricAuth from 'capacitor-biometric-authentication';

const API_BASE = 'https://myapp.com/api';

// Check if biometrics available
async function checkBiometricSupport() {
  const available = await BiometricAuth.isAvailable();
  return available;
}

// REGISTRATION
async function registerBiometric(userId: string, username: string) {
  // Step 1: Get options from server
  const optionsRes = await fetch(`${API_BASE}/webauthn/register/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, username }),
  });
  const options = await optionsRes.json();

  // Step 2: Create credential using BiometricAuth
  const result = await BiometricAuth.authenticate({
    reason: 'Register your biometric',
    saveCredentials: true,
  });

  if (!result.success) {
    throw new Error(result.error?.message || 'Registration failed');
  }

  // Step 3: Send response to server
  const verifyRes = await fetch(`${API_BASE}/webauthn/register/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      response: result.credential,
    }),
  });

  return await verifyRes.json();
}

// AUTHENTICATION
async function authenticateWithBiometric(userId: string) {
  // Step 1: Get options from server
  const optionsRes = await fetch(`${API_BASE}/webauthn/authenticate/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const options = await optionsRes.json();

  // Step 2: Authenticate using BiometricAuth
  const result = await BiometricAuth.authenticate({
    reason: 'Log in to your account',
  });

  if (!result.success) {
    throw new Error(result.error?.message || 'Authentication failed');
  }

  // Step 3: Verify with server
  const verifyRes = await fetch(`${API_BASE}/webauthn/authenticate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      response: result.credential,
    }),
  });

  return await verifyRes.json();
}

// React component example
function BiometricLogin({ userId }: { userId: string }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkBiometricSupport().then(setIsAvailable);
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await authenticateWithBiometric(userId);
      if (result.verified) {
        // Store token, redirect to app
        localStorage.setItem('token', result.token);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Auth failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAvailable) return <p>Biometric not available</p>;

  return (
    <button onClick={handleLogin} disabled={isLoading}>
      {isLoading ? 'Authenticating...' : 'Login with Biometric'}
    </button>
  );
}
```

## API Reference Summary

### Backend (webauthn-server-buildkit)

| Method                                                                                 | Description                                                                |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `new WebAuthnServer(config)`                                                           | Initialize server                                                          |
| `createRegistrationOptions(user, params?)`                                             | Generate registration challenge → `{ options, challenge, webAuthnUserId }` |
| `verifyRegistration(response, challenge, expectedOrigin?, { existingCredentialIds? })` | Verify registration (duplicate check via `existingCredentialIds`)          |
| `createAuthenticationOptions(params?)`                                                 | Generate auth challenge (omit `allowCredentials` for usernameless)         |
| `verifyAuthentication(response, challenge, credential, expectedOrigin?)`               | Verify authentication (pins `alg`, validates `userHandle`)                 |
| `createSession(userId, credentialId, userVerified, additionalData?)`                   | Create session token                                                       |
| `validateSession(token)`                                                               | Validate session token                                                     |
| `refreshSession(token)`                                                                | Refresh (extend) a session token                                           |
| `revokeSession(token)`                                                                 | Revoke session                                                             |
| `revokeUserSessions(userId)`                                                           | Revoke all sessions for a user                                             |
| `cleanup()`                                                                            | Delete expired challenges + sessions                                       |

> `params` for `createRegistrationOptions`: `{ excludeCredentials?,
authenticatorSelection?, preferredAuthenticatorType?, extensions?, timeout?,
attestation?, rpIcon? }`. `params` for `createAuthenticationOptions`:
> `{ allowCredentials?, userVerification?, rpId?, extensions?, timeout? }`.

### Frontend (capacitor-biometric-authentication)

| Method                                   | Description                   |
| ---------------------------------------- | ----------------------------- |
| `BiometricAuth.isAvailable()`            | Check biometric availability  |
| `BiometricAuth.authenticate(options)`    | Perform authentication        |
| `BiometricAuth.getSupportedBiometrics()` | Get available biometric types |
| `BiometricAuth.deleteCredentials()`      | Clear stored credentials      |
| `BiometricAuth.configure(config)`        | Configure plugin              |
| `BiometricAuth.logout()`                 | Clear session                 |

## Configuration Reference

### Backend Configuration

```typescript
const webauthn = new WebAuthnServer({
  // Required
  rpName: string,           // Relying Party name
  rpID: string,             // Domain (e.g., 'example.com')
  origin: string | string[],// Expected origin(s)
  encryptionSecret: string, // Min 32 chars for session encryption

  // Optional
  sessionDuration: number,  // Session duration in ms (default: 24h)
  attestationType: 'none' | 'direct' | 'indirect' | 'enterprise',
  enableMobileAttestation: boolean, // default false — opt-in to the non-standard mobile JSON path (no cryptographic attestation)
  userVerification: 'required' | 'preferred' | 'discouraged',
  authenticatorSelection: {
    residentKey: 'required' | 'preferred' | 'discouraged',
    userVerification: 'required' | 'preferred' | 'discouraged',
    authenticatorAttachment: 'platform' | 'cross-platform',
  },
  supportedAlgorithms: number[], // COSE algorithm IDs (default: [-7, -257])
  challengeSize: number,    // Challenge size in bytes (default: 32)
  timeout: number,          // Operation timeout in ms (default: 60000)
  debug: boolean,           // Enable debug logging

  // New in 2.3.0
  enforceChallengeStore: boolean,   // default true when a storageAdapter is set — single-use/expiry/operation enforcement
  allowCrossOriginIframe: boolean,  // default false — reject clientData.crossOrigin === true unless enabled
  originVerifier: (origin: string) => boolean, // custom origin matcher (e.g. android:apk-key-hash:)
  metadataService: MetadataService, // trust-anchor / FIDO MDS provider for cert-chain attestation
  requireTrustedAttestation: boolean, // default false — reject non-trust-anchored attestation when attestationType !== 'none'
});
```

> **Secure-by-default upgrade note (2.2.0 → 2.3.0):** `enforceChallengeStore`
> (`true` with a storage adapter) and `allowCrossOriginIframe` (`false`) change
> behavior. If a previous integration reused challenges or ran ceremonies in a
> cross-origin iframe, set those options explicitly. Also persist the new
> `WebAuthnCredential.alg` and `userVerified` fields so algorithm pinning and the
> UV-downgrade signal work.

### Frontend Configuration

```typescript
BiometricAuth.configure({
  sessionDuration: number, // Session duration in seconds
  debug: boolean, // Enable debug logging
});

BiometricAuth.authenticate({
  reason: string, // Message shown to user
  title: string, // Android dialog title
  subtitle: string, // Android dialog subtitle
  fallbackTitle: string, // Fallback button text
  cancelTitle: string, // Cancel button text
  maxAttempts: number, // Max failed attempts
  saveCredentials: boolean, // Store credentials
});
```

## Usernameless (discoverable-credential) login

v2.3.0 supports usernameless login safely. Two pieces make it work:

- **Registration** returns `webAuthnUserId` (the generated user handle). Persist it
  as the credential's `webAuthnUserID`.
- **Authentication** validates the authenticator-returned `userHandle` against the
  stored credential's `webAuthnUserID` and throws `USER_HANDLE_MISMATCH` on a
  mismatch.

```typescript
// 1) Registration — persist webAuthnUserId (shown in the backend example above).

// 2) Authentication — generate options WITHOUT allowCredentials so the platform
//    offers a discoverable credential:
const { options, challenge } = await webauthn.createAuthenticationOptions();
// store `challenge` server-side, send `options` to the client ...

// 3) On verify, look the credential up by the assertion's userHandle, then verify:
const userHandle = response.response.userHandle; // base64url
const matches = await db.credentials.findByWebAuthnUserId(userHandle);
const credential = matches.find((c) => c.id === response.id);
if (!credential) return res.status(400).json({ error: 'Credential not found' });

const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
  response,
  challenge,
  credential,
);
// authenticationInfo.userHandle is returned; the userHandle<->credential binding
// was already enforced during verification.
```

## Trust-anchored attestation (optional)

By default `attestationType: 'none'` and no attestation is required. To verify and
trust-anchor attestation statements, request attestation and supply a
`metadataService`. The package is offline-by-default: **you** supply the FIDO
Metadata Service roots; the package never fetches them. The Apple WebAuthn Root CA
is bundled, so Apple attestation trust-anchors without any `metadataService`.

```typescript
import {
  WebAuthnServer,
  StaticMetadataService,
  APPLE_WEBAUTHN_ROOT_CA_PEM,
} from 'webauthn-server-buildkit';

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'myapp.com',
  origin: 'https://myapp.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET!,
  attestationType: 'direct',
  metadataService: new StaticMetadataService({
    defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM], // Apple also works without this
    // rootsByAaguid: { '<aaguid>': [pem, ...] },     // from your FIDO MDS blob
    // rootsByCertKeyId: { '<b64url-key-id>': [pem] }, // for fido-u2f
  }),
  requireTrustedAttestation: true, // reject registrations that can't be anchored
});
```

After `verifyRegistration`, check `registrationInfo.attestationVerified` (true only
when cryptographically verified **and** trust-anchored) and read the verified chain
from `registrationInfo.trustPath` when present.

**Capability & honest limits:**

- `none` → never verified. `packed` self-attestation → verified without a chain.
- `packed` x5c, `fido-u2f`, `android-key`, `tpm` → verified, but
  `attestationVerified: true` **only** when their chain anchors to a root you
  supplied via `metadataService`; otherwise `false`.
- `apple` → trust-anchored via the bundled Apple root (no `metadataService`
  needed).
- `android-safetynet` → **deprecated by Google; prefer the Play Integrity API.**
  It needs an RP-supplied GlobalSign root (none bundled) to anchor.
- No certificate revocation (CRL/OCSP) is performed. TPM AIK SAN and android-key
  Keymaster authorization-list constraints are not additionally asserted beyond
  the documented checks.

See `docs/api-reference.md` → _Attestation Verification_ for the full matrix.

## Database Schema Example

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WebAuthn credentials table
CREATE TABLE webauthn_credentials (
  id VARCHAR(255) PRIMARY KEY,        -- credentialId (base64url)
  user_id VARCHAR(255) NOT NULL,
  webauthn_user_id VARCHAR(255) NOT NULL, -- webAuthnUserID (the generated user handle; index for usernameless lookup)
  public_key BYTEA NOT NULL,          -- publicKey bytes
  counter INTEGER DEFAULT 0,          -- signature counter
  alg INTEGER,                        -- COSE algorithm id (e.g. -7); pins the algorithm at auth (2.3.0)
  transports TEXT[],                  -- ['internal', 'usb', etc.]
  device_type VARCHAR(50),            -- 'singleDevice' or 'multiDevice'
  backed_up BOOLEAN DEFAULT FALSE,
  user_verified BOOLEAN DEFAULT FALSE,-- UV at registration; enables UV-downgrade signal (2.3.0)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_webauthn_credentials_user_handle ON webauthn_credentials (webauthn_user_id);

-- Sessions table
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  credential_id VARCHAR(255),
  user_verified BOOLEAN,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Platform Support

| Platform | Backend        | Frontend                    |
| -------- | -------------- | --------------------------- |
| Web      | ✅ Node.js 20+ | ✅ WebAuthn API             |
| iOS      | ✅             | ✅ Touch ID / Face ID       |
| Android  | ✅             | ✅ BiometricPrompt          |
| Electron | ✅             | ✅ Windows Hello / Touch ID |

## Security Checklist

- [ ] Use HTTPS in production (required for WebAuthn)
- [ ] Set strong `encryptionSecret` (min 32 chars, use env variable)
- [ ] Configure proper `rpID` matching your domain
- [ ] Store credentials securely in database
- [ ] Track and validate signature counters
- [ ] Implement session expiry and refresh
- [ ] Handle all error cases gracefully
- [ ] (2.3.0) Configure a `storageAdapter` and keep `enforceChallengeStore: true`
      so the challenge is one-time and expiry-bound
- [ ] (2.3.0) Persist `registrationInfo.credential.alg` so the algorithm is pinned
      at authentication
- [ ] (2.3.0) Persist `registrationInfo.userVerified` as the credential's
      `userVerified` so UV downgrades are reported
- [ ] (2.3.0) For usernameless flows, persist `webAuthnUserId` as the credential's
      `webAuthnUserID`
- [ ] (2.3.0) Pass `existingCredentialIds` to `verifyRegistration` to reject
      already-registered authenticators
- [ ] (2.3.0) Leave `allowCrossOriginIframe: false` unless cross-origin-iframe
      ceremonies are legitimate for your app
- [ ] (2.3.0) Supply a `metadataService` and set `requireTrustedAttestation: true`
      if your policy requires trust-anchored attestation

## Error Handling

```typescript
// Backend — v2.3.0 ships an exported WebAuthnErrorCode union and a documented
// HTTP statusCode on every error. Branch on `error.code`, not on the message.
import {
  WebAuthnError,
  RegistrationError,
  AuthenticationError,
  VerificationError,
  type WebAuthnErrorCode,
} from 'webauthn-server-buildkit';

try {
  await webauthn.verifyRegistration(response, challenge, undefined, {
    existingCredentialIds: existingIdsForUser,
  });
} catch (error) {
  if (error instanceof WebAuthnError) {
    switch (error.code as WebAuthnErrorCode) {
      case 'CHALLENGE_NOT_FOUND':
      case 'CHALLENGE_EXPIRED':
      case 'CHALLENGE_OPERATION_MISMATCH':
        // Stale or replayed challenge — ask the client to restart the ceremony
        break;
      case 'CREDENTIAL_ALREADY_REGISTERED':
        // The user already registered this authenticator
        break;
      case 'CROSS_ORIGIN_NOT_ALLOWED':
        // Ceremony ran in a cross-origin iframe (default policy rejects this)
        break;
      case 'ATTESTATION_NOT_TRUSTED':
        // requireTrustedAttestation enabled and the chain didn't anchor
        break;
      case 'ALGORITHM_MISMATCH':
      case 'USER_HANDLE_MISMATCH':
        // Authentication-only signals (here in case a generic handler catches them)
        break;
    }
    // 400 (Bad Request) / 401 (Unauthorized) / 500 (Internal Server Error)
    return res.status(error.statusCode).json({ error: error.code });
  }
  throw error;
}

// Frontend
import { BiometricErrorCode } from 'capacitor-biometric-authentication';

const result = await BiometricAuth.authenticate();
if (!result.success) {
  switch (result.error?.code) {
    case BiometricErrorCode.USER_CANCELLED:
      // User cancelled
      break;
    case BiometricErrorCode.LOCKOUT:
      // Too many attempts
      break;
  }
}
```

## Complete Working Example

See the `/examples` directory for complete working examples:

- `examples/express/` - Full Express.js server
- `examples/basic/` - Basic Node.js usage

## Links

- **Backend**: [GitHub](https://github.com/aoneahsan/webauthn-server-buildkit) | [npm](https://www.npmjs.com/package/webauthn-server-buildkit)
- **Frontend**: [GitHub](https://github.com/aoneahsan/capacitor-biometric-authentication) | [npm](https://www.npmjs.com/package/capacitor-biometric-authentication)
- **Author**: [Ahsan Mahmood](https://aoneahsan.com) | [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)
