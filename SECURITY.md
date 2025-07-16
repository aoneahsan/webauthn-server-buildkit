# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

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

WebAuthn Server Buildkit includes several security features:

- **Encrypted session tokens**: Using AES-256-GCM encryption
- **Origin validation**: Prevents phishing attacks
- **Counter tracking**: Detects cloned credentials
- **Secure challenge generation**: Cryptographically secure random challenges
- **Type-safe implementation**: Reduces common programming errors

## Disclosure Policy

When we receive a security vulnerability report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new security fix versions

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or email aoneahsan@gmail.com.