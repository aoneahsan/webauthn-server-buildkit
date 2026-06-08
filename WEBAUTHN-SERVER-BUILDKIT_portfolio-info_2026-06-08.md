# WebAuthn Server Buildkit — Portfolio Info

Reference Date: 2026-06-08
Project Type: Custom-built, framework-independent WebAuthn / passkey **server** package for TypeScript (Node.js backend library), published to npm; companion to the `capacitor-biometric-authentication` frontend plugin
Project Slug: webauthn-server-buildkit
Primary Email Reference: aoneahsan@gmail.com
Current Version Reviewed: 2.3.0
Last Portfolio Update: 2026-06-08
Next Eligible Update After: 2026-06-15

---

## Identity & Distribution (Authoritative)

| Field                                     | Value                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Project Slug                              | `webauthn-server-buildkit`                                                                                                                 |
| Public Brand Name                         | WebAuthn Server Buildkit                                                                                                                   |
| Public URL (Live)                         | https://www.npmjs.com/package/webauthn-server-buildkit (canonical public listing — the published npm package)                              |
| Repository                                | https://github.com/aoneahsan/webauthn-server-buildkit (from `package.json`; MIT, open-source)                                              |
| NPM Package                               | `webauthn-server-buildkit` — https://www.npmjs.com/package/webauthn-server-buildkit (current `latest` = 2.3.0)                             |
| Issues / Bugs                             | https://github.com/aoneahsan/webauthn-server-buildkit/issues                                                                               |
| Capacitor App ID / App Store / Play Store | N/A — this is a backend Node.js library, not an app                                                                                        |
| Browser Extension                         | N/A                                                                                                                                        |
| License                                   | MIT (LICENSE file present)                                                                                                                 |
| Author                                    | Ahsan Mahmood — aoneahsan@gmail.com — https://aoneahsan.com — https://github.com/aoneahsan                                                 |
| Payment / Support URL                     | https://aoneahsan.com/payment?project-id=webauthn-server-buildkit&project-identifier=webauthn-server-buildkit                              |
| Agent-Readable Integration                | Ships `AI-INTEGRATION-GUIDE.md` inside the published package for AI coding agents + frontend (`capacitor-biometric-authentication`) wiring |
| Companion Frontend Package                | `capacitor-biometric-authentication` — https://www.npmjs.com/package/capacitor-biometric-authentication                                    |

> All package/repo/license identifiers above are confirmed from this repository's `package.json` and `LICENSE`. There is no separate hosted marketing site; the npm listing + repo README are the public surfaces. (No entry exists yet in `project-live-urls.json` — add one at the next refresh if desired.)

---

## Brand Assets

### Logo (SVG — inline)

```svg
<svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="WebAuthn Server Buildkit logo" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wsb-grad" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="88" height="88" rx="22" fill="url(#wsb-grad)"/>
  <!-- Shield = the server-side trust boundary that verifies every ceremony -->
  <path d="M48 18 L72 27 V47 C72 61 61 71 48 78 C35 71 24 61 24 47 V27 Z" fill="#FFFFFF" opacity="0.95"/>
  <!-- Fingerprint arcs = biometric / passkey credential, in brand blue -->
  <g fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round">
    <path d="M33 47 a15 15 0 0 1 30 0 v4"/>
    <path d="M40 47 a8 8 0 0 1 16 0 v7 a7 7 0 0 1 -1 4"/>
    <path d="M47 46 a1.5 1.5 0 0 1 3 0 v12"/>
  </g>
</svg>
```

### Color Palette

| Role      | Token           | Hex       | Usage                                                 |
| --------- | --------------- | --------- | ----------------------------------------------------- |
| Primary   | `--wsb-blue`    | `#2563EB` | Brand mark, primary accents, links (trust / security) |
| Secondary | `--wsb-cyan`    | `#06B6D4` | Gradient pair, secondary accents (biometric / modern) |
| Verified  | `--wsb-emerald` | `#10B981` | "Trust-anchored / verified" status accents            |
| Ink       | `--wsb-ink`     | `#0F172A` | Headings, body text on light                          |
| Surface   | `--wsb-surface` | `#F8FAFC` | Page background (light)                               |
| Edge      | `--wsb-edge`    | `#E2E8F0` | Borders, dividers                                     |

