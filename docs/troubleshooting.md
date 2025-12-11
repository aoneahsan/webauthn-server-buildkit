# Troubleshooting Guide

This guide covers common issues and solutions when using webauthn-server-buildkit.

## Table of Contents

- [CBOR/COSE Decoding Errors](#cborcose-decoding-errors)
- [Mobile Attestation Issues](#mobile-attestation-issues)
- [Session Token Problems](#session-token-problems)
- [Storage Adapter Errors](#storage-adapter-errors)
- [Origin Validation Failures](#origin-validation-failures)
- [Signature Verification Failures](#signature-verification-failures)
- [Counter Validation Issues](#counter-validation-issues)

## CBOR/COSE Decoding Errors

### Error: "CBOR decoding error" or "Invalid CBOR data"

**Cause:** The attestation object or authenticator data is malformed or uses an unsupported CBOR encoding.

**Solutions:**

1. **Check if it's a mobile attestation:**
   ```typescript
   import { isMobileAttestation, validateMobileAttestation } from 'webauthn-server-buildkit';

   if (isMobileAttestation(response)) {
     // Use mobile attestation validation
     const result = await validateMobileAttestation(response, expectedChallenge, rpId);
   }
   ```

2. **Use the error detection helper:**
   ```typescript
   import { isCborParsingError } from 'webauthn-server-buildkit';

   try {
     await webauthn.verifyRegistration(response, challenge);
   } catch (error) {
     if (isCborParsingError(error)) {
       // Likely a mobile attestation or malformed data
       console.log('CBOR parsing failed, trying mobile attestation...');
     }
   }
   ```

3. **Verify the attestation format:**
   - Standard WebAuthn: Should have properly CBOR-encoded attestation object
   - Mobile attestation: May use simplified format with base64-encoded components

### Error: "Invalid COSE key format"

**Cause:** The public key in the response doesn't match expected COSE key structure.

**Solutions:**

1. Check that the response includes a valid public key
2. For mobile platforms, ensure the public key is in the correct format:
   - Android: Base64-encoded DER format
   - iOS: Base64-encoded SEC1 format

## Mobile Attestation Issues

### Error: "Invalid mobile attestation format"

**Cause:** The mobile client sent attestation data that doesn't match expected format.

**Solutions:**

1. **Verify the platform is supported:**
   ```typescript
   // Check response structure
   console.log('Response type:', response.response?.attestationObject ? 'standard' : 'mobile');
   console.log('Has publicKey:', !!response.response?.publicKey);
   ```

2. **Check required fields for mobile attestation:**
   - `response.response.publicKey` - Required
   - `response.response.signature` - Required
   - `response.response.authenticatorData` - Required
   - `response.clientDataJSON` - Required (may be in `response.response`)

3. **Validate mobile origin format:**
   - iOS: `ios-app://bundle.identifier`
   - Android: `android-app://package.name`

### Error: "Platform detection failed"

**Cause:** Cannot determine if attestation is from iOS or Android.

**Solution:** The origin URL helps detect the platform:
```typescript
// Origin formats
const iosOrigin = 'ios-app://com.example.app';
const androidOrigin = 'android-app://com.example.app';

// Or let the library detect automatically
const result = await validateMobileAttestation(response, challenge, rpId);
```

## Session Token Problems

### Error: "Invalid session token"

**Cause:** The session token is malformed, tampered with, or encrypted with a different secret.

**Solutions:**

1. **Verify encryption secret consistency:**
   ```typescript
   // Ensure the same secret is used across server instances
   const webauthn = new WebAuthnServer({
     encryptionSecret: process.env.ENCRYPTION_SECRET, // Must be same everywhere
     // ...
   });
   ```

2. **Check secret length:**
   - Minimum: 32 characters
   - Recommended: 64+ characters

3. **Validate token format:**
   - Tokens are base64-encoded encrypted data
   - Never modify tokens on the client side

### Error: "Session expired"

**Cause:** The session token has exceeded its validity period.

**Solutions:**

1. **Adjust session duration:**
   ```typescript
   const webauthn = new WebAuthnServer({
     sessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
     // ...
   });
   ```

2. **Implement token refresh:**
   ```typescript
   const newToken = await webauthn.refreshSession(oldToken);
   ```

### Error: "Session not found"

**Cause:** The session was revoked or storage was cleared.

**Solutions:**

1. Check if session was explicitly revoked
2. Verify storage adapter is persistent (not just in-memory for production)
3. Implement session cleanup cron job for expired sessions

## Storage Adapter Errors

### Error: "Storage adapter not configured"

**Cause:** No storage adapter was provided and the default memory adapter is insufficient.

**Solution:** Implement a persistent storage adapter:
```typescript
import { StorageAdapter } from 'webauthn-server-buildkit';

class DatabaseStorageAdapter implements StorageAdapter {
  users = {
    async findById(id) { /* database query */ },
    async findByUsername(username) { /* database query */ },
    async create(user) { /* database insert */ },
    async update(id, data) { /* database update */ },
    async delete(id) { /* database delete */ },
  };

  credentials = {
    async findById(id) { /* ... */ },
    async findByUserId(userId) { /* ... */ },
    async create(credential) { /* ... */ },
    async updateCounter(id, counter) { /* ... */ },
    async updateLastUsed(id) { /* ... */ },
    async delete(id) { /* ... */ },
  };

  challenges = { /* ... */ };
  sessions = { /* ... */ };
}

const webauthn = new WebAuthnServer({
  storageAdapter: new DatabaseStorageAdapter(),
  // ...
});
```

### Error: "Challenge not found"

**Cause:** The challenge expired or was never stored.

**Solutions:**

1. **Increase challenge timeout:**
   ```typescript
   const webauthn = new WebAuthnServer({
     timeout: 300000, // 5 minutes
     // ...
   });
   ```

2. **Verify challenge storage:**
   - Ensure `challenges.create()` is working
   - Check `challenges.deleteExpired()` isn't too aggressive

## Origin Validation Failures

### Error: "Origin mismatch"

**Cause:** The origin in clientDataJSON doesn't match expected origin(s).

**Solutions:**

1. **Configure multiple origins:**
   ```typescript
   const webauthn = new WebAuthnServer({
     origin: [
       'https://example.com',
       'https://app.example.com',
       'https://localhost:3000', // Development
     ],
     // ...
   });
   ```

2. **For mobile apps, add mobile origins:**
   ```typescript
   const webauthn = new WebAuthnServer({
     origin: [
       'https://example.com',
       'ios-app://com.example.app',
       'android-app://com.example.app',
     ],
     // ...
   });
   ```

3. **Use custom origin validation:**
   ```typescript
   const result = await webauthn.verifyRegistration(
     response,
     challenge,
     'custom-origin://my-app' // Custom expected origin
   );
   ```

### Error: "RP ID mismatch"

**Cause:** The rpId in clientDataJSON doesn't match configured rpID.

**Solutions:**

1. Ensure rpID matches your domain exactly (no protocol, no port)
2. For mobile: rpID should match what the mobile SDK expects

## Signature Verification Failures

### Error: "Signature verification failed"

**Cause:** The signature doesn't match the public key or signed data.

**Solutions:**

1. **Verify public key format:**
   - ES256: ECDSA with P-256 curve
   - RS256: RSA with SHA-256

2. **Check signed data construction:**
   ```typescript
   // The signed data should be: authenticatorData + SHA256(clientDataJSON)
   ```

3. **For mobile attestation:**
   - Ensure the signature algorithm matches what the mobile SDK uses
   - Android typically uses ES256
   - iOS typically uses ES256

## Counter Validation Issues

### Warning: "Counter did not increase"

**Cause:** The authenticator's counter didn't increase from the stored value.

**Implications:**

1. **Cloned credential:** Possible security risk - credential may have been cloned
2. **Authenticator limitation:** Some authenticators don't implement counters

**Solutions:**

1. **Decide on counter policy:**
   ```typescript
   // In your verification logic
   if (!result.authenticationInfo.counterIncreased) {
     // Log security warning
     console.warn('Counter did not increase - possible cloned credential');
     // Decide whether to reject or allow
   }
   ```

2. **Update stored counter:**
   ```typescript
   // Always update counter after successful auth
   await storage.credentials.updateCounter(
     credentialId,
     result.authenticationInfo.newCounter
   );
   ```

## Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const webauthn = new WebAuthnServer({
  debug: true,
  logger: (level, message, data) => {
    console.log(`[WebAuthn ${level}]`, message, JSON.stringify(data, null, 2));
  },
  // ...
});
```

## Getting Help

If you encounter issues not covered here:

1. Check the [API Reference](./api-reference.md) for correct usage
2. Review the [CHANGELOG](../CHANGELOG.md) for recent changes
3. Open an issue on GitHub with:
   - Error message and stack trace
   - WebAuthn response (sanitized)
   - Server configuration (without secrets)
   - Client platform and browser/SDK version
