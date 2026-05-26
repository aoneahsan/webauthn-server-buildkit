# Phase 04 — Extensions, API surface & hygiene

**Goal:** Parse client extension outputs, make error handling type-safe, and clear the remaining hygiene/API findings. Invoke `simplify` skill for the cleanups.

## Findings addressed

- 🟡 **GAP-N3 + HYG-N6** — `clientExtensionResults` never parsed/returned; extension output type stale.
- 🟡 **API-N1** — error `code` free-form string; no typed union; `statusCode` undocumented.
- 🟡 **GAP-N4** — `excludeCredentials` not enforced at registration verify.
- 🟡 **HYG-N1** — `COSE_KEY_PARAMS` `-1/-2` collision footgun.
- 🟡 **HYG-N2** — overstated `index.ts` JSDoc ("Complete WebAuthn Level 3 support", "Mobile Attestation Support").
- 🟡 **HYG-N4** — double `clientDataJSON` decode.
- 🟡 **HYG-N5** — dead/duplicate `verifyHash`.
- 🟡 **API-N3** — session-token mint/verify not publicly exposed (decide + document).
- 🟡 **API-N4** — variable-time `buffersEqual` exported next to `timingSafeEqualBytes` (footgun).

## Approach

### GAP-N3 + HYG-N6

- Parse `response.clientExtensionResults` in both verify paths; return it on `VerifiedRegistrationInfo` / `VerifiedAuthenticationInfo` (at minimum surface `credProps.rk` so the RP knows whether a discoverable credential was created).
- Modernize `AuthenticationExtensionsClientOutputs`: keep `appid`, complete `credProps { rk?: boolean }`, add `prf` (`{ enabled?: boolean; results?: {...} }`), `largeBlob` (`{ supported?: boolean; ... }`); keep legacy `hmacCreateSecret` for back-compat with a `@deprecated` tag.

### API-N1

- Add `export type WebAuthnErrorCode = '...' | '...'` (or a `const` map) enumerating the codes actually thrown across the codebase. Type `WebAuthnError.code: WebAuthnErrorCode` (keep assignment-compatible). Export it. Document `statusCode` (400/401/500) in the README error section.

### GAP-N4

- `verifyRegistration` (server wrapper) optionally accepts the existing credential set / a `isCredentialRegistered(id)` check; reject `CREDENTIAL_ALREADY_REGISTERED` if the returned credential id already exists. Additive + documented.

### Hygiene

- **HYG-N1:** split `COSE_KEY_PARAMS` into per-`kty` maps or add a clear comment that `-1/-2` are reused across EC2/RSA and disambiguated by `kty`.
- **HYG-N2:** rewrite the top-of-file `index.ts` JSDoc to describe verified behavior accurately (no "Complete L3"; describe attestation support precisely after Phase 6). Final wording revisited in Phase 7.
- **HYG-N4:** decode `clientDataJSON` once (buffer), derive the string via `base64URLToString`/`TextDecoder` from the same bytes.
- **HYG-N5:** remove `verifyHash` or route it through `crypto.timingSafeEqual`; update the index export accordingly (note in CHANGELOG if removed).
- **API-N3:** confirm session token utilities stay encapsulated (documented), OR export read-only `verifySessionToken` if useful. Default: keep encapsulated + document via `WebAuthnServer`.
- **API-N4:** JSDoc `buffersEqual` as NON-security (variable-time) and point to `timingSafeEqualBytes`; consider `@deprecated`.

## Tests

- Extension parsing returns `credProps.rk`; error-code union compiles & matches thrown codes; duplicate-credential rejection; `buffersEqual` vs `timingSafeEqualBytes` documented behavior.

## Verification gate

`yarn typecheck` · `yarn lint` · `yarn test` · `yarn build` · `yarn format:check` — all clean.

## Commit

ONE commit for Phase 4, tracker + progress updated. Push.

## Run log

| Date | What happened | Result |
| ---- | ------------- | ------ |
|      |               |        |
