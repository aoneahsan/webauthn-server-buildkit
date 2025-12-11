# Migration Guide

This guide helps you upgrade between major versions of webauthn-server-buildkit.

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
  isCborParsingError
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
  await updateCredentialCounter(
    credential.id,
    result.authenticationInfo.newCounter
  );
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
    'https://example.com',           // Web
    'https://app.example.com',       // Web subdomain
    'ios-app://com.example.app',     // iOS app
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

| Frontend Package Version | Backend Package Version | Compatible |
|-------------------------|------------------------|------------|
| 2.0.x | 2.0.x | ✅ Yes |
| 2.0.x | 1.0.x | ⚠️ Partial (web only) |
| 1.0.x | 2.0.x | ⚠️ Partial (web only) |
| 1.0.x | 1.0.x | ✅ Yes |

**Note:** For full mobile attestation support, both packages should be v2.0.x.

## Deprecation Notices

### Deprecated in v2.0

| Feature | Status | Replacement |
|---------|--------|-------------|
| `rpIcon` option | Deprecated | Will be removed in v3.0 |

### Removed in v2.0

None - v2.0 maintains backward compatibility with v1.0 APIs.

## Getting Help

If you encounter issues during migration:

1. Check the [Troubleshooting Guide](./troubleshooting.md)
2. Review the [API Reference](./api-reference.md)
3. Open an issue on GitHub
