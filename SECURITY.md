# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.3.x   | :white_check_mark: |
| < 2.3   | :x:                |

## Reporting a Vulnerability

We take the security of WebAuthn Server Buildkit seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

- **Email**: aoneahsan@gmail.com
- **Subject Line**: [SECURITY] WebAuthn Server Buildkit - [Brief Description]

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Initial Assessment**: Within 7 days, we will provide an initial assessment of the vulnerability.
- **Updates**: We will keep you informed about the progress of addressing the vulnerability.
- **Resolution**: Once the vulnerability is fixed, we will notify you and provide details about the fix.
- **Credit**: With your permission, we will acknowledge your contribution in the release notes.

## Security Best Practices

When using WebAuthn Server Buildkit in production:

1. **Always use HTTPS**: WebAuthn requires a secure context.
2. **Keep dependencies updated**: Regularly update to the latest version.
3. **Use strong encryption secrets**: Ensure your `encryptionSecret` is at least 32 characters.
4. **Validate origins**: Always configure proper origin validation.
5. **Implement rate limiting**: Add rate limiting to prevent brute force attacks.
6. **Monitor for anomalies**: Track failed authentication attempts.
7. **Regular security audits**: Periodically review your implementation.

## Security Features

WebAuthn Server Buildkit is secure-by-default. As of v2.3.0 it includes:

- **Server-enforced challenge lifecycle**: When a storage adapter is configured, each verification challenge is required to exist in storage, be unexpired, and be scoped to the matching operation (registration vs. authentication), and is consumed exactly once so it can never be replayed (`enforceChallengeStore`, default on).
- **Algorithm pinning at authentication**: The COSE algorithm a credential registered with is enforced at every assertion (`ALGORITHM_MISMATCH`), and the configured `supportedAlgorithms` allowlist is applied at both registration and authentication. COSE keys are also checked for `alg`/`kty`/`crv` consistency, which pins RSA padding (PSS vs PKCS#1) rather than letting the key choose it.
- **Cross-origin ceremony rejection**: `clientData.crossOrigin === true` is rejected by default (`CROSS_ORIGIN_NOT_ALLOWED`); opt in with `allowCrossOriginIframe`.
- **Constant-time comparisons**: The RP-ID hash and other security-sensitive byte comparisons use timing-safe equality.
- **Encrypted session tokens**: AES-256-GCM with HKDF-SHA256 key derivation and a 12-byte GCM IV. Token fields (`iv`, `tag`, `salt`) are length-validated before the decipher is constructed, and decryption fails closed.
- **Origin validation**: Prevents phishing attacks; a custom `originVerifier` supports normalization and native `android:apk-key-hash:` origins.
- **Clone & downgrade signals**: Counter tracking detects cloned credentials, and the verifier surfaces `counterSupported`, `backupStateChanged`, and `userVerificationDowngraded` advisories so the relying party can apply its own policy.
- **Discoverable-credential safety**: The assertion `userHandle` is validated against the stored `webAuthnUserID` (`USER_HANDLE_MISMATCH`) for usernameless flows.
- **Per-format attestation verification with trust anchoring**: `none`, `packed` (self + x5c), `fido-u2f`, `android-key`, `tpm`, `android-safetynet`, and `apple` are cryptographically verified. A statement reports `attestationVerified: true` only when it is also trust-anchored — to a root supplied via a relying-party `MetadataService` (FIDO MDS), or, for `apple`, the bundled Apple WebAuthn Root CA. Set `requireTrustedAttestation: true` to reject non-trust-anchored attestations when attestation is requested.
- **Secure challenge generation**: Cryptographically secure random challenges.
- **Type-safe implementation**: Reduces common programming errors; failures carry a stable, machine-readable `WebAuthnErrorCode`.

### Known limitations (honest framing)

- **No certificate revocation**: Attestation verification is offline by design — there is no CRL/OCSP checking. Trust anchors come only from the relying-party-supplied `MetadataService` (the package bundles only the static Apple WebAuthn Root CA and never fetches MDS data).
- **Un-anchored attestation is not "trusted"**: A certificate-chain attestation format with no matching trust anchor is reported as `attestationVerified: false`, not silently accepted.
- **TPM SAN and android-key authorization-list not asserted**: For `tpm`, the AIK SAN (manufacturer / model / version) is not additionally asserted; for `android-key`, the Keymaster authorization-list constraints (`purpose`, `origin`, `allApplications`) are not additionally enforced. The security-critical bindings (key match, challenge/nonce binding, signature, EKU, and chain) are. The full certificate chain is available via `trustPath`.
- **`android-safetynet` is deprecated by Google**: It is verified for completeness, but Play Integrity is the recommended successor.
- **Mobile JSON attestation path**: Disabled by default and provides no cryptographic attestation; enable it only if you fully control the client and transport.

## Disclosure Policy

When we receive a security vulnerability report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new security fix versions

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or email aoneahsan@gmail.com.
