# Migration Guide

This guide helps you upgrade between versions of webauthn-server-buildkit.

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
