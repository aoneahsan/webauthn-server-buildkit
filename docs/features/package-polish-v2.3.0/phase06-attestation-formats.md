# Phase 06 — Attestation formats (full verification + FIDO MDS)

**Goal:** Implement cryptographic verification for every WebAuthn attestation format on top of the Phase 5 primitives, trust-anchored via the supplied `MetadataService`. Sequence simplest-first; each format (or small group) is independently committable. This phase may span multiple sessions.

## Findings addressed

- 🟠 **GAP-N2** (full attestation + FIDO MDS).
- 🟡 **FUNC-N4** (enforce `attestationType` policy once verification exists).

## Per-format implementation (in `src/attestation/formats/`)

Each `verify<Format>(...)` returns `{ fmt, attestationVerified, trustPath?, aaguid?, metadata? }` and throws `VerificationError` only when a statement it _does_ verify is cryptographically invalid.

1. **apple** (`apple.ts`) — chain leaf→Apple WebAuthn Root CA; extract nonce ext OID `1.2.840.113635.100.8.2`; assert `nonce == sha256(authData ‖ clientDataHash)`; assert leaf cert public key == credential public key. No `sig`.
2. **fido-u2f** (`fido-u2f.ts`) — verification data `0x00 ‖ rpIdHash ‖ clientDataHash ‖ credentialId ‖ (0x04‖x‖y)`; verify `sig` (ECDSA P-256/SHA-256) with the attestation cert public key; chain-validate to roots from MDS/provider.
3. **packed-x5c** (`packed.ts`, extend existing self path) — verify `sig` over `authData ‖ clientDataHash` with the **leaf** cert key; enforce leaf cert requirements (v3, OU="Authenticator Attestation", BasicConstraints CA=false, valid EKU); parse AAGUID ext OID `1.3.6.1.4.1.45724.1.1.4` and assert == authData AAGUID; chain via MDS roots.
4. **android-key** (`android-key.ts`) — verify `sig` with leaf key; leaf key == credential key; parse Android Key Attestation ext OID `1.3.6.1.4.1.11129.2.1.17`; assert `attestationChallenge == clientDataHash` and authorization-list constraints (purpose/origin/allApplications absent); chain to Google hardware-attestation roots (provider). **Decide ASN.1-dep need here.**
5. **tpm** (`tpm.ts`) — parse `certInfo` (TPMS_ATTEST) + `pubArea` (TPMT_PUBLIC); assert `pubArea` key matches credential key; assert `certInfo.extraData == hash(attToBeSigned)`; verify `sig` with AIK cert; validate AIK SAN (manufacturer/model/version) + EKU `2.23.133.8.3`; chain to roots. Most complex — **likely needs the small ASN.1/TPM-struct helper**.
6. **android-safetynet** (`android-safetynet.ts`) — split + verify the JWS `response`; chain leaf (`attest.android.com`) to GlobalSign root; assert `nonce == base64(sha256(authData ‖ clientDataHash))`; check `ctsProfileMatch`/`basicIntegrity`; timestamp freshness. **Deprecated** — implement for completeness; docs recommend **Play Integrity**.

## Wiring

- `verifyAttestationStatement` (registration/attestation.ts) dispatches by `fmt` to the new verifiers, passing `clientDataHash`, `authData`, `credentialPublicKey`, `aaguid`, and the `metadataService`.
- Surface `trustPath` / `metadata` (status reports) on `VerifiedRegistrationInfo` where available.
- **FUNC-N4:** when `config.attestationType !== 'none'`, require `attestationVerified === true` (configurable `requireTrustedAttestation`) or warn loudly. When no `metadataService` is supplied, cert-chain formats stay `attestationVerified:false` (honest framing) and `requireTrustedAttestation` would reject — document this dependency.

## Test plan

- Per-format fixtures (real or well-known WebAuthn test vectors) proving accept on valid + reject on tampered nonce/sig/chain. Use the simplewebauthn reference vectors in `docs/reference/` where applicable.
- `attestationVerified` true only on trust-anchored success; false (not throw) when no provider/roots.

## Verification gate (each commit)

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean.

## Commit

One commit per format-group is acceptable for this large phase (e.g. apple+u2f, packed+android-key, tpm, safetynet). Tracker `subTasks` track per-format status so the phase resumes mid-stream. Push after each.

## Run log

| Date | Format(s) | Result |
| ---- | --------- | ------ |
|      |           |        |
