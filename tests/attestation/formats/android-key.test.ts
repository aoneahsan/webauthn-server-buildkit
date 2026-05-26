import { describe, it, expect } from 'vitest';
import { sign as nodeSign } from 'node:crypto';
import { verifyAndroidKeyAttestation } from '@/attestation/formats';
import { StaticMetadataService } from '@/attestation';
import { VerificationError } from '@/types';
import { concatBuffers } from '@/utils/buffer';
import {
  buildCertificate,
  basicConstraintsExt,
  derOctet,
  derSeq,
  generateEcKeyPair,
  type CertExtension,
  type TestKeyPair,
} from './cert-builder';
import {
  TEST_AAGUID,
  buildAuthData,
  clientDataHash,
  ecCoseKeyFromJwk,
  makeVerifierInput,
  parseCose,
} from './helpers';

const ANDROID_KEY_OID = '1.3.6.1.4.1.11129.2.1.17';

/** Encode an INTEGER (single small byte). */
function int(n: number): Buffer {
  return Buffer.concat([Buffer.from([0x02, 0x01, n])]);
}
/** Encode an ENUMERATED (single small byte). */
function enumerated(n: number): Buffer {
  return Buffer.concat([Buffer.from([0x0a, 0x01, n])]);
}

/**
 * Build the Android Key `KeyDescription` extension value with `challenge` at the
 * `attestationChallenge` position (index 4).
 */
function keyDescriptionExt(challenge: Uint8Array): CertExtension {
  const value = derSeq(
    int(3), // attestationVersion
    enumerated(1), // attestationSecurityLevel
    int(4), // keymasterVersion
    enumerated(1), // keymasterSecurityLevel
    derOctet(Buffer.from(challenge)), // attestationChallenge  ← index 4
    derOctet(Buffer.alloc(0)), // uniqueId
    derSeq(), // softwareEnforced (empty AuthorizationList)
    derSeq(), // teeEnforced
  );
  return { oid: ANDROID_KEY_OID, value };
}

function buildAndroidKeyFixture(overrides?: { wrongChallenge?: boolean; wrongKey?: boolean }) {
  const root: TestKeyPair = generateEcKeyPair();
  const credKey: TestKeyPair = generateEcKeyPair();

  const coseBytes = ecCoseKeyFromJwk(credKey.jwk);
  const credId = new Uint8Array(32).fill(13);
  const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
  const cdh = clientDataHash();
  const challenge = overrides?.wrongChallenge ? new Uint8Array(32).fill(0xcc) : cdh;

  const rootCert = buildCertificate({
    subject: { CN: 'AndroidKey Test Root' },
    issuer: { CN: 'AndroidKey Test Root' },
    subjectKey: root,
    issuerPrivateKey: root.privateKey,
    extensions: [basicConstraintsExt(true)],
  });

  // Leaf key == credential key, unless wrongKey.
  const leafKey = overrides?.wrongKey ? generateEcKeyPair() : credKey;
  const extensions: CertExtension[] = [keyDescriptionExt(challenge), basicConstraintsExt(false)];
  const leafCert = buildCertificate({
    subject: { CN: 'AndroidKey Test Leaf' },
    issuer: { CN: 'AndroidKey Test Root' },
    subjectKey: leafKey,
    issuerPrivateKey: root.privateKey,
    extensions,
  });

  // sig over authData ‖ clientDataHash by the leaf key.
  const sig = nodeSign('sha256', concatBuffers(authData, cdh), leafKey.privateKey);

  return { rootCert, leafCert, coseBytes, authData, cdh, sig: new Uint8Array(sig) };
}

function attStmt(leafCert: { raw: Buffer }, sig: Uint8Array) {
  return new Map<string, unknown>([
    ['alg', -7],
    ['sig', sig],
    ['x5c', [new Uint8Array(leafCert.raw)]],
  ]);
}

describe('android-key', () => {
  it('verifies + trust-anchors a valid android-key attestation → attestationVerified=true', () => {
    const f = buildAndroidKeyFixture();
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    const result = verifyAndroidKeyAttestation(
      makeVerifierInput({
        fmt: 'android-key',
        attStmt: attStmt(f.leafCert, f.sig),
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

  it('verifies cryptographically but is NOT trust-anchored without roots (false, no throw)', () => {
    const f = buildAndroidKeyFixture();
    const result = verifyAndroidKeyAttestation(
      makeVerifierInput({
        fmt: 'android-key',
        attStmt: attStmt(f.leafCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
      }),
    );
    expect(result.attestationVerified).toBe(false);
  });

  it('throws when the attestation challenge does not match the client data hash', () => {
    const f = buildAndroidKeyFixture({ wrongChallenge: true });
    expect(() =>
      verifyAndroidKeyAttestation(
        makeVerifierInput({
          fmt: 'android-key',
          attStmt: attStmt(f.leafCert, f.sig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/attestationChallenge does not match/);
  });

  it('throws when the leaf key does not match the credential key', () => {
    const f = buildAndroidKeyFixture({ wrongKey: true });
    expect(() =>
      verifyAndroidKeyAttestation(
        makeVerifierInput({
          fmt: 'android-key',
          attStmt: attStmt(f.leafCert, f.sig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/does not match the credential public key/);
  });

  it('throws on an invalid signature', () => {
    const f = buildAndroidKeyFixture();
    const badSig = new Uint8Array(f.sig);
    badSig[badSig.length - 1] ^= 0xff;
    expect(() =>
      verifyAndroidKeyAttestation(
        makeVerifierInput({
          fmt: 'android-key',
          attStmt: attStmt(f.leafCert, badSig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(VerificationError);
  });
});