> The package has no UI; the palette above is a derived identity for portfolio/social assets, built around a shield (server-side trust boundary) and a fingerprint (biometric/passkey) in a blue → cyan gradient.

---

## Update History (max 10 records)

| Date       | Type              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-08 | Material refresh  | Portfolio refresh on published v2.3.0 (no new release). `npm-check-updates -u` bumped one devDep patch (`@types/node ^25.9.1 → ^25.9.2`); `yarn install` reconciled `yarn.lock`. Re-verified green: `yarn typecheck` (0 errors), `yarn build` (tsup → ESM 199.67 KB + CJS 201.50 KB + dual `.d.ts`/`.d.cts`), and `yarn lint` (clean). **Correction: prior "strong test coverage / 131 (then 311) tests" claims are retired** — the automated-test runner (Cypress and all testing infra) was removed in the portfolio-wide cleanup, so the package now ships with NO test runner; quality is enforced by strict typecheck + a real dual-format build + ESLint 10. Single runtime dependency (`cbor-x`) preserved. Dossier rebuilt to the current section structure; CLAUDE.md + AGENTS.md date blocks bumped to 2026-06-08. |
| 2026-03-24 | Created/Refreshed | Portfolio file created from repository state during portfolio sweep (then v2.1.0). At that time the suite reported 131 passing tests; that claim is retired as of 2026-06-08 (testing infra removed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## One-Line Summary

WebAuthn Server Buildkit is a custom-built, framework-independent TypeScript **server** library that verifies the backend half of passkey / biometric sign-in — WebAuthn Level 3 registration and authentication ceremonies, per-format attestation with honest trust-anchoring, single-use challenges, algorithm pinning, encrypted sessions, and a storage-agnostic adapter system — with a single runtime dependency.

## Elevator Pitch

Every product that adds passkeys re-solves the same hard backend problem: parse and verify the WebAuthn ceremony (challenge, origin, RP-ID hash, flags, counter, signature), cryptographically check each attestation format, enforce challenge single-use and expiry, pin the credential algorithm, manage sessions, and wire it all to a database — correctly, in constant time, with the right defaults. WebAuthn Server Buildkit packages that backend foundation into one type-safe library that drops into Express, Fastify, Koa, Next.js, or any Node.js stack. Security-relevant protections (challenge consumption from storage, algorithm allowlist + pinning, cross-origin-iframe rejection) are **on by default**, each with an explicit opt-out. Attestation is verified honestly: a statement is reported `attestationVerified: true` only when it both verifies cryptographically _and_ chains to a trust anchor you supply — never "verified but un-anchored" silently treated as trusted. It is offline by design: trust anchors come from a relying-party-supplied metadata service, never from the network. It pairs with the `capacitor-biometric-authentication` frontend plugin for a full-stack biometric story, but stands alone as a backend library.

## What This Project Is About

This is reusable backend security infrastructure, not application UI. It centralizes the genuinely difficult, easy-to-get-wrong parts of server-side WebAuthn so product teams don't hand-roll (and subtly break) credential verification per app. The architecture is deliberately layered: ceremony flows (`registration/`, `authentication/`), a crypto core (`crypto/` — CBOR, COSE, challenge generation, signature verification), encrypted session lifecycle (`session/`), per-format attestation verification (`attestation/` — packed, fido-u2f, android-key, tpm, android-safetynet, apple, plus ASN.1/x509 helpers and the bundled Apple root), and a pluggable storage abstraction (`adapters/`) with a bundled in-memory adapter for development.

This is high-signal portfolio material: it demonstrates standards-based security engineering (W3C WebAuthn Level 3, FIDO2, COSE, CBOR, X.509/ASN.1), public-API and type-safety discipline, secure-by-default design, and the judgment to frame capabilities honestly rather than overclaim.

## Vision

Make secure, standards-based WebAuthn backend infrastructure practical, type-safe, and reusable for any Node.js product team — so adopting passkeys no longer means re-implementing (and risking) credential verification from scratch.

## Mission

- Reduce the complexity and risk of implementing passkeys and biometric auth on the server side.
- Provide a framework-independent WebAuthn foundation that fits Express, Fastify, Koa, Next.js, and other Node.js stacks.
- Make secure challenge, credential, attestation, and session handling correct by default, with explicit opt-outs.
- Keep capability claims honest — verify everything cryptographically, but report "trusted" only when trust-anchored.
- Support full-stack biometric product development by pairing cleanly with `capacitor-biometric-authentication`.

## Tech Stack

| Layer         | Choice                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language      | TypeScript 6 (strict)                                                                                                                                                                                                                                  |
| Module output | Dual ESM + CommonJS (`type: module`; `main` → `dist/index.cjs`, `module` → `dist/index.js`, `types` → `dist/index.d.ts`, plus `dist/index.d.cts`)                                                                                                      |
| Runtime deps  | **One** — `cbor-x` (CBOR decoding for authenticator data / attestation). No userland crypto lib.                                                                                                                                                       |
| Cryptography  | Node.js built-in `crypto` — COSE public keys imported via JWK (`createPublicKey({ format: 'jwk' })`), so RSA (any modulus) and P-521/ES512 verify correctly; AES-256-GCM + HKDF-SHA256 for sessions; constant-time comparisons                         |
| Build         | `tsup` (target ES2022) → ESM + CJS + dual `.d.ts`/`.d.cts` declarations                                                                                                                                                                                |
| Quality gates | `tsc --noEmit` strict typecheck + `tsup` build + ESLint 10 (typescript-eslint 8 flat config) + Prettier 3. **No test runner** — Cypress / automated-testing infra removed in the portfolio-wide cleanup; quality enforced by typecheck + build + lint. |
| Standards     | W3C WebAuthn Level 3, FIDO2, COSE, CBOR, X.509 / ASN.1                                                                                                                                                                                                 |
| Package mgr   | Yarn 4.14.1                                                                                                                                                                                                                                            |
| Node          | ≥ 24.13.0                                                                                                                                                                                                                                              |
| License       | MIT                                                                                                                                                                                                                                                    |

## Feature Catalog

- **WebAuthn Level 3 ceremony verification** — server-side registration and authentication ceremonies fully verified: challenge, origin, RP-ID hash, flags, signature counter, and signature.
- **Broad algorithm support, all native-verified** — ES256/384/512, RS256/384/512, PS256/384/512, and Ed25519 (EdDSA), verified through Node's native crypto via JWK import. `supportedAlgorithms` allowlist enforced at registration **and** authentication; the registered COSE `alg` is pinned and re-checked at every assertion (`ALGORITHM_MISMATCH`).
- **Per-format attestation with honest trust-anchoring** — `none`, `packed` (self + x5c), `fido-u2f`, `android-key`, `tpm`, `android-safetynet`, and `apple` are all cryptographically verified. `attestationVerified: true` is reported only when the statement is both verified and trust-anchored: `apple` against the bundled Apple WebAuthn Root CA; every other certificate-chain format against roots supplied via an RP-provided `MetadataService` (FIDO MDS). Offline by design — no network fetches, no CRL/OCSP.
- **Challenge lifecycle enforcement** — with a storage adapter configured, the verify path looks the challenge up, rejects it if missing / expired / scoped to the wrong operation, and consumes it once so it can't be replayed (`enforceChallengeStore`, default `true`; codes `CHALLENGE_NOT_FOUND` / `CHALLENGE_EXPIRED` / `CHALLENGE_OPERATION_MISMATCH`).
- **Cross-origin ceremonies rejected by default** — `clientData.crossOrigin === true` is rejected (`CROSS_ORIGIN_NOT_ALLOWED`) unless `allowCrossOriginIframe` is set. Custom `originVerifier` supports normalization and native `android:apk-key-hash:` origins.
- **Encrypted session management** — AES-256-GCM session tokens with HKDF-SHA256 key derivation, a 12-byte GCM IV, and field-length validation before decryption; create / validate / refresh / revoke / revoke-all-user-sessions.
- **Usernameless / discoverable credentials (passkeys)** — `createRegistrationOptions` returns the WebAuthn user handle (`webAuthnUserId`); authentication validates the assertion `userHandle` against the stored credential (`USER_HANDLE_MISMATCH`) as defense-in-depth.
- **Clone & downgrade signals** — signature-counter tracking plus advisory flags: `backupStateChanged`, `userVerificationDowngraded`, and `counterSupported` (false when both counters are 0, common for platform passkeys).
- **Storage-agnostic adapter system** — a typed `StorageAdapter` with `users` / `credentials` / `challenges` / `sessions` sub-stores plugs into MongoDB, PostgreSQL, Redis, or any database; a `MemoryStorageAdapter` is bundled for development.
- **Framework independent** — works with Express, Fastify, Koa, Next.js, or any Node.js framework; no HTTP framework coupling.
- **Typed, machine-readable errors** — `WebAuthnError` (+ `RegistrationError`, `AuthenticationError`, `VerificationError`, `ConfigurationError`, `StorageError`, `SessionError`) exported as runtime values so `instanceof` works; `error.code` typed against an _open_ `WebAuthnErrorCode` union; `error.statusCode` suggests 400 / 401 / 500. COSE identifier/key-type/curve enums are value exports.
- **Mobile JSON attestation (opt-in)** — a non-standard JSON path for the companion `capacitor-biometric-authentication` client, **disabled by default** (`enableMobileAttestation: false`) because it provides no cryptographic attestation; a warning is logged whenever a credential is accepted via this path.
- **Dual ESM + CommonJS + type declarations** and a bundled `AI-INTEGRATION-GUIDE.md` for AI coding agents and full-stack wiring.

## Install & Usage Snippet

```bash
# Single runtime dependency (cbor-x); Node >= 24.13.0
yarn add webauthn-server-buildkit
```

```ts
import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET, // >= 32 chars
  storageAdapter: new MemoryStorageAdapter(), // swap for your DB adapter in prod
});

// Registration: persist `webAuthnUserId` + `alg` to enable usernameless login + algorithm pinning
const { options, challenge, webAuthnUserId } = await webauthn.createRegistrationOptions(user);
const { verified, registrationInfo } = await webauthn.verifyRegistration(clientResponse, challenge);

// Authentication: pins the credential algorithm and checks the user handle
const { verified: ok, authenticationInfo } = await webauthn.verifyAuthentication(
  assertion,
  challenge,
  credential,
);
if (ok) {
  const token = await webauthn.createSession(
    credential.userId,
    credential.id,
    authenticationInfo.userVerified,
  );
}
```

## Hidden Facts & Unique Angles

- **Custom-built, not a thin wrapper.** The COSE/CBOR parsing, signature verification, per-format attestation, ASN.1/X.509 handling, and encrypted-session logic are implemented in this package — it is not a re-export of another WebAuthn server library.
- **Honest trust-anchoring is a deliberate design stance.** Many implementations conflate "cryptographically valid" with "trusted." This package keeps them separate and surfaces `fmt`, `attestationVerified`, and (for anchored chains) `trustPath`, so the relying party can branch on the real outcome.
- **Offline by design.** Trust anchors come from an RP-supplied `MetadataService`; the package never fetches FIDO MDS data and bundles only the small static Apple WebAuthn Root CA. There is **no CRL/OCSP revocation checking** — stated plainly, not hidden.
- **Secure-by-default with explicit opt-outs.** Challenge consumption from storage, the algorithm allowlist + pinning, and cross-origin-iframe rejection are all on by default; each has a documented switch so existing integrations can opt out deliberately.
- **Stated limits (no overclaiming):** for `tpm`, the AIK SAN fields are not additionally asserted; for `android-key`, the Keymaster authorization list is not additionally enforced (the security-critical bindings — key match, challenge binding, signature, chain — _are_, and the full policy is available via `trustPath`). `android-safetynet` is deprecated by Google (prefer Play Integrity). The mobile JSON path provides no cryptographic attestation and is off by default.
- **Honest verification scope for this refresh.** Verification covered `npm-check-updates`, dependency reconcile, typecheck, build, and lint — not a live production-app integration or device test. The package ships **no automated test runner** (testing infra was removed portfolio-wide); the prior "strong test coverage" wording has been retired rather than carried forward.
- **Full-stack pairing.** It is the backend counterpart to `capacitor-biometric-authentication`, so the same author's frontend and backend biometric pieces compose into one platform — while each remains independently usable.

## Benefits for Users

- **Backend teams** add passkey / WebAuthn verification in hours instead of reverse-engineering the spec — correct defaults, typed APIs, one import.
- **Security-sensitive products** get single-use challenges, algorithm pinning, constant-time comparisons, encrypted sessions, and honest attestation trust-anchoring as built-ins rather than bolt-ons.
- **Any Node.js stack** (Express / Fastify / Koa / Next.js) works without framework lock-in, and any database works via the storage adapter.
- **Full-stack / Capacitor developers** can pair it with `capacitor-biometric-authentication` for an end-to-end biometric login flow.
- **Teams without deep WebAuthn expertise** get a maintained foundation that encodes the correct ceremony and attestation logic, reducing the chance of subtle, exploitable mistakes.

## Value & Potential

Passkeys are becoming the default modern authentication method, which gives a correct, honest, framework-independent WebAuthn server library broad and durable demand. The adapter pattern means new storage backends slot in without breaking the public contract, and the single-runtime-dependency stance keeps the install footprint small. As reusable infrastructure inside a larger multi-app ecosystem (AOneAhsan / Zaions), it compounds in value — every product that adopts it avoids re-solving credential verification. Future surfaces could include additional bundled trust anchors, a live FIDO MDS cache helper, deeper documentation/site presence, and tighter end-to-end examples with the companion frontend plugin.

## Resume / CV Bullets

- Designed and published `webauthn-server-buildkit`, a custom-built, framework-independent TypeScript WebAuthn **server** library implementing W3C WebAuthn Level 3 registration and authentication ceremony verification (challenge, origin, RP-ID hash, flags, counter, signature) with a single runtime dependency.
- Implemented per-format attestation verification (`packed`, `fido-u2f`, `android-key`, `tpm`, `android-safetynet`, `apple`) with honest trust-anchoring — reporting `attestationVerified: true` only when a statement chains to a relying-party-supplied trust anchor (FIDO MDS) or the bundled Apple WebAuthn Root CA, offline by design.
- Built secure-by-default protections with explicit opt-outs: server-enforced single-use/expiring/operation-scoped challenges, a `supportedAlgorithms` allowlist plus credential-algorithm pinning at authentication, and cross-origin-iframe ceremony rejection.
- Engineered COSE/CBOR parsing and native-crypto signature verification (ES256/384/512, RS256/384/512, PS256/384/512, Ed25519) via JWK import, plus AES-256-GCM encrypted sessions with HKDF-SHA256 derivation and constant-time comparisons.
- Designed a storage-agnostic adapter system (users / credentials / challenges / sessions) that integrates with any database, with a bundled in-memory adapter for development.
- Shipped a typed public API — runtime-value error classes (`instanceof`-safe), an open `WebAuthnErrorCode` union, and documented HTTP status codes — across dual ESM + CommonJS + type-declaration outputs, on a TypeScript 6 / ESLint 10 / Yarn 4 toolchain.
- Authored a bundled `AI-INTEGRATION-GUIDE.md` and a companion frontend plugin (`capacitor-biometric-authentication`) for a full-stack biometric authentication story.

## LinkedIn / Portfolio Paragraph

WebAuthn Server Buildkit is a custom-built TypeScript server library I created to handle the hardest, easiest-to-get-wrong part of passkeys: verifying the backend half of the WebAuthn ceremony. It checks registration and authentication ceremonies end to end (challenge, origin, RP-ID hash, flags, counter, and signature), cryptographically verifies every attestation format, and reports a statement as "trusted" only when it actually chains to a trust anchor you supply — never silently treating "verified but un-anchored" as trusted. Security-relevant protections — single-use challenges consumed from storage, an algorithm allowlist plus credential-algorithm pinning, and cross-origin-iframe rejection — are on by default, each with an explicit opt-out. It's framework-independent (Express, Fastify, Koa, Next.js, or any Node.js stack), storage-agnostic via a pluggable adapter, and ships AES-256-GCM encrypted sessions, all with a single runtime dependency. It pairs with my `capacitor-biometric-authentication` frontend plugin for an end-to-end biometric login flow and is published on npm under MIT, built and type-checked with TypeScript 6 and shipped as dual ESM + CommonJS with type declarations.

## Social Content Angles (for ChatGPT content project)

- "Verifying a passkey on the server is harder than it looks — here's the backend checklist most teams miss." (LinkedIn hook)
- Why "cryptographically valid" is NOT the same as "trusted" in WebAuthn attestation — and how I keep the two honest. (engineering deep-dive)
- Secure-by-default WebAuthn: single-use challenges, algorithm pinning, cross-origin rejection — all on by default, each with one opt-out switch. (feature post)
- Offline attestation on purpose: no network fetches, no MDS bundling — you supply the trust anchors. (security design thread)
- The opt-in mobile path I ship _disabled by default_ because it gives no cryptographic guarantee — shipping honestly. (build-in-public)
- One WebAuthn server library, any Node.js framework, any database — how the adapter pattern keeps it portable. (architecture post)
- Encrypted sessions done right: AES-256-GCM + HKDF-SHA256 + IV/field-length validation. (crypto tip)
- I wrote an AI-Integration Guide _inside_ the npm package so Claude Code / Cursor can wire up backend + frontend biometrics fast. (AEO angle)
- Passkeys end-to-end: pairing a Capacitor biometric frontend with a custom WebAuthn backend. (full-stack story)
- What "production-ready" actually means for a security library: typed errors, dual ESM/CJS, strict TS 6, honest limits. (credibility post)

## Top 20 Hashtags

#WebAuthn #Passkeys #FIDO2 #TypeScript #NodeJS #AuthenticationSecurity #BackendEngineering #SecurityEngineering #BiometricAuthentication #PasskeyLogin #OpenSource #DeveloperTools #IdentityInfrastructure #ModernAuthentication #APISecurity #TypeScriptLibrary #FullStackDevelopment #BuildInPublic #Cryptography #PasswordlessAuth

## SEO / AEO Metadata

- Meta description (150–160 chars): WebAuthn Server Buildkit: a framework-independent TypeScript server library that verifies passkey registration & authentication ceremonies with honest attestation trust-anchoring.
- Primary keywords: WebAuthn server library, passkey backend TypeScript, FIDO2 server Node.js, biometric authentication server, WebAuthn attestation verification
- Long-tail / GEO keywords (AI-search): how to verify a passkey on the server in Node.js, WebAuthn attestation trust anchoring FIDO MDS, framework-independent WebAuthn server for Express and Fastify, storage-agnostic WebAuthn credential adapter, AES-256-GCM encrypted WebAuthn sessions, algorithm pinning at WebAuthn authentication
- Suggested og:title / og:description: "WebAuthn Server Buildkit — Verify Passkeys on the Server, Honestly" / "Framework-independent TypeScript WebAuthn server: ceremony verification, per-format attestation with trust-anchoring, single-use challenges, algorithm pinning, and encrypted sessions. One runtime dependency, MIT."

## Generic Hashtags (always include in posts)

#Aoneahsan #AhsanMahmood #Zaions #BestOpenSourceCommunityProject #TopFree #SaaSApp
