# Migration Guide

This guide helps you upgrade between versions of webauthn-server-buildkit.

## Migrating from v2.2.x to v2.3.0

v2.3.0 is a minor release, but it turns on several WebAuthn protections that were
previously only requested or partially applied. Each behaviour change is
**secure-by-default with an opt-out switch**, so you can adopt them deliberately.
The rest of the release is additive (new config options, result fields, and
exports). No source API was removed.

### 1. Challenge lifecycle is now enforced from storage

If you configured a `storageAdapter`, the verify path now looks the challenge up
in storage, rejects it if it is missing / expired / scoped to the wrong
operation, and consumes it once so it can never be replayed.

```typescript
// Issue challenges through the server so they are persisted to your adapter:
const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user);
// ...later, on the verify path, the stored challenge is validated and consumed:
const result = await webauthn.verifyRegistration(response, challenge);
```

If a challenge is invalid, verification throws a typed error you can switch on:

```typescript
import { type WebAuthnErrorCode } from 'webauthn-server-buildkit';

// New codes: 'CHALLENGE_NOT_FOUND' | 'CHALLENGE_EXPIRED' | 'CHALLENGE_OPERATION_MISMATCH'
```

**Migration:** if you manage challenge lifecycle yourself (and only pass
`expectedChallenge`), opt out to keep the old behaviour:

```typescript
const webauthn = new WebAuthnServer({
  // ...existing config...
  enforceChallengeStore: false, // library only compares the supplied expectedChallenge
});
```

This option has no effect when no `storageAdapter` is configured.

### 2. Algorithm allowlist + credential algorithm pinning at authentication

The `supportedAlgorithms` allowlist — previously applied only at registration —
is now also applied at authentication. When the stored credential carries an
`alg`, the assertion must use that exact algorithm.

**Migration:** persist the credential's registered algorithm so pinning can take
effect.

**Before (v2.2.x):**

```typescript
const result = await webauthn.verifyRegistration(response, challenge);
await saveCredential({
  id: result.registrationInfo.credential.id,
  publicKey: result.registrationInfo.credential.publicKey,
  counter: result.registrationInfo.credential.counter,
});
```

**After (v2.3.0):**

```typescript
const result = await webauthn.verifyRegistration(response, challenge);
await saveCredential({
  id: result.registrationInfo.credential.id,
  publicKey: result.registrationInfo.credential.publicKey,
  counter: result.registrationInfo.credential.counter,
  alg: result.registrationInfo.credential.alg, // pin the algorithm at auth
  userVerified: result.registrationInfo.userVerified, // enables UV downgrade detection
});
```

A mismatch at authentication throws with code `ALGORITHM_MISMATCH`; an
inconsistent COSE key (`alg` vs `kty`/`crv`) throws `COSE_ALG_MISMATCH`. Both
`alg` and `userVerified` are optional on `WebAuthnCredential` — existing stored
credentials without them keep working, just without pinning.

### 3. Cross-origin iframe ceremonies are now rejected

A ceremony whose `clientDataJSON` reports `crossOrigin === true` is now rejected
with `CROSS_ORIGIN_NOT_ALLOWED`.

**Migration:** if you intentionally run ceremonies inside a cross-origin iframe,
opt in:

```typescript
const webauthn = new WebAuthnServer({
  // ...existing config...
  allowCrossOriginIframe: true,
});
```

### 4. New optional API surface (all additive)

**New config options:**

```typescript
const webauthn = new WebAuthnServer({
  // ...existing config...
  enforceChallengeStore: true, // default true when a storageAdapter is set
  allowCrossOriginIframe: false, // default false
  requireTrustedAttestation: false, // default false
  originVerifier: (origin) => origin === 'android:apk-key-hash:...', // optional custom matcher
  metadataService: undefined, // optional FIDO MDS trust-anchor provider (see §5)
});
```

**New result fields** (all optional/additive):

```typescript
// VerifiedRegistrationInfo
result.registrationInfo.credential.alg; // COSE algorithm — persist for pinning
result.registrationInfo.trustPath; // attestation cert chain (PEM[]) when present
result.registrationInfo.clientExtensionResults; // credProps.rk, prf, largeBlob, ...

// VerifiedAuthenticationInfo
result.authenticationInfo.userHandle; // for discoverable (usernameless) credentials
result.authenticationInfo.backupStateChanged; // advisory cloning/migration signal
result.authenticationInfo.userVerificationDowngraded; // advisory UV downgrade signal
result.authenticationInfo.counterSupported; // false for always-0-counter authenticators
result.authenticationInfo.clientExtensionResults; // appid, prf, largeBlob, ...
```

