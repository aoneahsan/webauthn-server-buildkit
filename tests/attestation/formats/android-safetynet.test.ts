import { describe, it, expect } from 'vitest';
import { sign as nodeSign } from 'node:crypto';
import { verifyAndroidSafetyNetAttestation } from '@/attestation/formats';
import { StaticMetadataService } from '@/attestation';
import { VerificationError } from '@/types';
import { sha256 } from '@/utils/hash';
import { concatBuffers } from '@/utils/buffer';
import { bufferToBase64URL } from '@/utils/base64url';
import { buildCertificate, basicConstraintsExt, generateEcKeyPair } from './cert-builder';
import {
  TEST_AAGUID,
  buildAuthData,
  clientDataHash,
  ecCoseKeyFromJwk,
  makeVerifierInput,
  parseCose,
} from './helpers';

/**
 * Build an android-safetynet fixture: a real ES256-signed JWS whose leaf cert CN
 * is attest.android.com, chained to a generated GlobalSign-stand-in root.
 */
function buildSafetyNetFixture(overrides?: {
  wrongNonce?: boolean;
  ctsFalse?: boolean;
  staleTimestamp?: boolean;
  wrongHostname?: boolean;
}) {
  const root = generateEcKeyPair();
  const leaf = generateEcKeyPair();
  const cred = generateEcKeyPair();

  const coseBytes = ecCoseKeyFromJwk(cred.jwk);
  const credId = new Uint8Array(32).fill(21);
  const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
  const cdh = clientDataHash();

  const rootCert = buildCertificate({
    subject: { CN: 'SafetyNet Test Root' },
    issuer: { CN: 'SafetyNet Test Root' },
    subjectKey: root,
    issuerPrivateKey: root.privateKey,
    extensions: [basicConstraintsExt(true)],
  });
  const leafCert = buildCertificate({
    subject: { CN: overrides?.wrongHostname ? 'wrong.example.com' : 'attest.android.com' },
    issuer: { CN: 'SafetyNet Test Root' },
    subjectKey: leaf,
    issuerPrivateKey: root.privateKey,
  });

  const realNonce = Buffer.from(sha256(concatBuffers(authData, cdh))).toString('base64');
  const payload = {
    nonce: overrides?.wrongNonce ? Buffer.from('nope').toString('base64') : realNonce,
    ctsProfileMatch: !overrides?.ctsFalse,
    basicIntegrity: true,
    timestampMs: overrides?.staleTimestamp ? Date.now() - 5 * 60_000 : Date.now(),
  };

  const header = { alg: 'ES256', x5c: [Buffer.from(leafCert.raw).toString('base64')] };
  const headerB64 = bufferToBase64URL(Buffer.from(JSON.stringify(header)));
  const payloadB64 = bufferToBase64URL(Buffer.from(JSON.stringify(payload)));
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'ascii');
  const sig = nodeSign('sha256', signingInput, leaf.privateKey);
  const jws = `${headerB64}.${payloadB64}.${bufferToBase64URL(sig)}`;

  return {
    rootCert,
    response: new Uint8Array(Buffer.from(jws, 'utf8')),
    coseBytes,
    authData,
    cdh,
  };
}

function attStmt(response: Uint8Array) {
  return new Map<string, unknown>([['response', response]]);
}

describe('android-safetynet (deprecated by Google — Play Integrity recommended)', () => {
  it('verifies + trust-anchors a valid SafetyNet JWS → attestationVerified=true', () => {
    const f = buildSafetyNetFixture();
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    const result = verifyAndroidSafetyNetAttestation(
      makeVerifierInput({
        fmt: 'android-safetynet',
        attStmt: attStmt(f.response),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
        metadataService,
      }),
    );
    expect(result.attestationVerified).toBe(true);
    expect(result.trustPath?.[0]).toContain('BEGIN CERTIFICATE');
  });

  it('verifies cryptographically but is NOT trust-anchored without a GlobalSign root (false, no throw)', () => {
    const f = buildSafetyNetFixture();
    const result = verifyAndroidSafetyNetAttestation(
      makeVerifierInput({
        fmt: 'android-safetynet',
        attStmt: attStmt(f.response),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
      }),
    );
    expect(result.attestationVerified).toBe(false);
  });

  it('throws on a nonce mismatch', () => {
    const f = buildSafetyNetFixture({ wrongNonce: true });
    expect(() =>
      verifyAndroidSafetyNetAttestation(
        makeVerifierInput({
          fmt: 'android-safetynet',
          attStmt: attStmt(f.response),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/nonce/);
  });

  it('throws when ctsProfileMatch is false', () => {
    const f = buildSafetyNetFixture({ ctsFalse: true });
    expect(() =>
      verifyAndroidSafetyNetAttestation(
        makeVerifierInput({
          fmt: 'android-safetynet',
          attStmt: attStmt(f.response),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/ctsProfileMatch/);
  });

  it('throws on a stale timestamp', () => {
    const f = buildSafetyNetFixture({ staleTimestamp: true });
    expect(() =>
      verifyAndroidSafetyNetAttestation(
        makeVerifierInput({
          fmt: 'android-safetynet',
          attStmt: attStmt(f.response),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/timestamp/);
  });

  it('throws when the leaf hostname is not attest.android.com', () => {
    const f = buildSafetyNetFixture({ wrongHostname: true });
    expect(() =>
      verifyAndroidSafetyNetAttestation(
        makeVerifierInput({
          fmt: 'android-safetynet',
          attStmt: attStmt(f.response),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/attest\.android\.com/);
  });

  it('throws on a malformed JWS (not three segments)', () => {
    expect(() =>
      verifyAndroidSafetyNetAttestation(
        makeVerifierInput({
          fmt: 'android-safetynet',
          attStmt: new Map<string, unknown>([
            ['response', new Uint8Array(Buffer.from('only.two', 'utf8'))],
          ]),
          authData: new Uint8Array(37),
          clientDataHash: clientDataHash(),
          credentialPublicKey: parseCose(ecCoseKeyFromJwk(generateEcKeyPair().jwk)),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(VerificationError);
  });

  it('throws when response is missing', () => {
    expect(() =>
      verifyAndroidSafetyNetAttestation(
        makeVerifierInput({
          fmt: 'android-safetynet',
          attStmt: new Map(),
          authData: new Uint8Array(37),
          clientDataHash: clientDataHash(),
          credentialPublicKey: parseCose(ecCoseKeyFromJwk(generateEcKeyPair().jwk)),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/missing the JWS response/);
  });
});
