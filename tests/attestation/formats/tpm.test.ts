import { describe, it, expect } from 'vitest';
import { createHash, sign as nodeSign } from 'node:crypto';
import { verifyTpmAttestation } from '@/attestation/formats';
import { StaticMetadataService } from '@/attestation';
import { VerificationError } from '@/types';
import { sha256 } from '@/utils/hash';
import { concatBuffers } from '@/utils/buffer';
import {
  buildCertificate,
  basicConstraintsExt,
  derOid,
  derSeq,
  generateEcKeyPair,
  type CertExtension,
} from './cert-builder';
import {
  TEST_AAGUID,
  buildAuthData,
  clientDataHash,
  ecCoseKeyFromJwk,
  makeVerifierInput,
  parseCose,
} from './helpers';

const EXT_KEY_USAGE_OID = '2.5.29.37';
const AIK_EKU_OID = '2.23.133.8.3';

const TPM_ALG_ECC = 0x0023;
const TPM_ALG_SHA256 = 0x000b;
const TPM_ALG_NULL = 0x0010;
const TPM_ECC_NIST_P256 = 0x0003;
const TPM_GENERATED = 0xff544347;
const TPM_ST_ATTEST_CERTIFY = 0x8017;

function u16(n: number): Buffer {
  return Buffer.from([(n >> 8) & 0xff, n & 0xff]);
}
function u32(n: number): Buffer {
  return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}
/** TPM2B: UINT16 length-prefixed bytes. */
function tpm2b(buf: Buffer): Buffer {
  return Buffer.concat([u16(buf.length), buf]);
}

/** Build a TPMT_PUBLIC (ECC P-256) for the given credential x/y coordinates. */
function buildPubAreaEcc(x: Uint8Array, y: Uint8Array): Buffer {
  return Buffer.concat([
    u16(TPM_ALG_ECC), // type
    u16(TPM_ALG_SHA256), // nameAlg
    u32(0x00040072), // objectAttributes (arbitrary)
    tpm2b(Buffer.alloc(0)), // authPolicy (empty)
    // TPMS_ECC_PARMS:
    u16(TPM_ALG_NULL), // symmetric
    u16(TPM_ALG_NULL), // scheme
    u16(TPM_ECC_NIST_P256), // curveID
    u16(TPM_ALG_NULL), // kdf
    // unique TPMS_ECC_POINT:
    tpm2b(Buffer.from(x)),
    tpm2b(Buffer.from(y)),
  ]);
}

/** Build a TPMS_ATTEST (certInfo) for the given extraData + attested name. */
function buildCertInfo(extraData: Uint8Array, attestedName: Buffer): Buffer {
  return Buffer.concat([
    u32(TPM_GENERATED), // magic
    u16(TPM_ST_ATTEST_CERTIFY), // type
    tpm2b(Buffer.alloc(0)), // qualifiedSigner
    tpm2b(Buffer.from(extraData)), // extraData
    Buffer.alloc(17), // clockInfo (clock8 + reset4 + restart4 + safe1)
    Buffer.alloc(8), // firmwareVersion
    tpm2b(attestedName), // attested.name
    tpm2b(Buffer.alloc(0)), // attested.qualifiedName
  ]);
}

/** name = nameAlg(2 bytes) ‖ digest(pubArea). */
function tpmName(pubArea: Buffer): Buffer {
  const digest = createHash('sha256').update(pubArea).digest();
  return Buffer.concat([u16(TPM_ALG_SHA256), digest]);
}

function aikEkuExt(): CertExtension {
  return { oid: EXT_KEY_USAGE_OID, value: derSeq(derOid(AIK_EKU_OID)) };
}

