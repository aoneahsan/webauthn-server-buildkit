import { describe, it, expect } from 'vitest';
import { sign as nodeSign } from 'node:crypto';
import { verifyFidoU2fAttestation } from '@/attestation/formats';
import { StaticMetadataService } from '@/attestation';
import { VerificationError } from '@/types';
import { concatBuffers } from '@/utils/buffer';
import { buildCertificate, basicConstraintsExt, generateEcKeyPair } from './cert-builder';
import {
  TEST_AAGUID,
  buildAuthData,
  clientDataHash,
  ecCoseKeyFromJwk,
  makeVerifierInput,
  parseCose,
} from './helpers';

/** Build a fido-u2f fixture: the attestation cert signs the U2F verification data. */
function buildU2fFixture() {
  const root = generateEcKeyPair();
  const attCert = generateEcKeyPair();
  const cred = generateEcKeyPair();

  const coseBytes = ecCoseKeyFromJwk(cred.jwk);
  const credId = new Uint8Array(32).fill(11);
  const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: new Uint8Array(16) });
  const cdh = clientDataHash();

  const rootCert = buildCertificate({
    subject: { CN: 'U2F Test Root' },
    issuer: { CN: 'U2F Test Root' },
    subjectKey: root,
    issuerPrivateKey: root.privateKey,
    extensions: [basicConstraintsExt(true)],
  });
  const attestationCert = buildCertificate({
    subject: { CN: 'U2F Test Attestation' },
    issuer: { CN: 'U2F Test Root' },
    subjectKey: attCert,
    issuerPrivateKey: root.privateKey,
  });

  // U2F verification data: 0x00 ‖ rpIdHash ‖ clientDataHash ‖ credentialId ‖ (0x04‖x‖y)
  const credCose = parseCose(coseBytes);
  if (credCose.kty !== 2) {
    throw new Error('expected EC2');
  }
  const rpIdHash = authData.subarray(0, 32);
  const publicKeyU2F = concatBuffers(Uint8Array.from([0x04]), credCose.x, credCose.y);
  const verificationData = concatBuffers(
    Uint8Array.from([0x00]),
    rpIdHash,
    cdh,
    credId,
    publicKeyU2F,
  );
  const sig = nodeSign('sha256', verificationData, attCert.privateKey);

  return { rootCert, attestationCert, coseBytes, authData, cdh, sig: new Uint8Array(sig) };
}

function u2fAttStmt(attestationCert: { raw: Buffer }, sig: Uint8Array) {
  return new Map<string, unknown>([
    ['sig', sig],
    ['x5c', [new Uint8Array(attestationCert.raw)]],
  ]);
}

describe('fido-u2f', () => {
  it('verifies + trust-anchors a valid u2f attestation → attestationVerified=true', () => {
    const f = buildU2fFixture();
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });

    const result = verifyFidoU2fAttestation(
      makeVerifierInput({
        fmt: 'fido-u2f',
        attStmt: u2fAttStmt(f.attestationCert, f.sig),
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
    const f = buildU2fFixture();
    const result = verifyFidoU2fAttestation(
      makeVerifierInput({
        fmt: 'fido-u2f',
        attStmt: u2fAttStmt(f.attestationCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
      }),
    );
    expect(result.attestationVerified).toBe(false);
    expect(result.trustPath).toBeUndefined();
  });

  it('throws on an invalid signature', () => {
    const f = buildU2fFixture();
    const badSig = new Uint8Array(f.sig);
    badSig[badSig.length - 1] ^= 0xff;
    expect(() =>
      verifyFidoU2fAttestation(
        makeVerifierInput({
          fmt: 'fido-u2f',
          attStmt: u2fAttStmt(f.attestationCert, badSig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/signature is invalid/);
  });

  it('is NOT trust-anchored against an unrelated root (false)', () => {
    const f = buildU2fFixture();
    const unrelated = generateEcKeyPair();
    const unrelatedRoot = buildCertificate({
      subject: { CN: 'Unrelated' },
      issuer: { CN: 'Unrelated' },
      subjectKey: unrelated,
      issuerPrivateKey: unrelated.privateKey,
      extensions: [basicConstraintsExt(true)],
    });
    const metadataService = new StaticMetadataService({ defaultRoots: [unrelatedRoot.toString()] });
    const result = verifyFidoU2fAttestation(
      makeVerifierInput({
        fmt: 'fido-u2f',
        attStmt: u2fAttStmt(f.attestationCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
        metadataService,
      }),
    );
    expect(result.attestationVerified).toBe(false);
  });

  it('throws when sig is missing', () => {
    const f = buildU2fFixture();
    expect(() =>
      verifyFidoU2fAttestation(
        makeVerifierInput({
          fmt: 'fido-u2f',
          attStmt: new Map<string, unknown>([['x5c', [new Uint8Array(f.attestationCert.raw)]]]),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(VerificationError);
  });
});