**New exports:** the typed `WebAuthnErrorCode` union, the attestation
trust-anchor provider (`MetadataService`, `StaticMetadataService`), the bundled
`APPLE_WEBAUTHN_ROOT_CA_PEM`, and per-format attestation verifiers. See the
[API Reference](./api-reference.md) for the full list.

### 5. Trust-anchoring certificate-chain attestation (optional)

`apple`, `fido-u2f`, `packed` x5c, `android-key`, `tpm`, and `android-safetynet`
attestation statements are now cryptographically verified. Certificate-chain
formats report `attestationVerified: true` **only** when their chain anchors to a
trusted root. `apple` works out of the box (its root is bundled); the others need
roots you supply through a `metadataService`.

```typescript
import {
  WebAuthnServer,
  StaticMetadataService,
  APPLE_WEBAUTHN_ROOT_CA_PEM,
} from 'webauthn-server-buildkit';

const webauthn = new WebAuthnServer({
  // ...existing config...
  metadataService: new StaticMetadataService({
    defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM /* + your FIDO MDS roots */],
  }),
  requireTrustedAttestation: true, // reject non-trust-anchored attestation when attestationType !== 'none'
});
```

Without a `metadataService`, certificate-chain formats are still verified but
report `attestationVerified: false` (honest framing — never a false positive).
Note: `android-safetynet` is **deprecated by Google** (use Play Integrity for new
Android integrations), and trust anchoring does not perform CRL/OCSP revocation
checks.

### 6. Detect already-registered credentials (optional)

`verifyRegistration` can now reject a credential that the user has already
registered:

```typescript
const result = await webauthn.verifyRegistration(response, challenge, {
  existingCredentialIds: await listUserCredentialIds(user.id),
});
// throws with code 'CREDENTIAL_ALREADY_REGISTERED' on a duplicate
```

### 7. Toolchain / engine

No source API change. The runtime engine requirement is unchanged
(`>=24.13.0`), there are no new runtime dependencies (`cbor-x` only), and 311
tests pass.

## Migrating from v2.1.x to v2.2.0

v2.2.0 is a minor release, but two security fixes change runtime behaviour.

### 1. Existing session tokens are invalidated

Session-token key derivation changed from a bare HMAC to **HKDF-SHA256**, and the
AES-GCM IV is now 12 bytes. Tokens issued by 2.1.x can no longer be decrypted, so
`validateSession`/`refreshSession` will reject them.

**Migration:** none required in code — affected users simply re-authenticate once.
Session tokens are short-lived, so plan the deploy like any session-store rotation
(optionally force re-login).

### 2. Mobile attestation is now opt-in

The non-standard mobile JSON attestation path is **disabled by default**. If you
relied on it (typically with the `capacitor-biometric-authentication` client sending
a JSON `{ publicKey, credentialId }` payload), enable it explicitly:

```typescript
const webauthn = new WebAuthnServer({
  // ...existing config...
  enableMobileAttestation: true,
});
```

Note this path performs **no** cryptographic attestation; enable it only on a
trusted client/transport. With it disabled, those registrations now go through the
standard WebAuthn path and will fail to parse (as intended).

### 3. Error classes and COSE enums are now value exports

Previously these were exported `type`-only, so `instanceof` and enum-member access
did not work at runtime. If you worked around this (e.g. matching on `error.name` or
hardcoding algorithm numbers), you can now use the real values:

```typescript
import { VerificationError, COSEAlgorithmIdentifier } from 'webauthn-server-buildkit';

if (err instanceof VerificationError) {
  /* ... */
}
const alg = COSEAlgorithmIdentifier.ES256; // -7
```

### 4. New result fields

`verifyRegistration` now returns `registrationInfo.fmt` and
`registrationInfo.attestationVerified`. These are additive and optional.

### 5. Toolchain / engine

No source API change, but the package is now built with TypeScript 6 / ESLint 10 and
its CI runs on Node 24.x. The runtime engine requirement is unchanged (`>=24.13.0`).

## Migrating from v1.x to v2.x

### Breaking Changes

#### 1. Type Safety Improvements

