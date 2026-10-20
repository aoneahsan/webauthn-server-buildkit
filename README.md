<div align="center">

<img src="https://raw.githubusercontent.com/aoneahsan/webauthn-server-buildkit/main/assets/logo.svg" alt="WebAuthn Server Buildkit logo" width="120" />

<h1>webauthn-server-buildkit</h1>

<p><strong>Framework-independent WebAuthn server for Node.js — passkeys, attestation, encrypted sessions.</strong></p>

[![npm version](https://img.shields.io/npm/v/webauthn-server-buildkit.svg)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![downloads](https://img.shields.io/npm/dm/webauthn-server-buildkit.svg)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![license](https://img.shields.io/npm/l/webauthn-server-buildkit.svg)](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/webauthn-server-buildkit.svg)](https://www.npmjs.com/package/webauthn-server-buildkit)
[![CI](https://github.com/aoneahsan/webauthn-server-buildkit/actions/workflows/ci.yml/badge.svg)](https://github.com/aoneahsan/webauthn-server-buildkit/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/webauthn-server-buildkit.svg)](https://nodejs.org)

[Docs](https://webauthn-server-buildkit-docs.aoneahsan.com) · [npm](https://www.npmjs.com/package/webauthn-server-buildkit) · [GitHub](https://github.com/aoneahsan/webauthn-server-buildkit) · [Changelog](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/CHANGELOG.md) · [AI Guide](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/AI-INTEGRATION-GUIDE.md) · [Support](https://github.com/aoneahsan/webauthn-server-buildkit/issues)

</div>

> [!IMPORTANT]
> This package requires **Node.js `>=24.13.0`** and ships **no automated test suite** — see
> [Limitations](#limitations) before adopting it for a security-critical deployment.

A server-side library for the WebAuthn registration and authentication ceremonies: it generates options,
verifies the authenticator's response, and issues an encrypted session token. It is transport- and
framework-agnostic — you own the HTTP layer and the database, the library owns the cryptography. Attestation
is verified per format, and the result distinguishes _cryptographically valid_ from _trust-anchored_ instead
of collapsing the two.

|                  |                                                             |
| ---------------- | ----------------------------------------------------------- |
| **Version**      | `2.3.2`                                                     |
| **License**      | MIT                                                         |
| **Node**         | `>=24.13.0`                                                 |
| **Platforms**    | Node.js server only (not a browser or React Native library) |
| **Install size** | ~149 kB packed · ~633 kB unpacked                           |
| **Types**        | Bundled `.d.ts` + `.d.cts` (ESM + CJS)                      |
| **Runtime deps** | 1 (`cbor-x`, bundled)                                       |
| **Status**       | Stable · actively maintained · no automated tests           |

<a id="table-of-contents"></a>

## 🧭 Table of Contents&nbsp;[#](#table-of-contents)

- [💡 Why webauthn-server-buildkit](#why-webauthn-server-buildkit)
- [✨ Features](#features)
- [📋 Requirements](#requirements)
- [📦 Installation](#installation)
- [🚀 Quick Start](#quick-start)
- [🛠️ Usage](#usage)
- [⚙️ Configuration](#configuration)
- [🔧 API Reference](#api-reference)
- [🧩 Types](#types)
- [🧪 Examples](#examples)
- [🎛️ Advanced Features](#advanced-features)
- [🚑 Recovery & Troubleshooting](#recovery-troubleshooting)
- [🚧 Limitations](#limitations)
- [📚 Documentation](#documentation)
- [🔄 Changelog](#changelog)
- [🤝 Contributing](#contributing)
- [💬 Support](#support)
- [📄 License](#license)
- [👤 Author](#author)
- [🔗 Links](#links)
- [🏷️ Keywords](#keywords)

<a id="why-webauthn-server-buildkit"></a>

## 💡 Why webauthn-server-buildkit&nbsp;[#](#why-webauthn-server-buildkit)

WebAuthn puts the hard parts on the server. The browser hands you a blob; you have to decode CBOR, parse
authenticator data, check an RP-ID hash, validate flags, verify a COSE signature, and decide whether an
attestation statement means anything. Getting any of it subtly wrong produces a login that works perfectly
and protects nothing.

This library does that verification and hands back a typed result. It deliberately stops at the boundary of
your application: it never opens a socket, never touches your database directly, and never fetches metadata
over the network.

|                       | `webauthn-server-buildkit`                                  | A hand-rolled implementation     |
| --------------------- | ----------------------------------------------------------- | -------------------------------- |
| Ceremony verification | Challenge, origin, RP-ID hash, flags, counter, signature    | Each one is yours to get right   |
| Attestation           | Seven formats verified; trust-anchoring reported separately | Usually `fmt: 'none'` and a hope |
| Sessions              | AES-256-GCM tokens with HKDF-SHA256 derivation included     | Bring your own                   |
| Storage               | Any database via one adapter interface                      | Coupled to whatever you picked   |
| Network calls         | None — trust anchors are supplied by you                    | —                                |

**Not the right tool when** — you need a hosted identity provider (use Auth0, Clerk or Stytch); you want the
browser-side `navigator.credentials` calls (this is server-only — pair it with a client library); you need
FIDO MDS blobs fetched and refreshed for you (you supply them); you are on Node older than 24.13; or your
compliance process requires a vendored test suite in the dependency itself (there is none — see
[Limitations](#limitations)).

<a id="features"></a>

## ✨ Features&nbsp;[#](#features)

- **Full ceremony verification** — challenge, origin, RP-ID hash, user-presence and user-verification flags, signature counter, and the assertion signature, for both registration and authentication.
- **Ten signature algorithms** — ES256/384/512, RS256/384/512, PS256/384/512 and Ed25519, all through Node's native `crypto`. The algorithm a credential registered with is pinned and re-checked at every assertion.
- **Per-format attestation** — `none`, `packed` (self and x5c), `fido-u2f`, `android-key`, `tpm`, `android-safetynet` and `apple` are each cryptographically verified, with trust-anchoring reported as a separate fact.
- **Single-use challenges** — with a storage adapter configured, a challenge is looked up, checked for expiry and operation scope, and consumed so it cannot be replayed.
- **Encrypted sessions** — AES-256-GCM tokens with HKDF-SHA256 key derivation, a 12-byte IV, and field-length validation before decryption.
- **Storage-agnostic** — one adapter interface covers users, credentials, challenges and sessions; an in-memory adapter is included for development.
- **Framework-independent** — Express, Fastify, Koa, Next.js, Hono or a raw `http` server; the library never sees your request object.
- **Offline by design** — no network calls, ever. Trust anchors come from you.
- **Dual ESM + CJS** with separate type declarations for each, and one bundled runtime dependency.

<a id="requirements"></a>

## 📋 Requirements&nbsp;[#](#requirements)

| Requirement       | Version             | Why                                                                                                                                    |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | `>=24.13.0`         | Native `crypto` APIs used for Ed25519 and COSE-to-JWK key import. This floor excludes Node 20 and 22 LTS — check it before adopting.   |
| TypeScript        | `>=5.5` recommended | Only for consumers using the bundled types; built and type-checked with TypeScript 6.                                                  |
| A storage adapter | —                   | Optional for a first run (an in-memory one is included), **required in production** and required for single-use challenge enforcement. |

<a id="installation"></a>

## 📦 Installation&nbsp;[#](#installation)

```bash
yarn add webauthn-server-buildkit
```

No post-install step, no native build, no configuration file. Provide an `encryptionSecret` of at least 32
characters and you are ready — see [Quick Start](#quick-start).

<a id="quick-start"></a>

## 🚀 Quick Start&nbsp;[#](#quick-start)

```ts
import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
  encryptionSecret: process.env.ENCRYPTION_SECRET!, // 32+ characters
  storageAdapter: new MemoryStorageAdapter(), // development only
});

// 1. Server: create the registration options and send them to the browser.
const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions({
  id: 1,
  username: 'ada@example.com',
});

// 2. Browser: navigator.credentials.create({ publicKey: options }) -> `response`.

// 3. Server: verify what came back.
const { verified, registrationInfo } = await webauthn.verifyRegistration(response, challenge);

if (verified && registrationInfo) {
  await saveCredential({
    id: registrationInfo.credential.id,
    publicKey: registrationInfo.credential.publicKey,
    counter: registrationInfo.credential.counter,
    alg: registrationInfo.credential.alg, // persist to enable algorithm pinning
    webAuthnUserID: webAuthnUserId, // persist to enable usernameless login
    userId: 1,
  });
}
```

Store `alg` and `webAuthnUserID` — two later protections read them back, and a credential saved without them
silently loses those checks.

<a id="usage"></a>

## 🛠️ Usage&nbsp;[#](#usage)

### Authenticating

```ts
const { options, challenge } = await webauthn.createAuthenticationOptions({
  allowCredentials: await getCredentialsForUser(userId),
});

// ... browser runs navigator.credentials.get({ publicKey: options }) ...

const credential = await getCredentialById(response.id);
const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
  response,
  challenge,
  credential,
);
```

`authenticationInfo` carries advisory signals worth acting on: `backupStateChanged` (possible credential
migration or clone), `userVerificationDowngraded` (registered with user verification, asserted without), and
`counterSupported: false` (the authenticator does not increment its counter, so clone detection is inert —
common for platform passkeys). Full guide:
[Authentication](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/authentication).

### Issuing a session

```ts
const token = await webauthn.createSession(userId, credentialId, authenticationInfo.userVerified);
const { valid, sessionData } = await webauthn.validateSession(token);
await webauthn.revokeSession(token);
```

Tokens are self-contained and encrypted; `revokeSession` needs a storage adapter to have anything to revoke.
Full guide: [Sessions](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/sessions).

### Plugging in a database

Implement `StorageAdapter` — four namespaces (`users`, `credentials`, `challenges`, `sessions`) of plain
async methods, with no ORM assumptions. Worked MongoDB, PostgreSQL and Redis adapters:
[Storage adapters](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/storage-adapters).

<a id="configuration"></a>

## ⚙️ Configuration&nbsp;[#](#configuration)

| Option                      | Type                                               | Default       | What it does                                                                                              |
| --------------------------- | -------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `rpName`                    | `string`                                           | —             | **Required.** Human-readable relying-party name.                                                          |
| `rpID`                      | `string`                                           | —             | **Required.** The domain, with no scheme or port.                                                         |
| `origin`                    | `string \| string[]`                               | —             | **Required.** Expected `clientData.origin` value(s).                                                      |
| `encryptionSecret`          | `string`                                           | —             | **Required.** 32+ characters, used to derive the session key.                                             |
| `storageAdapter`            | `StorageAdapter`                                   | —             | Persistence. Without it, challenge enforcement and revocation are unavailable.                            |
| `sessionDuration`           | `number`                                           | `86400000`    | Session lifetime in milliseconds.                                                                         |
| `attestationType`           | `'none' \| 'indirect' \| 'direct' \| 'enterprise'` | `'none'`      | What to request from the authenticator.                                                                   |
| `userVerification`          | `'required' \| 'preferred' \| 'discouraged'`       | `'preferred'` | User-verification requirement.                                                                            |
| `supportedAlgorithms`       | `COSEAlgorithmIdentifier[]`                        | `[-7, -257]`  | Allowlist, enforced at registration **and** authentication.                                               |
| `challengeSize`             | `number`                                           | `32`          | Challenge length in bytes.                                                                                |
| `timeout`                   | `number`                                           | `60000`       | Ceremony timeout in milliseconds.                                                                         |
| `enforceChallengeStore`     | `boolean`                                          | `true`        | Require, scope-check and consume the challenge from storage. Only applies when a `storageAdapter` is set. |
| `allowCrossOriginIframe`    | `boolean`                                          | `false`       | When `false`, a ceremony with `clientData.crossOrigin === true` is rejected.                              |
| `originVerifier`            | `(origin: string) => boolean`                      | —             | Replaces the default exact-string origin match.                                                           |
| `metadataService`           | `MetadataService`                                  | —             | Supplies attestation trust anchors. See [Advanced Features](#advanced-features).                          |
| `requireTrustedAttestation` | `boolean`                                          | `false`       | Reject attestation that cannot be trust-anchored.                                                         |
| `enableMobileAttestation`   | `boolean`                                          | `false`       | Opt into a non-standard JSON path that performs **no** cryptographic attestation.                         |
| `debug` / `logger`          | `boolean` / `fn`                                   | `false` / —   | Diagnostics.                                                                                              |

Every option in detail:
[Configuration reference](https://webauthn-server-buildkit-docs.aoneahsan.com/api/configuration).

<a id="api-reference"></a>

## 🔧 API Reference&nbsp;[#](#api-reference)

| Export                                                       | Signature                                                                                  | Docs                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `WebAuthnServer`                                             | `new (config: WebAuthnServerConfig)`                                                       | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/webauthn-server)   |
| `.createRegistrationOptions`                                 | `(user, params?) => Promise<{ options, challenge, webAuthnUserId }>`                       | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/registration)   |
| `.verifyRegistration`                                        | `(response, challenge, origin?, opts?) => Promise<{ verified, registrationInfo? }>`        | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/registration)   |
| `.createAuthenticationOptions`                               | `(params?) => Promise<{ options, challenge }>`                                             | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/authentication) |
| `.verifyAuthentication`                                      | `(response, challenge, credential, origin?) => Promise<{ verified, authenticationInfo? }>` | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/authentication) |
| `.createSession`                                             | `(userId, credentialId, userVerified, extra?) => Promise<string>`                          | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/sessions)       |
| `.validateSession`                                           | `(token) => Promise<{ valid, sessionData? }>`                                              | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/sessions)       |
| `.refreshSession` · `.revokeSession` · `.revokeUserSessions` | session lifecycle                                                                          | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/sessions)       |
| `.cleanup` · `.getStorageAdapter`                            | maintenance helpers                                                                        | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/webauthn-server)   |
| `MemoryStorageAdapter`                                       | `new () => StorageAdapter`                                                                 | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/storage-adapter)   |
| `StaticMetadataService`                                      | `new (opts: StaticMetadataServiceOptions)`                                                 | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/attestation)       |
| `APPLE_WEBAUTHN_ROOT_CA_PEM`                                 | `string`                                                                                   | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/attestation)       |
| `verify*Attestation` (7 formats)                             | per-format verifiers                                                                       | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/attestation)       |
| X.509 / ASN.1 / COSE / CBOR helpers                          | low-level building blocks                                                                  | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/crypto-and-utils)  |
| Error classes · `VERSION` · `SUPPORT_CONFIG`                 | runtime values                                                                             | [→](https://webauthn-server-buildkit-docs.aoneahsan.com/api/types-and-errors)  |

<a id="types"></a>

## 🧩 Types&nbsp;[#](#types)

The types a consumer actually touches:

```ts
import type {
  WebAuthnServerConfig,
  StorageAdapter,
  UserModel,
  WebAuthnCredential,
  SessionData,
  VerifiedRegistrationInfo,
  VerifiedAuthenticationInfo,
  MetadataService,
  WebAuthnErrorCode,
} from 'webauthn-server-buildkit';
```

`WebAuthnErrorCode` is an **open** union, so a future or custom code still compiles. Every exported type:
[Types and errors](https://webauthn-server-buildkit-docs.aoneahsan.com/api/types-and-errors).

<a id="examples"></a>

## 🧪 Examples&nbsp;[#](#examples)

| Goal                                  | Example                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Minimal end-to-end script             | [basic](https://github.com/aoneahsan/webauthn-server-buildkit/tree/main/examples/basic)                            |
| Express routes for both ceremonies    | [express](https://webauthn-server-buildkit-docs.aoneahsan.com/examples/express)                                    |
| MongoDB · PostgreSQL · Redis adapters | [storage-adapters](https://github.com/aoneahsan/webauthn-server-buildkit/tree/main/docs/examples/storage-adapters) |

<a id="advanced-features"></a>

## 🎛️ Advanced Features&nbsp;[#](#advanced-features)

- **Attestation with honest trust-anchoring** — a statement can be cryptographically valid yet chain to no
  root you trust. `attestationVerified` is `true` only when it is _both_ verified and anchored; the two are
  never conflated. `apple` anchors against the bundled Apple WebAuthn Root CA with no extra setup; every
  other certificate-chain format needs roots you supply. Per-format matrix and its stated gaps:
  [Attestation guide](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/attestation).
- **Supplying trust anchors** — `StaticMetadataService` takes a fixed set of roots, keyed by AAGUID or
  attestation-cert key id. The package never fetches or bundles FIDO MDS data; you own that feed.
  [API](https://webauthn-server-buildkit-docs.aoneahsan.com/api/attestation).
- **Usernameless / discoverable credentials** — request a resident key, persist the returned
  `webAuthnUserId`, and look the credential up by the asserted `userHandle`, which is then cross-checked
  (`USER_HANDLE_MISMATCH`).
  [Registration guide](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/registration).
- **The security model in full** — what is enforced, what is advisory, and what is delegated to you:
  [Security model](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/security-model).
- **Mobile JSON path (opt-in, unverified)** — `enableMobileAttestation` accepts a client-supplied
  `{ publicKey, credentialId }` **without any challenge signature**. It is off by default and provides no
  cryptographic guarantee. Enable it only if you control the client and enforce freshness elsewhere.

<a id="recovery-troubleshooting"></a>

## 🚑 Recovery & Troubleshooting&nbsp;[#](#recovery-troubleshooting)

| Symptom                                                   | Cause                                                                  | Fix                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CHALLENGE_NOT_FOUND` on a request that just worked       | The challenge was consumed — it is single-use — or was never persisted | Issue challenges through `createRegistrationOptions` / `createAuthenticationOptions`, which store them; do not reuse one              |
| `CHALLENGE_EXPIRED`                                       | Ceremony took longer than `timeout`                                    | Raise `timeout`, or re-issue options                                                                                                  |
| `CROSS_ORIGIN_NOT_ALLOWED`                                | The ceremony ran inside a cross-origin iframe                          | Move it to a top-level document, or set `allowCrossOriginIframe: true` deliberately                                                   |
| `ALGORITHM_MISMATCH`                                      | The assertion used an algorithm other than the one registered          | Expected — reject it. If it fires for every user, you stored the wrong `alg` at registration                                          |
| `USER_HANDLE_MISMATCH`                                    | Asserted `userHandle` differs from the stored `webAuthnUserID`         | Persist `webAuthnUserId` from `createRegistrationOptions` onto the credential                                                         |
| `ATTESTATION_NOT_TRUSTED`                                 | `requireTrustedAttestation: true` but no root matched                  | Supply the authenticator's roots via `metadataService`; only `apple` is anchored out of the box                                       |
| `CREDENTIAL_ALREADY_REGISTERED`                           | The authenticator re-registered an existing credential                 | Expected — pass `existingCredentialIds` to enforce it, and surface it to the user                                                     |
| Sessions all invalid after upgrading from 2.1.x           | Session-token format changed                                           | One-time re-authentication; there is no migration path for old tokens                                                                 |
| `attestationVerified: false` on a valid-looking statement | Verified but not trust-anchored                                        | Not a failure. Supply roots, or accept it — see [Attestation](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/attestation) |

Every code and its HTTP status:
[Error handling](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/error-handling).

<a id="limitations"></a>

## 🚧 Limitations&nbsp;[#](#limitations)

Stated plainly, because this is security code.

- **No automated test suite ships with this package, and none is present in the repository.** A Vitest suite
  of 311 tests existed at the 2.3.0 release; the whole testing infrastructure was removed on 2026-06-02. CI
  runs lint, typecheck and build only. Verification of this library today rests on code review, not on a
  regression suite — weigh that against your own risk tolerance.
- **No certificate revocation checking.** There is no CRL or OCSP lookup; the package is offline by design.
  A revoked-but-unexpired attestation certificate still verifies.
- **Trust anchors are yours to supply.** Only the Apple WebAuthn Root CA is bundled. Every other
  certificate-chain format reports `attestationVerified: false` until you provide roots — correct behaviour,
  but it means out-of-the-box attestation is meaningful for Apple authenticators only.
- **TPM attestation does not assert the AIK SAN fields** (manufacturer, model, version). The
  security-critical bindings — key match, `extraData` binding, AIK signature, AIK EKU, chain — are checked.
  The SAN is exposed via `trustPath` for you to inspect.
- **`android-key` does not enforce the Keymaster authorization list** (`purpose`, `origin`, absence of
  `allApplications`). Challenge binding, leaf-key match and hardware-root chaining are enforced.
- **`android-safetynet` is deprecated by Google** and no root for it is bundled; new authenticators do not
  emit it. Prefer Play Integrity where you control the client.
- **The mobile JSON path performs no attestation at all.** It is opt-in and off by default; nothing about it
  is a WebAuthn guarantee.
- **Server-side only.** No browser, React Native or Deno build. Node `>=24.13.0` excludes the 20 and 22 LTS
  lines.
- **Counter-based clone detection is inert for most platform passkeys**, which report a counter of `0`
  forever. `counterSupported: false` tells you when that is the case; it is not a defect in the library.
- **Rate limiting, account lockout, credential-per-user caps and audit logging are yours.** The library
  verifies a ceremony; it does not implement an authentication policy.

<a id="documentation"></a>

## 📚 Documentation&nbsp;[#](#documentation)

| Document                                                                                                                                                                                          | Read it when                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Introduction](https://webauthn-server-buildkit-docs.aoneahsan.com/intro)                                                                                                                         | deciding whether this library fits                           |
| [Installation](https://webauthn-server-buildkit-docs.aoneahsan.com/getting-started/installation) · [Quick start](https://webauthn-server-buildkit-docs.aoneahsan.com/getting-started/quick-start) | first time using the package                                 |
| [Registration](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/registration) · [Authentication](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/authentication)             | implementing either ceremony                                 |
| [Security model](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/security-model)                                                                                                       | you need to know what is enforced versus delegated           |
| [Attestation](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/attestation)                                                                                                             | deciding whether to require attestation, and supplying roots |
| [Storage adapters](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/storage-adapters)                                                                                                   | wiring a real database                                       |
| [Sessions](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/sessions) · [Error handling](https://webauthn-server-buildkit-docs.aoneahsan.com/guides/error-handling)                     | issuing tokens, or branching on a failure                    |
| [API reference](https://webauthn-server-buildkit-docs.aoneahsan.com/api/webauthn-server)                                                                                                          | you need an exact signature                                  |
| [Migration guide](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/docs/migration.md)                                                                                              | upgrading across a major version                             |
| [Security policy](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/SECURITY.md)                                                                                                    | you found a vulnerability — do not open a public issue       |
| [AI integration guide](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/AI-INTEGRATION-GUIDE.md)                                                                                   | a coding agent is implementing against it                    |

<a id="changelog"></a>

## 🔄 Changelog&nbsp;[#](#changelog)

Latest release: **`2.3.2`** — documentation only: the at-a-glance table above reported the previous version, because it is a static duplicate of `package.json`. Full history in the changelog.

<a id="contributing"></a>

## 🤝 Contributing&nbsp;[#](#contributing)

Fork and open a pull request — see
[CONTRIBUTING.md](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/CONTRIBUTING.md) for setup,
standards, and how to request collaborator access. `main` is protected: every change lands through a
reviewed PR.

Security vulnerabilities go to [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com), **not** a public issue —
see [SECURITY.md](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/SECURITY.md).

<a id="support"></a>

## 💬 Support&nbsp;[#](#support)

Questions and bugs: [open an issue](https://github.com/aoneahsan/webauthn-server-buildkit/issues).

If this package saves you time, you can support its maintenance at
[aoneahsan.com/payment](https://aoneahsan.com/payment?project-id=webauthn-server-buildkit&project-identifier=webauthn-server-buildkit).

<a id="license"></a>

## 📄 License&nbsp;[#](#license)

MIT © Ahsan Mahmood — see
[LICENSE](https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/LICENSE).

<a id="author"></a>

## 👤 Author&nbsp;[#](#author)

**Ahsan Mahmood** — [aoneahsan.com](https://aoneahsan.com) · [GitHub](https://github.com/aoneahsan) ·
[LinkedIn](https://linkedin.com/in/aoneahsan) · [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)

<a id="links"></a>

## 🔗 Links&nbsp;[#](#links)

|                          |                                                                              |
| ------------------------ | ---------------------------------------------------------------------------- |
| Documentation            | https://webauthn-server-buildkit-docs.aoneahsan.com                          |
| npm                      | https://www.npmjs.com/package/webauthn-server-buildkit                       |
| Repository               | https://github.com/aoneahsan/webauthn-server-buildkit                        |
| Issues                   | https://github.com/aoneahsan/webauthn-server-buildkit/issues                 |
| Changelog                | https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/CHANGELOG.md |
| Security policy          | https://github.com/aoneahsan/webauthn-server-buildkit/blob/main/SECURITY.md  |
| Companion client package | https://www.npmjs.com/package/capacitor-biometric-authentication             |
| W3C WebAuthn Level 3     | https://www.w3.org/TR/webauthn-3/                                            |
| Support the project      | https://aoneahsan.com/payment                                                |

<a id="keywords"></a>

## 🏷️ Keywords&nbsp;[#](#keywords)

_webauthn · passkeys · fido2 · biometric · authentication · passwordless · attestation · security · typescript · server_