function buildTpmFixture(overrides?: {
  wrongExtraData?: boolean;
  wrongName?: boolean;
  wrongKey?: boolean;
  omitEku?: boolean;
}) {
  const root = generateEcKeyPair();
  const aik = generateEcKeyPair();
  const cred = generateEcKeyPair();

  const coseBytes = ecCoseKeyFromJwk(cred.jwk);
  const credCose = parseCose(coseBytes);
  if (credCose.kty !== 2) {
    throw new Error('expected EC2 cred');
  }
  const credId = new Uint8Array(32).fill(31);
  const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
  const cdh = clientDataHash();

  // pubArea must carry the credential key (unless wrongKey).
  const px = overrides?.wrongKey ? new Uint8Array(32).fill(1) : credCose.x;
  const py = overrides?.wrongKey ? new Uint8Array(32).fill(2) : credCose.y;
  const pubArea = buildPubAreaEcc(px, py);

  const extraData = overrides?.wrongExtraData
    ? new Uint8Array(32).fill(0xee)
    : sha256(concatBuffers(authData, cdh));
  const attestedName = overrides?.wrongName ? Buffer.alloc(34, 0xab) : tpmName(pubArea);
  const certInfo = buildCertInfo(extraData, attestedName);

  const rootCert = buildCertificate({
    subject: { CN: 'TPM Test Root' },
    issuer: { CN: 'TPM Test Root' },
    subjectKey: root,
    issuerPrivateKey: root.privateKey,
    extensions: [basicConstraintsExt(true)],
  });
  const aikCert = buildCertificate({
    subject: { CN: 'TPM Test AIK' },
    issuer: { CN: 'TPM Test Root' },
    subjectKey: aik,
    issuerPrivateKey: root.privateKey,
    extensions: overrides?.omitEku ? [] : [aikEkuExt()],
  });

  // sig over certInfo by the AIK key (ES256).
  const sig = nodeSign('sha256', certInfo, aik.privateKey);

  return {
    rootCert,
    aikCert,
    coseBytes,
    authData,
    cdh,
    pubArea: new Uint8Array(pubArea),
    certInfo: new Uint8Array(certInfo),
    sig: new Uint8Array(sig),
  };
}

function attStmt(f: ReturnType<typeof buildTpmFixture>) {
  return new Map<string, unknown>([
    ['ver', '2.0'],
    ['alg', -7],
    ['sig', f.sig],
    ['certInfo', f.certInfo],
    ['pubArea', f.pubArea],
    ['x5c', [new Uint8Array(f.aikCert.raw)]],
  ]);
}

describe('tpm', () => {
  it('verifies + trust-anchors a valid TPM attestation → attestationVerified=true', () => {
    const f = buildTpmFixture();
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    const result = verifyTpmAttestation(
      makeVerifierInput({
        fmt: 'tpm',
        attStmt: attStmt(f),
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
    const f = buildTpmFixture();
    const result = verifyTpmAttestation(
      makeVerifierInput({
        fmt: 'tpm',
        attStmt: attStmt(f),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
      }),
    );
    expect(result.attestationVerified).toBe(false);
  });

  it('throws when the pubArea key does not match the credential key', () => {
    const f = buildTpmFixture({ wrongKey: true });
    expect(() =>
      verifyTpmAttestation(
        makeVerifierInput({
          fmt: 'tpm',
          attStmt: attStmt(f),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/pubArea public key does not match/);
  });

  it('throws when attested name does not match the pubArea', () => {
    const f = buildTpmFixture({ wrongName: true });
    expect(() =>
      verifyTpmAttestation(
        makeVerifierInput({
          fmt: 'tpm',
          attStmt: attStmt(f),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/attested name does not match/);
  });

  it('throws when extraData does not match hash(authData ‖ clientDataHash)', () => {
    const f = buildTpmFixture({ wrongExtraData: true });
    expect(() =>
      verifyTpmAttestation(
        makeVerifierInput({
          fmt: 'tpm',
          attStmt: attStmt(f),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/extraData does not match/);
  });

  it('throws when the AIK cert lacks the tcg-kp-AIKCertificate EKU', () => {
    const f = buildTpmFixture({ omitEku: true });
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    expect(() =>
      verifyTpmAttestation(
        makeVerifierInput({
          fmt: 'tpm',
          attStmt: attStmt(f),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
          metadataService,
        }),
      ),
    ).toThrow(/AIKCertificate EKU/);
  });

  it('throws on a malformed certInfo (bad magic)', () => {
    const f = buildTpmFixture();
    const badCertInfo = new Uint8Array(f.certInfo);
    badCertInfo[0] = 0x00; // corrupt the magic
    const stmt = new Map<string, unknown>([
      ['alg', -7],
      ['sig', f.sig],
      ['certInfo', badCertInfo],
      ['pubArea', f.pubArea],
      ['x5c', [new Uint8Array(f.aikCert.raw)]],
    ]);
    expect(() =>
      verifyTpmAttestation(
        makeVerifierInput({
          fmt: 'tpm',
          attStmt: stmt,
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(VerificationError);
  });

  it('throws when certInfo/pubArea/sig are missing', () => {
    const f = buildTpmFixture();
    expect(() =>
      verifyTpmAttestation(
        makeVerifierInput({
          fmt: 'tpm',
          attStmt: new Map<string, unknown>([['x5c', [new Uint8Array(f.aikCert.raw)]]]),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/missing certInfo/);
  });
});
