# WebAuthn Server Buildkit

[![npm version](https://img.shields.io/npm/v/webauthn-server-buildkit.svg?style=flat-square)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![npm downloads](https://img.shields.io/npm/dm/webauthn-server-buildkit.svg?style=flat-square)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/webauthn-server-buildkit.svg?style=flat-square)](https://nodejs.org/)

## 📚 Documentation

- [**🤖 AI Integration Guide**](./AI-INTEGRATION-GUIDE.md) - Complete integration with `capacitor-biometric-authentication` frontend
- [**API Reference**](./docs/api-reference.md) - Detailed API documentation
- [**Storage Adapters**](./docs/examples/storage-adapters/README.md) - Database integration examples
- [**Troubleshooting Guide**](./docs/troubleshooting.md) - Common issues and solutions
- [**Migration Guide**](./docs/migration.md) - Upgrading between versions
- [**Changelog**](./CHANGELOG.md) - Release history
- [**Portfolio Info File**](./WEBAUTHN-SERVER-BUILDKIT_portfolio-info_2026-06-08.md) - Resume, portfolio, SEO, and social-content source material
- [**WebAuthn Specification**](https://www.w3.org/TR/webauthn-3/) - W3C WebAuthn standard

A comprehensive WebAuthn server package for TypeScript that provides secure, type-safe, and framework-independent biometric authentication.

## Current State

- Package version: `2.3.0`
- Verified on: `2026-05-27`
- Build: the `build` script succeeds (ESM + CommonJS + type declarations)
- Toolchain: TypeScript 6, ESLint 10
- Runtime dependency: `cbor-x` only (no new dependencies in 2.3.0)
- Engine requirement: Node.js `>=24.13.0`

### Security posture (2.3.0)

- **Challenge single-use + expiry enforcement** — when a `storageAdapter` is configured, the verify path looks the challenge up in storage, rejects it if it is missing, expired, or scoped to the wrong operation, and consumes it once so it can never be replayed (`enforceChallengeStore`, default `true`).
- **Algorithm pinning at authentication** — the registered COSE algorithm is persisted on the credential and re-checked at every assertion (`ALGORITHM_MISMATCH`), and the `supportedAlgorithms` allowlist is enforced at both registration and authentication.
- **Cross-origin ceremonies rejected by default** — `clientData.crossOrigin === true` is rejected unless `allowCrossOriginIframe` is set.
- **Per-format attestation verification with trust anchoring** — see [Attestation](#attestation) for the honest capability matrix.
- **Encrypted session tokens** — AES-256-GCM with HKDF-SHA256 key derivation, a 12-byte GCM IV, and field-length validation before decryption.
- **Constant-time comparisons** — the RP-ID hash and other security-sensitive byte comparisons use timing-safe equality.

## Features

### 🔐 Security & Compliance

- **WebAuthn Level 3 Server** - Server-side registration and authentication ceremony verification following the W3C WebAuthn Level 3 standard (challenge, origin, RP-ID hash, flags, counter, and signature)
- **Secure by Default** - Built-in AES-256-GCM session encryption, cryptographically secure challenge generation
- **Algorithm Support** - ES256/384/512, RS256/384/512, PS256/384/512 and Ed25519 (EdDSA), all verified via Node's native crypto. The registered algorithm is pinned and re-checked at authentication
- **Per-Format Attestation** - `none`, `packed` (self + x5c), `fido-u2f`, `android-key`, `tpm`, `android-safetynet` and `apple` are all cryptographically verified. Certificate-chain formats report `attestationVerified: true` only when trust-anchored to a root you supply via a `MetadataService` (FIDO MDS); `apple` trust-anchors against the bundled Apple WebAuthn Root CA (see [Attestation](#attestation))
- **Challenge Lifecycle** - server-enforced single-use, expiry, and operation scoping when a storage adapter is configured (`enforceChallengeStore`, default on)

### 🛠️ Developer Experience

- **Framework Independent** - Works with Express, Fastify, Koa, Next.js, or any Node.js framework
- **Full TypeScript Support** - 100% type-safe with comprehensive type definitions and strict mode
- **Simple API** - Intuitive methods with sensible defaults, get started in minutes
- **Extensive Configuration** - Every WebAuthn option is configurable with user values taking priority

### 📦 Integration & Storage

- **Storage Agnostic** - Pluggable adapter system for any database (MongoDB, PostgreSQL, Redis, etc.)
- **Session Management** - Built-in secure session handling with token-based authentication
- **Extension Support** - Full support for WebAuthn extensions
- **Modern Architecture** - ES2022 features, Node.js `>=24.13.0` support, ESM and CommonJS builds

## Installation

```bash
yarn add webauthn-server-buildkit
```

## Package Manager Policy

- Use `yarn` for project-local installs and script execution.
- Use `pnpm` for global package installs.
- Use `npm` only to install or update `pnpm` globally.
- Keep `yarn.lock` and remove other lockfiles.

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
  // 1. Generate registration options.
  //    `webAuthnUserId` is the generated WebAuthn user handle — persist it on
  //    the credential to support usernameless (discoverable-credential) login.
  const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user);

  // 2. Send options to client
  // ... client performs WebAuthn registration ...

  // 3. Verify registration response
  const { verified, registrationInfo } = await webauthn.verifyRegistration(
    clientResponse,
    challenge,
  );

  if (verified && registrationInfo) {
    // Save credential to database. Persist `alg` and `userVerified` so the
    // server can pin the algorithm and detect UV/backup downgrades at auth.
    await saveCredential({
      id: registrationInfo.credential.id,
      publicKey: registrationInfo.credential.publicKey,
      counter: registrationInfo.credential.counter,
      transports: registrationInfo.credential.transports,
      alg: registrationInfo.credential.alg,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      userVerified: registrationInfo.userVerified,
      userId: user.id,
      webAuthnUserID: webAuthnUserId,
    });
  }
}

// Authentication flow
async function handleAuthentication(credentials: WebAuthnCredential[]) {
  // 1. Generate authentication options
  const { options, challenge } = await webauthn.createAuthenticationOptions({
    allowCredentials: credentials,
  });

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

## Verified Package Architecture

- `src/registration/` handles registration option generation and verification.
- `src/authentication/` handles authentication option generation and verification.
- `src/session/` handles encrypted session lifecycle operations.
- `src/crypto/` handles challenge generation, CBOR parsing, COSE operations, and verification helpers.
- `src/adapters/` contains the storage abstraction layer and memory adapter.

## Verification Commands

```bash
yarn build
yarn lint
yarn typecheck
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
  attestationType: 'none', // Attestation preference (default: 'none')
  userVerification: 'preferred', // User verification requirement
  authenticatorSelection: {
    // Authenticator selection criteria
    residentKey: 'preferred',
    userVerification: 'preferred',
    authenticatorAttachment: 'platform',
  },
  supportedAlgorithms: [-7, -257], // COSE algorithm identifiers (default: ES256, RS256)
  challengeSize: 32, // Challenge size in bytes (default: 32)
  timeout: 60000, // Operation timeout in ms (default: 60000)
  preferredAuthenticatorType: 'localDevice', // Preferred authenticator
  storageAdapter: customAdapter, // Custom storage adapter

  // Security (secure-by-default — only set these to change the defaults)
  enforceChallengeStore: true, // Require + consume the challenge from storage (default: true when a storageAdapter is set)
  allowCrossOriginIframe: false, // Reject clientData.crossOrigin === true unless true (default: false)
  originVerifier: (origin) => origin === 'https://example.com', // Custom origin matcher (supports android:apk-key-hash + normalization)
  metadataService: trustAnchorProvider, // RP-supplied FIDO MDS / trust-anchor provider (see Attestation)
  requireTrustedAttestation: false, // Throw ATTESTATION_NOT_TRUSTED when attestation is requested but not trust-anchored (default: false)
  enableMobileAttestation: false, // Opt-in to the non-standard mobile JSON path (default: false; see Attestation)

  debug: true, // Enable debug logging
  logger: customLogger, // Custom logger function
});
```

### New in 2.3.0

| Option                      | Default                                 | Purpose                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enforceChallengeStore`     | `true` (when a `storageAdapter` is set) | Look the verification challenge up in storage, reject it if absent / expired / scoped to the wrong operation, and consume it once so it can't be replayed. Set `false` to manage the challenge lifecycle yourself.       |
| `allowCrossOriginIframe`    | `false`                                 | When `false`, a ceremony performed in a cross-origin iframe (`clientData.crossOrigin === true`) is rejected with `CROSS_ORIGIN_NOT_ALLOWED`.                                                                             |
| `originVerifier`            | _(none — exact-string match)_           | A custom `(origin: string) => boolean` matcher that replaces the default exact match against `origin`. Use it for advanced normalization or native `android:apk-key-hash:` origins.                                      |
| `metadataService`           | _(none)_                                | An RP-supplied FIDO Metadata Service / trust-anchor provider. Synchronous and offline — the package never fetches MDS data. Required to trust-anchor certificate-chain attestation formats other than `apple`.           |
| `requireTrustedAttestation` | `false`                                 | When `true` and `attestationType !== 'none'`, registration is rejected with `ATTESTATION_NOT_TRUSTED` unless the statement is verified **and** trust-anchored. When `false`, a non-trust-anchored attestation is warned. |
| `enableMobileAttestation`   | `false`                                 | Opt-in to the non-standard mobile JSON path (no cryptographic attestation — see [Attestation](#attestation)).                                                                                                            |

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
  const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user, {
    excludeCredentials: credentials,
  });
  req.session.challenge = challenge;
  req.session.webAuthnUserId = webAuthnUserId; // persist to store on the credential
  res.json(options);
});

app.post('/api/register/verify', async (req, res) => {
  const challenge = req.session.challenge;
  // Enforce excludeCredentials: reject a credential the user already registered.
  const existingCredentialIds = (await getUserCredentials(req.user.id)).map((c) => c.id);
  const { verified, registrationInfo } = await webauthn.verifyRegistration(
    req.body,
    challenge,
    undefined,
    { existingCredentialIds },
  );

  if (verified && registrationInfo) {
    await saveCredential({
      id: registrationInfo.credential.id,
      publicKey: registrationInfo.credential.publicKey,
      counter: registrationInfo.credential.counter,
      transports: registrationInfo.credential.transports,
      alg: registrationInfo.credential.alg, // pin the algorithm at auth
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      userVerified: registrationInfo.userVerified,
      userId: req.user.id,
      webAuthnUserID: req.session.webAuthnUserId, // for usernameless login
    });
    res.json({ verified: true });
  } else {
    res.status(400).json({ verified: false });
  }
});

// Authentication endpoint
app.post('/api/authenticate/options', async (req, res) => {
  const credentials = await getCredentialsByUsername(req.body.username);
  const { options } = await webauthn.createAuthenticationOptions({
    allowCredentials: credentials,
  });
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

- `createRegistrationOptions(user, params?)`: Generate registration options (`params.excludeCredentials`, `params.authenticatorSelection`, `params.attestation`, …). Returns `{ options, challenge, webAuthnUserId }` — persist `webAuthnUserId` as `WebAuthnCredential.webAuthnUserID`.
- `verifyRegistration(response, challenge, origin?, options?)`: Verify registration response. Pass `options.existingCredentialIds` (the user's already-registered credential IDs) to enforce `excludeCredentials` — a duplicate fails with `CREDENTIAL_ALREADY_REGISTERED`.

##### Authentication

- `createAuthenticationOptions(params?)`: Generate authentication options (`params.allowCredentials`, `params.userVerification`, `params.rpId`, …)
- `verifyAuthentication(response, challenge, credential, origin?)`: Verify authentication response. Validates the assertion `userHandle` against `credential.webAuthnUserID` (`USER_HANDLE_MISMATCH`), enforces the `supportedAlgorithms` allowlist, and pins `credential.alg` (`ALGORITHM_MISMATCH`).

##### Result fields (new in 2.3.0)

`VerifiedRegistrationInfo` now also carries:

- `credential.alg` — the COSE algorithm the credential registered with. Persist it on `WebAuthnCredential.alg` to enable algorithm pinning at authentication.
- `trustPath?` — the verified attestation certificate chain (leaf-first PEMs), present only for trust-anchored certificate-chain formats.
- `clientExtensionResults?` — parsed client extension outputs; at minimum surfaces `credProps.rk` (whether a discoverable credential was actually created).

`VerifiedAuthenticationInfo` now also carries:

- `userHandle?` — the `userHandle` returned by the authenticator for discoverable credentials.
- `backupStateChanged?` — advisory: the authenticator's backup-state (BS) flag differs from the credential's stored `backedUp` value (a possible clone/migration signal).
- `userVerificationDowngraded?` — advisory: the credential registered with UV but this assertion presented UV=false.
- `counterSupported?` — `false` when both the stored and asserted signature counters are 0 (counter-based clone detection is a no-op for that authenticator, common for platform passkeys).
- `clientExtensionResults?` — parsed client extension outputs (`appid`, `prf`, `largeBlob`, `credProps`).

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
- EdDSA (Ed25519)

All algorithms are verified through Node's native crypto — COSE public keys are imported via JWK, so RSA (any modulus size) and P-521 (ES512) work correctly. Use `supportedAlgorithms` to restrict which algorithms a credential may register with (registration rejects credentials outside the list).

## Attestation

Every WebAuthn attestation format is cryptographically verified in this release. The distinction is **trust anchoring**: a statement can be cryptographically valid yet not chain to a root you trust. The package keeps that distinction honest — it reports `attestationVerified: true` only when the statement is both verified _and_ anchored to a known root, and never silently treats "verified but un-anchored" as "trusted".

This verification is **offline by design**: trust anchors come from a relying-party-supplied `MetadataService`, never from the network. The package bundles only the small static Apple WebAuthn Root CA. There is no certificate revocation (CRL/OCSP) checking.

### Capability matrix

| Format              | Cryptographically verified                                                                                                         | `attestationVerified: true` when…                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`              | Nothing to verify (no statement).                                                                                                  | Never — always `false`.                                                                                                                        |
| `packed` (self)     | `sig` over `authData ‖ clientDataHash` with the **credential** key.                                                                | Always on success (no certificate chain is involved, so no trust anchor is needed).                                                            |
| `packed` (x5c)      | `sig` with the **leaf** cert key; leaf requirements (v3, OU `Authenticator Attestation`, CA=false); FIDO AAGUID extension matches. | The x5c chain anchors to a root supplied via `metadataService`. Otherwise verified but `false` (honest framing, not a failure).                |
| `fido-u2f`          | `sig` (ECDSA P-256) over the reconstructed U2F verification data with the attestation cert key.                                    | The x5c chain anchors to a root supplied via `metadataService`. Otherwise `false`.                                                             |
| `android-key`       | `sig` with the leaf key; leaf key == credential key; the Key Attestation extension `attestationChallenge` == client-data hash.     | The x5c chain anchors to a Google hardware-attestation root supplied via `metadataService`. Otherwise `false`.                                 |
| `tpm`               | `certInfo`/`pubArea` binding; `pubArea` key == credential key; `extraData` binding; AIK signature; AIK cert carries the AIK EKU.   | The AIK chain anchors to a root supplied via `metadataService`. Otherwise `false`.                                                             |
| `apple`             | Chain to the bundled Apple WebAuthn Root CA; nonce extension == `hash(authData ‖ clientDataHash)`; leaf key == credential key.     | Trust-anchored **without** a `metadataService` — the Apple root is bundled.                                                                    |
| `android-safetynet` | JWS signature verified with the `x5c[0]` leaf; hostname `attest.android.com`; `nonce`, `ctsProfileMatch`, and timestamp freshness. | The JWS chain anchors to a GlobalSign root supplied via `metadataService` (none is bundled). **Deprecated by Google** — prefer Play Integrity. |

Honest limits worth stating explicitly:

- **TPM**: the AIK SAN fields (manufacturer / model / version) are **not** additionally asserted. The security-critical bindings (key match, `extraData`/challenge binding, AIK signature, AIK EKU, and chain) **are**. The SAN is available to you via `trustPath`.
- **android-key**: the Keymaster authorization-list constraints (`purpose`, `origin`, absence of `allApplications`) are **not** additionally enforced. The challenge binding, leaf-key match, and hardware-root chain **are**. Inspect `trustPath` if you need the full Keymaster policy.
- **No revocation**: there is no CRL/OCSP checking (offline by design).
- **android-safetynet** is deprecated by Google; new authenticators do not emit it.

`verifyRegistration` returns `registrationInfo.fmt`, `registrationInfo.attestationVerified`, and (for trust-anchored chains) `registrationInfo.trustPath`, so you can branch on the outcome.

### Supplying a MetadataService (FIDO MDS) and using the bundled Apple root

The relying party supplies the (large, frequently-updated) FIDO MDS data — the package never bundles or fetches it. Use the exported `StaticMetadataService` for a fixed set of roots. The simplest case is a single-vendor deployment that only needs the bundled Apple root:

```typescript
import {
  WebAuthnServer,
  StaticMetadataService,
  APPLE_WEBAUTHN_ROOT_CA_PEM,
} from 'webauthn-server-buildkit';

const metadataService = new StaticMetadataService({
  // Returned when no AAGUID / cert-key-id match is found. A single known root
  // (e.g. the bundled Apple WebAuthn Root CA) is the common single-vendor case.
  defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM],

  // Trusted roots keyed by authenticator AAGUID (from your FIDO MDS blob).
  rootsByAaguid: {
    '00000000-0000-0000-0000-000000000000': ['-----BEGIN CERTIFICATE-----\n…'],
  },

  // Roots keyed by attestation-cert key identifier (for formats without an
  // AAGUID, e.g. fido-u2f).
  rootsByCertKeyId: {
    /* keyIdBase64Url: ['-----BEGIN CERTIFICATE-----\n…'] */
  },
});

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET,
  attestationType: 'direct', // ask the authenticator for attestation
  metadataService, // supply trust anchors
  requireTrustedAttestation: true, // reject statements that can't be trust-anchored
});
```

> Note: `apple` trust-anchors against the bundled root with **no** `metadataService`. Every other certificate-chain format needs a `metadataService` that supplies its roots — without one, those formats verify cryptographically but report `attestationVerified: false`, and `requireTrustedAttestation: true` would reject them.

`MetadataService` is a synchronous interface (`getRootCertificates(query)` plus an optional `getStatement(aaguid)`); implement it yourself to back it with a live FIDO MDS cache if you prefer.

## Usernameless / discoverable credentials

To support usernameless (discoverable-credential / "passkey") login, you must persist the WebAuthn user handle at registration and validate it at authentication:

1. **At registration**, request a resident key and persist the returned `webAuthnUserId` on the credential as `webAuthnUserID`:

   ```typescript
   const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user, {
     authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
   });
   // … after verifyRegistration succeeds …
   await saveCredential({
     /* …credential fields… */
     webAuthnUserID: webAuthnUserId,
   });
   ```

   Check `registrationInfo.clientExtensionResults?.credProps?.rk` to confirm a discoverable credential was actually created (`rk === true`).

2. **At authentication**, omit `allowCredentials` so the client picks any resident credential, then look the credential up by the `userHandle` the authenticator returns:

   ```typescript
   const { options, challenge } = await webauthn.createAuthenticationOptions();
   // … client returns an assertion with response.userHandle …
   const credential = await getCredentialByWebAuthnUserId(clientResponse.response.userHandle);
   const { verified } = await webauthn.verifyAuthentication(clientResponse, challenge, credential);
   // verifyAuthentication also validates userHandle against credential.webAuthnUserID
   // (USER_HANDLE_MISMATCH) as a defense-in-depth check.
   ```

### Mobile attestation (opt-in)

Some native clients (for example the companion `capacitor-biometric-authentication` package) send a **non-standard JSON** payload instead of a CBOR WebAuthn attestation. This path is **disabled by default** (`enableMobileAttestation: false`) because it trusts a client-supplied `{ publicKey, credentialId }` object **without verifying a challenge signature** — it provides no cryptographic attestation guarantee. With it disabled, every registration is handled by the standard WebAuthn path, so the path cannot be used to bypass verification.

Enable it only if you fully control the client and transport and enforce freshness/authenticity by other means:

```typescript
const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: [
    'https://example.com',
    'ios-app://com.example.app', // iOS app bundle identifier
    'android-app://com.example.app', // Android app package name
  ],
  encryptionSecret: process.env.ENCRYPTION_SECRET,
  enableMobileAttestation: true, // ⚠️ no cryptographic attestation — see above
});
```

When enabled, a warning is logged each time a credential is accepted via the mobile path.

## Security Considerations

1. **Encryption Secret**: Use a strong, unique secret of at least 32 characters
2. **HTTPS Required**: Always use HTTPS in production for WebAuthn
3. **Origin Validation**: The package validates origins to prevent phishing; supply `originVerifier` for normalization or native `android:apk-key-hash:` origins
4. **Cross-Origin Ceremonies**: Rejected by default (`clientData.crossOrigin === true` → `CROSS_ORIGIN_NOT_ALLOWED`); opt in with `allowCrossOriginIframe`
5. **Challenge Replay**: With a storage adapter configured, challenges are server-enforced single-use, unexpired, and operation-scoped (`enforceChallengeStore`, default on)
6. **Algorithm Pinning**: The registered COSE algorithm is enforced at every assertion (`ALGORITHM_MISMATCH`) and the `supportedAlgorithms` allowlist is applied at both registration and authentication — persist `credential.alg` for this to take effect
7. **Counter & Clone Signals**: Authenticator counters are tracked to detect cloned credentials; `counterSupported`, `backupStateChanged`, and `userVerificationDowngraded` advisories surface migration/downgrade signals for your policy
8. **Session Security**: Session tokens are encrypted with AES-256-GCM; keys are derived with HKDF-SHA256 and a 12-byte IV, and token fields are length-validated before decryption. Upgrading from 2.1.x invalidates existing tokens (users re-authenticate once)
9. **Mobile Attestation**: The mobile JSON path is opt-in and provides NO cryptographic attestation — keep it disabled unless you understand the trade-off (see [Attestation](#attestation))

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

All error classes extend `WebAuthnError` (exposing `code` and `statusCode`) and are exported as **runtime values**, so `instanceof` checks work. The `COSEAlgorithmIdentifier`, `COSEKeyType`, and `COSEEllipticCurve` enums are likewise value exports.

`error.code` is a stable, machine-readable string typed against the exported `WebAuthnErrorCode` union (an _open_ union, so custom/future codes still compile) — branch on it instead of matching error messages. `error.statusCode` suggests an HTTP status: `400` for malformed input / verification failures, `401` for authentication/session failures, and `500` for configuration/storage problems. Codes new in 2.3.0 include `CHALLENGE_NOT_FOUND`, `CHALLENGE_EXPIRED`, `CHALLENGE_OPERATION_MISMATCH`, `CROSS_ORIGIN_NOT_ALLOWED`, `ALGORITHM_MISMATCH`, `USER_HANDLE_MISMATCH`, `CREDENTIAL_ALREADY_REGISTERED`, and the `ATTESTATION_*` family (e.g. `ATTESTATION_NOT_TRUSTED`).

```typescript
import type { WebAuthnErrorCode } from 'webauthn-server-buildkit';
```

## Requirements

- Node.js 24.13.0 or higher (see `engines` in `package.json`)
- TypeScript 5.5+ recommended (the package is built and type-checked with TypeScript 6)

## Frontend Package

For frontend biometric authentication, use the companion package [`capacitor-biometric-authentication`](https://www.npmjs.com/package/capacitor-biometric-authentication) which works with React, Vue, Angular, or vanilla JavaScript.

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
