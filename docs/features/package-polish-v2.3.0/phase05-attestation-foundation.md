# Phase 05 — Attestation foundation

**Goal:** Build the reusable primitives every attestation format needs, before implementing the formats themselves: a minimal DER/ASN.1 reader, an X.509 chain-verification helper on Node's built-in `crypto.X509Certificate`, a pluggable trust-anchor / FIDO Metadata Service provider, and the bundled Apple WebAuthn Root CA. Keep the package offline-by-default and lean.

## Findings addressed

- 🟠 **GAP-N2** (foundation only — formats land in Phase 6).

## Architecture decisions

- **Offline-by-default:** the package never fetches the FIDO MDS blob or any network resource at import or verify time. The RP supplies metadata/roots via a provider interface.
- **Lean deps:** prefer an in-house minimal DER reader for the simple custom extensions (AAGUID, Apple nonce). Reassess at Phase 6 whether TPM (`TPMS_ATTEST`/`TPMT_PUBLIC`) and android-key (authorization list) parsing justify one small vetted ASN.1 dependency (user pre-approved exactly one if needed). Record the decision in the tracker `newFindings` + this run log.
- **Node built-ins:** use `crypto.X509Certificate` (Node 15+, engine is >=24.13.0) for cert parse, `.publicKey`, `.checkIssued(issuer)`, `.verify(publicKey)`, validity dates, `.raw`. Use `crypto.verify` for signature checks.

## Deliverables (new files under `src/attestation/`)

1. `src/attestation/asn1.ts` — minimal DER TLV walker: parse SEQUENCE/SET/OCTET STRING/OID/INTEGER; find an extension by OID inside a certificate's `.raw`; extract the inner OCTET STRING. Pure, no deps. Strict bounds-checking (reject truncated/overlong lengths).
2. `src/attestation/x509.ts` — `parseCertificate(der)`, `verifyCertChain(leaf, intermediates, roots)` (issuance + signature + validity window), `getCertPublicKey(cert)` → COSE/JWK-comparable form, `getExtension(cert, oid)`.
3. `src/attestation/metadata.ts` — `MetadataService` interface: `getTrustAnchors(aaguid | attestationCertKeyId)` → root certs; `getEntry(aaguid)` → optional MDS metadata (status reports, key protection). A `StaticMetadataService` implementation the RP constructs from supplied roots/entries. Apple root bundled as a constant.
4. `src/attestation/roots/apple-webauthn-root-ca.ts` — the Apple WebAuthn Root CA PEM as a string constant (small, static, safe to bundle).
5. Extend `src/types/config.ts`: `metadataService?: MetadataService` (optional). When absent, cert-chain formats remain `attestationVerified: false` (honest framing preserved).

## Test plan

- `asn1.ts`: parse known DER fixtures; extract an extension by OID; reject malformed/truncated input.
- `x509.ts`: parse a known cert; verify a 2-cert chain; reject an expired cert and a broken chain.
- `metadata.ts`: `StaticMetadataService` returns supplied anchors; missing AAGUID returns undefined.

## Verification gate

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean.

## Commit

ONE commit for Phase 5, tracker + progress updated. Push.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |
