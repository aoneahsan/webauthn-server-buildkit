# API Reference

> **Applies to:** `webauthn-server-buildkit` v2.3.0. See the
> [v2.3.0 additions](#v230-additions) summary below for what changed since 2.2.0.

## Table of Contents

- [v2.3.0 additions](#v230-additions)
- [WebAuthnServer Class](#webauthnserver-class)
  - [Constructor](#constructor)
  - [Registration Methods](#registration-methods)
  - [Authentication Methods](#authentication-methods)
  - [Session Methods](#session-methods)
- [Types](#types)
  - [Configuration Types](#configuration-types)
  - [Registration Types](#registration-types)
  - [Authentication Types](#authentication-types)
- [Attestation Verification](#attestation-verification)
  - [Capability matrix](#attestation-capability-matrix)
  - [MetadataService](#metadataservice)
  - [StaticMetadataService](#staticmetadataservice)
  - [Attestation verifier exports](#attestation-verifier-exports)
- [Storage Adapter Interface](#storage-adapter-interface)
- [Error Types](#error-types)
  - [WebAuthnErrorCode](#webauthnerrorcode)

## v2.3.0 additions

v2.3.0 is a secure-by-default release that ships full per-format attestation
verification, server-enforced challenge lifecycle, algorithm pinning at
authentication, and a usernameless (discoverable-credential) flow. No new runtime
dependencies were added; the only production dependency remains `cbor-x`. Node
`>=24.13.0` is required.

| Area                                                      | What is new                                                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Config](#webauthnserverconfig)                           | `enforceChallengeStore`, `allowCrossOriginIframe`, `originVerifier`, `metadataService`, `requireTrustedAttestation`                                              |
| [createRegistrationOptions](#createregistrationoptions)   | Now also returns `webAuthnUserId` (the generated user handle for usernameless login)                                                                             |
| [verifyRegistration](#verifyregistration)                 | New `options.existingCredentialIds` parameter → `CREDENTIAL_ALREADY_REGISTERED` on a duplicate credential                                                        |
| [verifyAuthentication](#verifyauthentication)             | Validates `userHandle` against the credential (`USER_HANDLE_MISMATCH`) and enforces `supportedAlgorithms` + the credential's pinned `alg` (`ALGORITHM_MISMATCH`) |
| [VerifiedRegistrationInfo](#verifiedregistrationinfo)     | Adds `credential.alg`, `trustPath`, `clientExtensionResults`                                                                                                     |
| [VerifiedAuthenticationInfo](#verifiedauthenticationinfo) | Adds `userHandle`, `backupStateChanged`, `userVerificationDowngraded`, `counterSupported`, `clientExtensionResults`                                              |
| [WebAuthnCredential](#webauthncredential)                 | Adds `alg` and `userVerified` (persist both at registration to enable pinning + UV-downgrade detection)                                                          |
| [Attestation](#attestation-verification)                  | Full per-format verification with trust anchoring via [MetadataService](#metadataservice); bundled Apple WebAuthn Root CA                                        |
| [Error types](#webauthnerrorcode)                         | New exported `WebAuthnErrorCode` union; `WebAuthnError.code` typed as `WebAuthnErrorCode \| (string & {})`; documented `statusCode`                              |

## WebAuthnServer Class

### Constructor

```typescript
new WebAuthnServer(config: WebAuthnServerConfig)
```

Creates a new instance of the WebAuthn server.

#### Parameters

- `config` - Server configuration object

#### Example

```typescript
const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  rpIcon: 'https://example.com/icon.png', // Optional, deprecated
  origin: 'https://example.com',
  encryptionSecret: 'your-32-character-or-longer-secret-key',
  storageAdapter: myStorageAdapter, // Optional
});
```

### Registration Methods

#### createRegistrationOptions

```typescript
async createRegistrationOptions(
  user: UserModel,
  params?: Partial<Omit<GenerateRegistrationOptionsParams, 'user'>>
): Promise<{
  options: PublicKeyCredentialCreationOptionsJSON;
  challenge: string;
  webAuthnUserId: string;
}>
```

Generates registration options for creating a new credential. When a
`storageAdapter` is configured, the challenge is persisted so it can be enforced
single-use at verification (see [`enforceChallengeStore`](#webauthnserverconfig)).

##### Parameters

- `user` - User information
- `params` - Optional parameters to customize registration:
  - `excludeCredentials` - List of credentials to exclude
  - `authenticatorSelection` - Authenticator selection criteria
  - `preferredAuthenticatorType` - Preferred authenticator type
  - `extensions` - WebAuthn extensions to request
  - `timeout` - Custom timeout for this operation
  - `attestation` - Attestation preference
  - `rpIcon` - RP icon URL (deprecated)

##### Returns

- `options` - The `PublicKeyCredentialCreationOptionsJSON` to send to the client
- `challenge` - The base64url challenge for this ceremony (equals `options.challenge`)
- `webAuthnUserId` _(new in 2.3.0)_ - The generated WebAuthn user handle
  (`options.user.id`). Persist this as
  [`WebAuthnCredential.webAuthnUserID`](#webauthncredential) so usernameless
  (discoverable-credential) login can match the authenticator-returned
  `userHandle` back to the owning user.

##### Example

```typescript
const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user, {
  excludeCredentials: existingCredentials,
  extensions: {
    credProps: true,
    largeBlob: { support: 'preferred' },
  },
  timeout: 120000, // 2 minutes
  attestation: 'direct',
});

// Persist `challenge` (server-side) and `webAuthnUserId` for this user so the
// later credential record can be populated with `webAuthnUserID: webAuthnUserId`.
```

#### verifyRegistration

```typescript
async verifyRegistration(
  response: RegistrationCredentialJSON,
  expectedChallenge: string,
  expectedOrigin?: string | string[],
  options?: { existingCredentialIds?: string[] }
): Promise<{
  verified: boolean;
  registrationInfo?: VerifiedRegistrationInfo;
}>
```

Verifies a registration response from the client.

##### Parameters

- `response` - Registration response from the client
- `expectedChallenge` - The challenge that was sent to the client
- `expectedOrigin` - Optional custom origin(s) to verify against (defaults to the
  configured `origin`)
- `options` _(new in 2.3.0)_ - Optional verification controls:
  - `existingCredentialIds` - The set of base64url credential IDs already
    registered for the user. When provided and the verified credential's ID is in
    this set, verification throws a `RegistrationError` with code
    `CREDENTIAL_ALREADY_REGISTERED` (server-side enforcement of
    `excludeCredentials`). Omit to skip the duplicate check.

##### Challenge lifecycle (new in 2.3.0)

When a `storageAdapter` is configured and `enforceChallengeStore` is `true` (the
default), `verifyRegistration` first looks the challenge up in storage and rejects
it when it is absent (`CHALLENGE_NOT_FOUND`), expired (`CHALLENGE_EXPIRED`), or was
issued for authentication rather than registration
(`CHALLENGE_OPERATION_MISMATCH`). The challenge is then deleted regardless of the
verification outcome, so it can never be replayed. Set `enforceChallengeStore:
false` to manage the challenge lifecycle yourself. This check is a no-op when no
storage adapter is configured.

### Authentication Methods

#### createAuthenticationOptions

```typescript
async createAuthenticationOptions(
  params?: GenerateAuthenticationOptionsParams
): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  challenge: string;
}>
```

Generates authentication options for verifying an existing credential.

##### Parameters

- `params` - Optional parameters to customize authentication:
  - `allowCredentials` - List of allowed credentials
  - `userVerification` - User verification requirement
  - `rpId` - RP ID
  - `extensions` - WebAuthn extensions to request
  - `timeout` - Custom timeout for this operation

##### Example

```typescript
const { options, challenge } = await webauthn.createAuthenticationOptions({
  allowCredentials: userCredentials,
  extensions: {
    largeBlob: { read: true },
  },
  timeout: 60000,
  userVerification: 'required',
});
```

#### verifyAuthentication

```typescript
async verifyAuthentication(
  response: AuthenticationCredentialJSON,
  expectedChallenge: string,
  credential: WebAuthnCredential,
  expectedOrigin?: string | string[]
): Promise<{
  verified: boolean;
  authenticationInfo?: VerifiedAuthenticationInfo;
}>
```

Verifies an authentication response from the client.

##### Parameters

- `response` - Authentication response from the client
- `expectedChallenge` - The challenge that was sent to the client
- `credential` - The stored [`WebAuthnCredential`](#webauthncredential) for the
  asserted credential ID
- `expectedOrigin` - Optional custom origin(s) to verify against (defaults to the
  configured `origin`)

##### Verification behavior (new/strengthened in 2.3.0)

- **User-handle binding.** When the assertion returns a `userHandle` (discoverable
  credentials), it must equal `credential.webAuthnUserID`; otherwise verification
  throws an `AuthenticationError` with code `USER_HANDLE_MISMATCH`. This is what
  makes the [usernameless flow](#usernameless-discoverable-credential-flow) safe.
- **Algorithm pinning.** The asserted key's COSE algorithm must be in the
  configured `supportedAlgorithms` allowlist (`UNSUPPORTED_CREDENTIAL_ALGORITHM`),
  and when `credential.alg` is set it must match exactly (`ALGORITHM_MISMATCH`).
  Persist `VerifiedRegistrationInfo.credential.alg` onto the stored credential to
  enable this pin.
- **Challenge lifecycle.** Same storage-backed single-use / expiry / operation
  enforcement as `verifyRegistration` (see above), gated by
  `enforceChallengeStore`. The challenge here must have been issued for
  `authentication`.
- **Advisory signals.** The returned
  [`VerifiedAuthenticationInfo`](#verifiedauthenticationinfo) surfaces
  `backupStateChanged`, `userVerificationDowngraded`, and `counterSupported` for
  the relying party to apply its own policy; these are advisory and do not by
  themselves fail verification.

### Session Methods

#### createSession

```typescript
async createSession(
  userId: string | number,
  credentialId: Base64URLString,
  userVerified: boolean,
  additionalData?: Record<string, unknown>
): Promise<string>
```

Creates a new session token after successful authentication.

#### validateSession

```typescript
async validateSession(token: string): Promise<{
  valid: boolean;
  sessionData?: SessionData;
  sessionId?: string;
}>
```

Validates a session token.

#### refreshSession

```typescript
async refreshSession(token: string): Promise<string>
```

Refreshes a session token, extending its expiration.

#### revokeSession

```typescript
async revokeSession(token: string): Promise<void>
```

Revokes a specific session.

#### revokeUserSessions

```typescript
async revokeUserSessions(userId: string | number): Promise<void>
```

Revokes all sessions for a specific user.

## Types

### Configuration Types

#### WebAuthnServerConfig

```typescript
interface WebAuthnServerConfig {
  rpName: string; // Relying Party name
  rpID: string; // Relying Party ID (domain)
  rpIcon?: string; // RP icon URL (deprecated)
  origin: string | string[]; // Expected origin(s)
  sessionDuration?: number; // Session duration in ms (default: 24h)
  encryptionSecret: string; // Secret for session encryption (min 32 chars)
  attestationType?: AttestationConveyancePreference; // Default: 'none'
  enableMobileAttestation?: boolean; // Default: false (opt-in to the non-standard mobile JSON path; no cryptographic attestation)
  enforceChallengeStore?: boolean; // Default: true when a storageAdapter is set (new in 2.3.0)
  allowCrossOriginIframe?: boolean; // Default: false (new in 2.3.0)
  originVerifier?: (origin: string) => boolean; // Custom origin matcher (new in 2.3.0)
  userVerification?: UserVerificationRequirement; // Default: 'preferred'
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  supportedAlgorithms?: COSEAlgorithmIdentifier[]; // Default: ES256, RS256
  challengeSize?: number; // Challenge size in bytes (16-64)
  timeout?: number; // Operation timeout in ms
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  storageAdapter?: StorageAdapter; // Storage adapter instance
  metadataService?: MetadataService; // Trust-anchor / FIDO MDS provider (new in 2.3.0)
  requireTrustedAttestation?: boolean; // Default: false (new in 2.3.0)
  debug?: boolean; // Enable debug logging
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void; // Custom logger function
}
```

##### Options added in 2.3.0

| Option                      | Type                                  | Default                                      | Behavior                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enforceChallengeStore`     | `boolean`                             | `true` when a `storageAdapter` is configured | Require the verification challenge to exist in storage (unexpired, scoped to the matching operation) and consume it once. Rejects with `CHALLENGE_NOT_FOUND`, `CHALLENGE_EXPIRED`, or `CHALLENGE_OPERATION_MISMATCH`. Set `false` to manage challenge lifecycle yourself. No effect without a storage adapter.                |
| `allowCrossOriginIframe`    | `boolean`                             | `false`                                      | When `false`, a ceremony whose `clientData.crossOrigin === true` is rejected with `CROSS_ORIGIN_NOT_ALLOWED` (per the W3C recommendation). Set `true` to opt into cross-origin-iframe ceremonies.                                                                                                                             |
| `originVerifier`            | `(origin: string) => boolean`         | _(unset → exact-string match)_               | Custom matcher that replaces the default exact-string comparison against `origin` when verifying `clientData.origin`. Return `true` to accept. Useful for advanced normalization or native `android:apk-key-hash:` origins.                                                                                                   |
| `metadataService`           | [`MetadataService`](#metadataservice) | _(unset)_                                    | Trust-anchor / FIDO Metadata Service provider used to anchor certificate-chain attestation formats. The RP supplies the (large, frequently-updated) FIDO MDS data; the package never fetches it. See [Attestation Verification](#attestation-verification).                                                                   |
| `requireTrustedAttestation` | `boolean`                             | `false`                                      | When `true` and `attestationType !== 'none'`, registration is rejected with `ATTESTATION_NOT_TRUSTED` unless the attestation statement was cryptographically verified **and** trust-anchored. When `false`, a non-trust-anchored attestation is allowed but logged as a warning. No effect when `attestationType === 'none'`. |

> **Default change in 2.3.0:** `enforceChallengeStore` defaults to `true` and
> `allowCrossOriginIframe` defaults to `false`. Integrations that previously relied
> on reusing a challenge across verifications, or on cross-origin-iframe
> ceremonies, must opt out explicitly. See the migration guide for upgrade notes.

### Registration Types

#### GenerateRegistrationOptionsParams

```typescript
interface GenerateRegistrationOptionsParams {
  user: UserModel;
  excludeCredentials?: WebAuthnCredential[];
  authenticatorSelection?: Partial<AuthenticatorSelectionCriteria>;
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  extensions?: Record<string, unknown>;
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  rpIcon?: string;
}
```

#### PublicKeyCredentialCreationOptionsJSON

Complete WebAuthn registration options following W3C spec, including:

- RP information with optional icon
- User information
- Challenge
- Supported algorithms
- Authenticator selection criteria
- Extensions
- Timeout
- Attestation preference

#### VerifiedRegistrationInfo

Returned in `{ verified, registrationInfo }` from `verifyRegistration`.

```typescript
interface VerifiedRegistrationInfo {
  credential: {
    id: Base64URLString;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
    alg?: COSEAlgorithmIdentifier; // new in 2.3.0
  };
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  origin: string;
  rpID?: string;
  aaguid?: string;
  userVerified: boolean;
  fmt?: AttestationFormat;
  attestationVerified?: boolean;
  attestationObject?: Uint8Array;
  clientDataJSON?: Uint8Array;
  trustPath?: string[]; // new in 2.3.0
  clientExtensionResults?: AuthenticationExtensionsClientOutputs; // new in 2.3.0
}
```

Fields added in 2.3.0:

- `credential.alg` - The COSE algorithm the credential registered with. Persist it
  onto [`WebAuthnCredential.alg`](#webauthncredential) so the algorithm is pinned
  at authentication.
- `trustPath` - The verified attestation certificate chain (leaf-first) as PEM
  strings. Present only for certificate-chain attestation formats that were
  cryptographically verified **and** trust-anchored to a supplied/bundled root
  (see [Attestation Verification](#attestation-verification)).
- `clientExtensionResults` - Client extension outputs parsed from
  `response.clientExtensionResults` (at minimum `credProps.rk`, the only reliable
  signal that a discoverable credential was actually created). Present only when
  the client returned extension results.

> **Mapping to `WebAuthnCredential`.** `credentialDeviceType` and
> `credentialBackedUp` live on the parent object (not on `.credential`). When
> building the stored credential, map them to `deviceType` / `backedUp`, and copy
> `credential.alg` → `alg` and the top-level `userVerified` → `userVerified`.

#### AuthenticationExtensionsClientOutputs

Client extension outputs returned by the authenticator/client (WebAuthn L3
`AuthenticationExtensionsClientOutputs`). All fields optional; only extensions the
client processed are present.

```typescript
interface AuthenticationExtensionsClientOutputs {
  appid?: boolean;
  credProps?: { rk?: boolean };
  prf?: {
    enabled?: boolean;
    results?: { first?: string; second?: string }; // base64url when present
  };
  largeBlob?: { supported?: boolean; blob?: string; written?: boolean };
  /** @deprecated Legacy hmac-secret flag; use `prf` instead. */
  hmacCreateSecret?: boolean;
}
```

> **Modernized in 2.3.0:** added `prf` (the modern replacement for the legacy
> `hmac-secret`) and `largeBlob`; `hmacCreateSecret` is retained but deprecated.

### Authentication Types

#### GenerateAuthenticationOptionsParams

```typescript
interface GenerateAuthenticationOptionsParams {
  allowCredentials?: WebAuthnCredential[];
  userVerification?: UserVerificationRequirement;
  rpId?: string;
  extensions?: Record<string, unknown>;
  timeout?: number;
}
```

#### VerifiedAuthenticationInfo

Returned in `{ verified, authenticationInfo }` from `verifyAuthentication`.

```typescript
interface VerifiedAuthenticationInfo {
  newCounter: number;
  origin: string;
  rpID?: string;
  userVerified: boolean;
  credentialID: Base64URLString;
  userHandle?: Base64URLString; // new in 2.3.0
  backupStateChanged?: boolean; // new in 2.3.0 (advisory)
  userVerificationDowngraded?: boolean; // new in 2.3.0 (advisory)
  counterSupported?: boolean; // new in 2.3.0 (advisory)
  clientExtensionResults?: AuthenticationExtensionsClientOutputs; // new in 2.3.0
}
```

Fields added in 2.3.0:

- `userHandle` - The `userHandle` returned by the authenticator for discoverable
  credentials, when present. Already validated against `credential.webAuthnUserID`
  during verification (`USER_HANDLE_MISMATCH` on a mismatch).
- `backupStateChanged` _(advisory)_ - `true` when the authenticator's backup-state
  (BS) flag differs from the credential's stored `backedUp` value — a possible
  credential migration/clone signal. The relying party decides policy.
- `userVerificationDowngraded` _(advisory)_ - `true` when the credential registered
  with user verification but this assertion presented UV=false. Requires the
  stored credential's `userVerified` to be populated.
- `counterSupported` _(advisory)_ - `false` when both the stored and asserted
  signature counters are 0, meaning counter-based clone detection is effectively a
  no-op for this authenticator (common for platform passkeys).
- `clientExtensionResults` - Client extension outputs parsed from
  `response.clientExtensionResults` (e.g. `appid`, `prf`, `largeBlob`). Present
  only when the client returned extension results.

#### WebAuthnCredential

The stored credential (passkey) record the relying party persists and passes to
`verifyAuthentication`.

```typescript
interface WebAuthnCredential {
  id: Base64URLString;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  deviceType: CredentialDeviceType;
  backedUp: boolean;
  alg?: COSEAlgorithmIdentifier; // new in 2.3.0
  userVerified?: boolean; // new in 2.3.0
  userId: string | number;
  webAuthnUserID: Base64URLString;
  createdAt: Date;
  lastUsedAt?: Date;
  aaguid?: string;
  userAgent?: string;
}
```

Fields added in 2.3.0:

- `alg` - The COSE algorithm the credential registered with (e.g. ES256 = `-7`).
  When set, `verifyAuthentication` enforces that the asserted key uses the same
  algorithm (`ALGORITHM_MISMATCH`). Populate from
  `VerifiedRegistrationInfo.credential.alg`.
- `userVerified` - Whether user verification was performed at registration. When
  set, `verifyAuthentication` reports `userVerificationDowngraded` if a later
  assertion presents UV=false. Populate from the top-level
  `VerifiedRegistrationInfo.userVerified`.

## Attestation Verification

New in 2.3.0: the package performs full per-format attestation-statement
verification during `verifyRegistration`. Verification is **offline-by-default**
and **synchronous** — trust anchors are never fetched from the network. The
relying party supplies certificate-chain roots through a
[`MetadataService`](#metadataservice); the only bundled root is the Apple WebAuthn
Root CA.

### How `attestationVerified` is reported (honest framing)

`VerifiedRegistrationInfo.attestationVerified` is `true` **only** when the
attestation statement was cryptographically verified **and** (for
certificate-chain formats) trust-anchored to a known root. A statement that
verifies cryptographically but cannot be anchored to a trusted root reports
`attestationVerified: false` rather than a false positive. Verification only
**throws** when a present statement is cryptographically invalid (bad signature,
nonce/key/challenge mismatch, or malformed structure) — never merely because a
trust anchor is missing.

`none` attestation has no statement to verify and always reports
`attestationVerified: false`.

When trust anchoring succeeds, the verified certificate chain (leaf-first, PEM) is
returned in `VerifiedRegistrationInfo.trustPath`.

### Attestation capability matrix

| Format              | Cryptographically verified | Trust-anchored → `attestationVerified: true` when…                                          | Notes                                                                                             |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `none`              | n/a                        | never (`false`)                                                                             | No statement; structurally accepted.                                                              |
| `packed` (self)     | yes                        | always on valid self-signature (`true`)                                                     | `sig` over `authData ‖ clientDataHash` with the credential key. No certificate chain.             |
| `packed` (x5c)      | yes                        | only when the x5c chain anchors to a root supplied via `metadataService`; otherwise `false` | Enforces leaf requirements (v3, OU, BasicConstraints CA=false) and the AAGUID extension match.    |
| `fido-u2f`          | yes                        | only with a `metadataService` root; otherwise `false`                                       | P-256 only; reconstructs the U2F signature base.                                                  |
| `android-key`       | yes                        | only with `metadataService` Google hardware-attestation roots; otherwise `false`            | Verifies the KeyDescription `attestationChallenge == clientDataHash`. See caveats below.          |
| `tpm`               | yes                        | only with a `metadataService` root; otherwise `false`                                       | Full `TPMS_ATTEST` / `TPMT_PUBLIC` parse + AIK signature (EKU `2.23.133.8.3`). See caveats below. |
| `apple`             | yes                        | always via the bundled Apple WebAuthn Root CA — **no `metadataService` needed**             | Verifies the nonce extension and that the leaf key matches the credential key.                    |
| `android-safetynet` | yes (JWS)                  | only with an RP-supplied GlobalSign root (none bundled); otherwise `false`. **Deprecated.** | JWS verified, nonce + `ctsProfileMatch` + timestamp checked. Prefer Play Integrity (see below).   |

#### Caveats (documented limitations)

- **No certificate revocation.** Chain verification does **not** perform CRL or
  OCSP checks. Trust is established by chain linkage + validity windows + the
  supplied root only.
- **TPM:** the AIK certificate's Subject Alternative Name (manufacturer / model /
  version) is **not** additionally asserted beyond the EKU check.
- **android-key:** the Keymaster authorization-list constraints (purpose, origin,
  etc.) beyond the attestation challenge are **not** additionally asserted.
- **android-safetynet is deprecated by Google.** It is implemented for
  completeness; new integrations should use the Play Integrity API instead. No
  GlobalSign root is bundled, so it can never trust-anchor without an RP-supplied
  root.

### Enabling trust-anchored attestation

```typescript
import {
  WebAuthnServer,
  StaticMetadataService,
  APPLE_WEBAUTHN_ROOT_CA_PEM,
} from 'webauthn-server-buildkit';

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET!,
  attestationType: 'direct',
  // Apple attestation trust-anchors via the bundled root even without this
  // service; supply roots for the other certificate-chain formats you accept.
  metadataService: new StaticMetadataService({
    defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM],
    // rootsByAaguid: { '<aaguid>': [pem, ...] },     // from a FIDO MDS blob
    // rootsByCertKeyId: { '<b64url-key-id>': [pem] }, // for fido-u2f
  }),
  // Reject registrations whose attestation can't be trust-anchored when
  // attestationType !== 'none' (default false = warn-only).
  requireTrustedAttestation: true,
});
```

### MetadataService

The FIDO Metadata Service (MDS) maps an authenticator (by AAGUID, or by its
attestation-certificate key identifier) to the trusted root certificates needed to
anchor its attestation. The MDS blob is large and frequently updated, so the
package does **not** bundle or fetch it — the relying party supplies the data
through this interface. All methods are **synchronous** by contract.

```typescript
interface MetadataService {
  getRootCertificates(query: MetadataRootQuery): string[];
  getStatement?(aaguid: string): MetadataStatement | undefined;
}

interface MetadataRootQuery {
  aaguid?: string; // lowercase, hyphenated UUID
  attestationCertificateKeyIdentifier?: string; // base64url key id (e.g. fido-u2f)
}

interface MetadataStatement {
  aaguid: string;
  description?: string;
  statusReports?: MetadataStatusReport[];
}

interface MetadataStatusReport {
  status: string; // e.g. FIDO_CERTIFIED, REVOKED, USER_VERIFICATION_BYPASS
  effectiveDate?: string; // ISO-8601
}
```

`getRootCertificates` returns the trusted root PEMs for the queried authenticator,
or an empty array when none are known (the format verifier then reports the
attestation as not trust-anchored rather than rejecting it).

### StaticMetadataService

A fully in-memory `MetadataService` built from RP-supplied data. Lookups try the
AAGUID map first, then the cert-key-id map, then `defaultRoots`.

```typescript
new StaticMetadataService(options?: StaticMetadataServiceOptions)

interface StaticMetadataServiceOptions {
  /** Roots keyed by authenticator AAGUID (lowercase, hyphenated UUID). */
  rootsByAaguid?: Record<string, string[]>;
  /** Roots keyed by attestation-cert key identifier (base64url) — e.g. fido-u2f. */
  rootsByCertKeyId?: Record<string, string[]>;
  /** Fallback roots when neither lookup matches (e.g. a single bundled vendor root). */
  defaultRoots?: string[];
  /** FIDO MDS metadata statements keyed by AAGUID. */
  statements?: Record<string, MetadataStatement>;
}
```

```typescript
const metadataService = new StaticMetadataService({
  defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM],
});
```

### Attestation verifier exports

For advanced use (e.g. verifying an attestation statement outside the registration
flow, or composing a custom `MetadataService`), the per-format verifiers, X.509
helpers, the bundled Apple root, and the verifier-contract types are exported from
the package entry point:

- **Bundled root / provider:** `APPLE_WEBAUTHN_ROOT_CA_PEM`, `StaticMetadataService`
- **Per-format verifiers:** `verifyAppleAttestation`, `verifyFidoU2fAttestation`,
  `verifyPackedAttestation`, `verifyAndroidKeyAttestation`, `verifyTpmAttestation`,
  `verifyAndroidSafetyNetAttestation`
- **X.509 helpers:** `verifyCertChain`, `publicKeyMatchesCOSE`, `parseCert`,
  `parseCertPem`, `derToX509`, `pemToDer`, `isValidAt`, `isIssuedBy`
- **DER/ASN.1 reader:** `findExtension`, `readTLV`, `readSequence`, `readSet`,
  `decodeOID`, `readOctetString`, `readInteger`, `readBitString`, `ASN1_TAG`,
  `readChildren`
- **Types:** `AttestationVerifierInput`, `AttestationVerificationResult`,
  `AttestationFormatVerifier`, `StaticMetadataServiceOptions`, `Asn1Node`,
  `MetadataService`, `MetadataRootQuery`, `MetadataStatement`,
  `MetadataStatusReport`

```typescript
type AttestationFormatVerifier = (input: AttestationVerifierInput) => AttestationVerificationResult;

interface AttestationVerifierInput {
  fmt: AttestationFormat;
  attStmt: unknown;
  authData: Uint8Array;
  clientDataHash: Uint8Array;
  credentialPublicKey: COSEPublicKey;
  aaguid?: Uint8Array;
  metadataService?: MetadataService;
}

interface AttestationVerificationResult {
  fmt: AttestationFormat;
  attestationVerified: boolean;
  trustPath?: string[];
  aaguid?: string;
}
```

## Storage Adapter Interface

```typescript
interface StorageAdapter {
  users: {
    findById(id: string | number): Promise<UserModel | null>;
    findByUsername(username: string): Promise<UserModel | null>;
    create(user: Omit<UserModel, 'id'>): Promise<UserModel>;
    update(id: string | number, updates: Partial<UserModel>): Promise<UserModel | null>;
    delete(id: string | number): Promise<boolean>;
  };

  credentials: {
    findById(id: Base64URLString): Promise<WebAuthnCredential | null>;
    findByUserId(userId: string | number): Promise<WebAuthnCredential[]>;
    findByWebAuthnUserId(webAuthnUserId: Base64URLString): Promise<WebAuthnCredential[]>;
    create(credential: Omit<WebAuthnCredential, 'createdAt'>): Promise<WebAuthnCredential>;
    updateCounter(id: Base64URLString, counter: number): Promise<boolean>;
    updateLastUsed(id: Base64URLString): Promise<boolean>;
    delete(id: Base64URLString): Promise<boolean>;
    deleteByUserId(userId: string | number): Promise<boolean>;
  };

  challenges: {
    create(challenge: ChallengeData): Promise<boolean>;
    find(challenge: string): Promise<ChallengeData | null>;
    delete(challenge: string): Promise<boolean>;
    deleteExpired(): Promise<boolean>;
  };

  sessions: {
    create(sessionId: string, data: SessionData): Promise<boolean>;
    find(sessionId: string): Promise<SessionData | null>;
    update(sessionId: string, data: Partial<SessionData>): Promise<boolean>;
    delete(sessionId: string): Promise<boolean>;
    deleteExpired(): Promise<boolean>;
    deleteByUserId(userId: string | number): Promise<boolean>;
  };
}
```

> **Note:** `enforceChallengeStore` (new in 2.3.0) calls `challenges.find()` on the
> verify path. A custom adapter's `find()` should return `null` for an absent or
> expired challenge; the server additionally re-checks `expiresAt` as
> defense-in-depth for adapters that do not filter expiry themselves.

## Mobile Attestation Functions

> **Opt-in & not cryptographically verified.** The mobile JSON attestation path is
> handled internally by `verifyRegistration` only when `enableMobileAttestation: true`
> is set on the server config (default `false`). It trusts a client-supplied
> `{ publicKey, credentialId }` payload **without** verifying a challenge signature,
> so enable it only on a trusted client/transport. These helper functions are
> internal to the registration module and are **not** exported from the package
> entry point; call `verifyRegistration` (with the flag enabled) rather than using
> them directly.

These functions handle attestation data from mobile platforms (iOS/Android) that may use a simplified format instead of standard WebAuthn attestation objects.

### isMobileAttestation

```typescript
function isMobileAttestation(response: RegistrationCredentialJSON): boolean;
```

Detects if a registration response is in mobile attestation format.

#### Parameters

- `response` - Registration response from the client

#### Returns

`true` if the response appears to be mobile attestation format (has `publicKey` and `signature` fields instead of standard attestation object).

#### Example

```typescript
import { isMobileAttestation } from 'webauthn-server-buildkit';

if (isMobileAttestation(response)) {
  // Use mobile attestation validation
  const result = await validateMobileAttestation(response, challenge, rpId);
} else {
  // Use standard WebAuthn verification
  const result = await webauthn.verifyRegistration(response, challenge);
}
```

### validateMobileAttestation

```typescript
async function validateMobileAttestation(
  response: RegistrationCredentialJSON,
  expectedChallenge: string,
  rpId: string,
  expectedOrigin?: string,
): Promise<{
  verified: boolean;
  registrationInfo?: VerifiedRegistrationInfo;
}>;
```

Validates a mobile attestation response.

#### Parameters

- `response` - Mobile attestation response
- `expectedChallenge` - The challenge that was sent to the client
- `rpId` - Relying party ID
- `expectedOrigin` - Optional custom origin (defaults to platform-specific origin based on detected platform)

#### Platform Detection

The function automatically detects the platform from the origin:

- iOS: Origins starting with `ios-app://`
- Android: Origins starting with `android-app://`

#### Example

```typescript
import { validateMobileAttestation } from 'webauthn-server-buildkit';

const result = await validateMobileAttestation(
  response,
  challenge,
  'example.com',
  'ios-app://com.example.app', // Optional: explicit origin
);

if (result.verified) {
  // Store credential
  const credential = {
    id: response.id,
    publicKey: result.registrationInfo.credentialPublicKey,
    counter: result.registrationInfo.counter,
    // ...
  };
}
```

### isCborParsingError

```typescript
function isCborParsingError(error: unknown): boolean;
```

Detects if an error is related to CBOR parsing failures.

#### Parameters

- `error` - Any caught error

#### Returns

`true` if the error is related to CBOR decoding failures (useful for falling back to mobile attestation).

#### Example

```typescript
import { isCborParsingError, validateMobileAttestation } from 'webauthn-server-buildkit';

try {
  // Try standard verification first
  const result = await webauthn.verifyRegistration(response, challenge);
  return result;
} catch (error) {
  if (isCborParsingError(error)) {
    // Fall back to mobile attestation
    return await validateMobileAttestation(response, challenge, rpId);
  }
  throw error;
}
```

## Error Types

The package exports specific error classes for different scenarios. All extend
`WebAuthnError` (so `instanceof WebAuthnError` matches any of them):

| Class                 | Default `statusCode` |
| --------------------- | -------------------- |
| `WebAuthnError`       | `400`                |
| `RegistrationError`   | `400`                |
| `VerificationError`   | `400`                |
| `AuthenticationError` | `401`                |
| `SessionError`        | `401`                |
| `ConfigurationError`  | `500`                |
| `StorageError`        | `500`                |

Every error carries a stable, machine-readable `code` and a suggested HTTP
`statusCode`:

```typescript
class WebAuthnError extends Error {
  readonly code: WebAuthnErrorCode | (string & {});
  readonly statusCode: number; // 400 | 401 | 500
}
```

- `code` - A [`WebAuthnErrorCode`](#webauthnerrorcode). Branch on this rather than
  on the human-readable message.
- `statusCode` _(documented in 2.3.0)_ - A suggested HTTP status: `400`
  (Bad Request) for malformed/invalid input and most verification failures, `401`
  (Unauthorized) for authentication/session failures, and `500`
  (Internal Server Error) for configuration/storage problems.

Catch specifically by class or branch on `code`:

```typescript
import { WebAuthnError, RegistrationError, VerificationError } from 'webauthn-server-buildkit';

try {
  const result = await webauthn.verifyRegistration(response, challenge);
} catch (error) {
  if (error instanceof WebAuthnError) {
    if (error.code === 'CREDENTIAL_ALREADY_REGISTERED') {
      // Already-registered authenticator
    }
    res.status(error.statusCode).json({ error: error.code });
  } else {
    throw error;
  }
}
```

### WebAuthnErrorCode

New in 2.3.0: `WebAuthnErrorCode` is exported as a type-only union of every code
the package throws. `WebAuthnError.code` is typed as an **open** union
(`WebAuthnErrorCode | (string & {})`), so consumers get autocomplete on the known
codes while custom/future codes still compile.

```typescript
import type { WebAuthnErrorCode } from 'webauthn-server-buildkit';
```

The known codes, by area:

- **Challenge lifecycle:** `CHALLENGE_NOT_FOUND`, `CHALLENGE_OPERATION_MISMATCH`,
  `CHALLENGE_EXPIRED`, `CHALLENGE_MISMATCH`
- **Algorithm / COSE key:** `ALGORITHM_MISMATCH`,
  `UNSUPPORTED_CREDENTIAL_ALGORITHM`, `UNSUPPORTED_ALGORITHM`,
  `UNSUPPORTED_OKP_ALGORITHM`, `UNSUPPORTED_CURVE`, `UNSUPPORTED_KEY_TYPE`,
  `COSE_ALG_MISMATCH`, `COSE_EC2_INVALID`, `COSE_RSA_INVALID`, `COSE_OKP_INVALID`,
  `COSE_DECODE_ERROR`, `COSE_INVALID_FORMAT`, `COSE_MISSING_KTY`,
  `COSE_UNSUPPORTED_KEY_TYPE`, `COSE_UNKNOWN_ALGORITHM`
- **CBOR:** `CBOR_DECODE_ERROR`, `CBOR_DECODE_FIRST_ERROR`, `CBOR_ENCODE_ERROR`
- **Client data / origin / ceremony:** `INVALID_CLIENT_DATA_TYPE`,
  `ORIGIN_MISMATCH`, `RPID_MISMATCH`, `CROSS_ORIGIN_NOT_ALLOWED`
- **Authenticator data:** `AUTHENTICATOR_DATA_TOO_SHORT`,
  `AUTHENTICATOR_DATA_TRAILING_BYTES`,
  `AUTHENTICATOR_DATA_INVALID_CREDENTIAL_ID`,
  `AUTHENTICATOR_DATA_INVALID_CREDENTIAL_DATA`, `USER_PRESENCE_REQUIRED`,
  `USER_VERIFICATION_REQUIRED`, `MISSING_CREDENTIAL_DATA`
- **Registration:** `REGISTRATION_ERROR`, `REGISTRATION_VERIFICATION_FAILED`,
  `CREDENTIAL_ALREADY_REGISTERED`, `ATTESTATION_PARSE_ERROR`,
  `ATTESTATION_SIGNATURE_INVALID`
- **Attestation statement (per-format):** `ATTESTATION_INVALID`,
  `ATTESTATION_NONCE_MISMATCH`, `ATTESTATION_KEY_MISMATCH`,
  `ATTESTATION_CHALLENGE_MISMATCH`, `ATTESTATION_CHAIN_INVALID`,
  `ATTESTATION_CERT_INVALID`, `ATTESTATION_NOT_TRUSTED`,
  `ATTESTATION_UNSUPPORTED_FORMAT`
- **Mobile attestation (opt-in JSON path):** `INVALID_MOBILE_ATTESTATION`,
  `INVALID_PLACEHOLDER_ATTESTATION`, `MOBILE_CREDENTIAL_INVALID_ATTESTATION`,
  `MOBILE_ATTESTATION_MISSING_CREDENTIAL_ID`,
  `MOBILE_ATTESTATION_INVALID_PUBLIC_KEY`,
  `MOBILE_ATTESTATION_INVALID_PUBLIC_KEY_FORMAT`
- **Authentication:** `AUTHENTICATION_ERROR`,
  `AUTHENTICATION_VERIFICATION_FAILED`, `CREDENTIAL_ID_MISMATCH`,
  `USER_HANDLE_MISMATCH`, `COUNTER_ERROR`, `SIGNATURE_VERIFICATION_FAILED`
- **Verification (generic):** `VERIFICATION_ERROR`
- **Configuration / storage:** `CONFIGURATION_ERROR`, `STORAGE_ERROR`,
  `STORAGE_REQUIRED`
- **Session:** `SESSION_ERROR`, `SESSION_EXPIRED`, `SESSION_NOT_FOUND`,
  `INVALID_SESSION`, `INVALID_TOKEN`, `TOKEN_CREATION_FAILED`

## Usernameless (discoverable-credential) flow

New in 2.3.0: the API now supports usernameless login end-to-end. The two pieces
that make it safe are the `webAuthnUserId` returned at registration and the
`userHandle` validation at authentication.

1. **At registration**, persist `webAuthnUserId` (from `createRegistrationOptions`)
   onto the stored credential's `webAuthnUserID`, and `credential.alg` /
   top-level `userVerified` (from `verifyRegistration`) onto the credential:

   ```typescript
   const { options, webAuthnUserId } = await webauthn.createRegistrationOptions(user);
   // ... client creates the credential, you receive `response` ...
   const { verified, registrationInfo } = await webauthn.verifyRegistration(
     response,
     challenge,
     undefined,
     {
       existingCredentialIds: existingIdsForUser, // CREDENTIAL_ALREADY_REGISTERED on dup
     },
   );
   if (verified && registrationInfo) {
     await db.credentials.create({
       id: registrationInfo.credential.id,
       publicKey: registrationInfo.credential.publicKey,
       counter: registrationInfo.credential.counter,
       transports: registrationInfo.credential.transports,
       alg: registrationInfo.credential.alg, // pins algorithm at auth
       deviceType: registrationInfo.credentialDeviceType,
       backedUp: registrationInfo.credentialBackedUp,
       userVerified: registrationInfo.userVerified, // enables UV-downgrade signal
       userId: user.id,
       webAuthnUserID: webAuthnUserId, // <-- matched against userHandle at auth
       createdAt: new Date(),
     });
   }
   ```

2. **At authentication**, call `createAuthenticationOptions()` with **no**
   `allowCredentials` so the client offers a discoverable credential. On verify,
   look the credential up by the assertion's `response.userHandle` (via
   `findByWebAuthnUserId`); `verifyAuthentication` then re-checks the
   `userHandle === credential.webAuthnUserID` binding for you and throws
   `USER_HANDLE_MISMATCH` if it does not hold.

   ```typescript
   const { options, challenge } = await webauthn.createAuthenticationOptions();
   // ... client returns `response` with response.response.userHandle ...
   const matches = await db.credentials.findByWebAuthnUserId(response.response.userHandle!);
   const credential = matches.find((c) => c.id === response.id);
   const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
     response,
     challenge,
     credential!,
   );
   ```

## Complete Example

```typescript
import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

// Initialize with all options
const webauthn = new WebAuthnServer({
  rpName: 'My Secure App',
  rpID: 'example.com',
  rpIcon: 'https://example.com/icon.png',
  origin: ['https://example.com', 'https://app.example.com'],
  sessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  encryptionSecret: process.env.ENCRYPTION_SECRET!,
  attestationType: 'indirect',
  userVerification: 'preferred',
  authenticatorSelection: {
    authenticatorAttachment: 'cross-platform',
    residentKey: 'preferred',
    userVerification: 'preferred',
  },
  supportedAlgorithms: [-7, -257], // ES256, RS256
  challengeSize: 32,
  timeout: 300000, // 5 minutes
  preferredAuthenticatorType: 'securityKey',
  storageAdapter: new MemoryStorageAdapter(),
  debug: true,
  logger: (level, message, data) => {
    console.log(`[${level}] ${message}`, data);
  },
});

// Use with full customization
const { options } = await webauthn.createRegistrationOptions(user, {
  extensions: {
    credProps: true,
    largeBlob: { support: 'preferred' },
    minPinLength: true,
  },
  timeout: 120000,
  attestation: 'direct',
  authenticatorSelection: {
    authenticatorAttachment: 'platform',
    residentKey: 'required',
  },
});
```