**Change:** Console utility functions changed from `any` to `unknown` types.

**Before (v1.x):**

```typescript
// Accepted any value without type checking
logger(level, message, data: any);
```

**After (v2.x):**

```typescript
// Requires explicit type handling
logger(level, message, data: unknown);
```

**Migration:**

```typescript
// If you're using a custom logger, update the signature:
const webauthn = new WebAuthnServer({
  logger: (level: string, message: string, data: unknown) => {
    // Type check or cast as needed
    console.log(`[${level}]`, message, data);
  },
  // ...
});
```

### New Features

#### 2. Mobile Attestation Support

v2.0 adds support for mobile platform attestation from iOS and Android apps.

**New Functions:**

- `isMobileAttestation(response)` - Detect mobile attestation format
- `validateMobileAttestation(response, challenge, rpId)` - Validate mobile credentials
- `isCborParsingError(error)` - Check for CBOR parsing errors

**Usage:**

```typescript
import {
  isMobileAttestation,
  validateMobileAttestation,
  isCborParsingError,
} from 'webauthn-server-buildkit';

// Handle both web and mobile attestation
async function verifyRegistration(response, challenge) {
  if (isMobileAttestation(response)) {
    return await validateMobileAttestation(response, challenge, rpId);
  }

  try {
    return await webauthn.verifyRegistration(response, challenge);
  } catch (error) {
    if (isCborParsingError(error)) {
      // Fall back to mobile attestation
      return await validateMobileAttestation(response, challenge, rpId);
    }
    throw error;
  }
}
```

#### 3. Counter Validation Improvements

**Change:** Counter validation logic has been fixed in authentication verify-response.

**v1.x Behavior:**

- Counter validation could incorrectly pass in some edge cases

**v2.x Behavior:**

- Strict counter validation: counter must increase or be 0 (for authenticators that don't support counters)
- Returns `counterIncreased` boolean in authentication info

**Migration:**

```typescript
const result = await webauthn.verifyAuthentication(response, challenge, credential);

if (result.verified) {
  // Check counter behavior
  if (!result.authenticationInfo.counterIncreased) {
    // Log warning - counter didn't increase
    // This might indicate a cloned credential
    console.warn('Counter did not increase');
  }

  // Always update the stored counter
  await updateCredentialCounter(credential.id, result.authenticationInfo.newCounter);
}
```

### Configuration Changes

#### 4. Origin Configuration for Mobile

If you're supporting mobile apps, update your origin configuration:

```typescript
const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: [
    'https://example.com', // Web
    'https://app.example.com', // Web subdomain
    'ios-app://com.example.app', // iOS app
    'android-app://com.example.app', // Android app
  ],
  // ...
});
```

### Recommended Upgrades

#### 5. Use Test Fixtures

v2.0 includes test fixtures for WebAuthn data. Use them for your test suite:

```typescript
import {
  validRegistrationResponse,
  validAuthenticationResponse,
  mockChallenge,
} from 'webauthn-server-buildkit/tests/fixtures/webauthn-data';
```

#### 6. Enable Debug Logging

Enable debug mode during development to catch issues early:

```typescript
const webauthn = new WebAuthnServer({
  debug: true,
  logger: (level, message, data) => {
    console.log(`[WebAuthn ${level}]`, message, data);
  },
  // ...
});
```

## Version Compatibility Matrix

| Frontend Package Version | Backend Package Version | Compatible            |
| ------------------------ | ----------------------- | --------------------- |
| 2.0.x                    | 2.0.x                   | ✅ Yes                |
| 2.0.x                    | 1.0.x                   | ⚠️ Partial (web only) |
| 1.0.x                    | 2.0.x                   | ⚠️ Partial (web only) |
| 1.0.x                    | 1.0.x                   | ✅ Yes                |

**Note:** For full mobile attestation support, both packages should be v2.0.x.

## Deprecation Notices

### Deprecated in v2.0

| Feature         | Status     | Replacement             |
| --------------- | ---------- | ----------------------- |
| `rpIcon` option | Deprecated | Will be removed in v3.0 |

### Removed in v2.0

None - v2.0 maintains backward compatibility with v1.0 APIs.

## Getting Help

If you encounter issues during migration:

1. Check the [Troubleshooting Guide](./troubleshooting.md)
2. Review the [API Reference](./api-reference.md)
3. Open an issue on GitHub
