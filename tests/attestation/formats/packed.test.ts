import { describe, it, expect } from 'vitest';
import { sign as nodeSign } from 'node:crypto';
import { verifyPackedAttestation } from '@/attestation/formats';
import { StaticMetadataService } from '@/attestation';
import { VerificationError } from '@/types';
import { concatBuffers } from '@/utils/buffer';
import {
  buildCertificate,
  basicConstraintsExt,
  derOctet,
  generateEcKeyPair,
  type CertExtension,
} from './cert-builder';
import {
  TEST_AAGUID,
  TEST_AAGUID_UUID,
  buildAuthData,
  clientDataHash,
  ecCoseKeyFromJwk,
  makeVerifierInput,
  parseCose,
} from './helpers';

const PACKED_AAGUID_OID = '1.3.6.1.4.1.45724.1.1.4';

/** The packed AAGUID extension value: an OCTET STRING wrapping the 16-byte AAGUID. */
function aaguidExt(aaguid: Uint8Array, oid = PACKED_AAGUID_OID): CertExtension {
  return { oid, value: derOctet(Buffer.from(aaguid)) };
}

describe('packed — self attestation', () => {
  it('verifies a valid self-attestation with the credential key', () => {
    const cred = generateEcKeyPair();
    const coseBytes = ecCoseKeyFromJwk(cred.jwk);
    const credId = new Uint8Array(32).fill(1);
    const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
    const cdh = clientDataHash();
    const sig = nodeSign('sha256', concatBuffers(authData, cdh), cred.privateKey);

    const result = verifyPackedAttestation(
      makeVerifierInput({
        fmt: 'packed',
        attStmt: new Map<string, unknown>([
          ['alg', -7],
          ['sig', new Uint8Array(sig)],
        ]),
        authData,
        clientDataHash: cdh,
        credentialPublicKey: parseCose(coseBytes),
        aaguid: TEST_AAGUID,
      }),
    );

    expect(result.attestationVerified).toBe(true);
    expect(result.fmt).toBe('packed');
    expect(result.trustPath).toBeUndefined(); // self-attestation has no chain
  });

  it('throws on a tampered self-attestation signature', () => {
    const cred = generateEcKeyPair();
    const coseBytes = ecCoseKeyFromJwk(cred.jwk);
    const credId = new Uint8Array(32).fill(2);
    const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
    const cdh = clientDataHash();
    const sig = nodeSign('sha256', concatBuffers(authData, cdh), cred.privateKey);
    const badSig = new Uint8Array(sig);
    badSig[badSig.length - 1] ^= 0xff;

    expect(() =>
      verifyPackedAttestation(
        makeVerifierInput({
          fmt: 'packed',
          attStmt: new Map<string, unknown>([
            ['alg', -7],
            ['sig', badSig],
          ]),
          authData,
          clientDataHash: cdh,
          credentialPublicKey: parseCose(coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(VerificationError);
  });
});

describe('packed — x5c (full) attestation', () => {
  function buildX5cFixture(overrides?: {
    omitAaguidExt?: boolean;
    wrongAaguidExt?: boolean;
    badOu?: boolean;
    leafIsCa?: boolean;
  }) {
    const root = generateEcKeyPair();
    const leaf = generateEcKeyPair();
    const cred = leaf; // packed x5c attests the leaf cert's key matches nothing special;
    // sig is by the leaf key, credential key is independent.

    const rootCert = buildCertificate({
      subject: { CN: 'Packed Test Root' },
      issuer: { CN: 'Packed Test Root' },
      subjectKey: root,
      issuerPrivateKey: root.privateKey,
      extensions: [basicConstraintsExt(true)],
    });

    const extensions: CertExtension[] = [];
    if (!overrides?.omitAaguidExt) {
      extensions.push(
        aaguidExt(overrides?.wrongAaguidExt ? new Uint8Array(16).fill(0xab) : TEST_AAGUID),
      );
    }
    extensions.push(basicConstraintsExt(overrides?.leafIsCa ?? false));

    const leafCert = buildCertificate({
      subject: {
        CN: 'Packed Test Leaf',
        OU: overrides?.badOu ? 'Wrong OU' : 'Authenticator Attestation',
      },
      issuer: { CN: 'Packed Test Root' },
      subjectKey: leaf,
      issuerPrivateKey: root.privateKey,
      extensions,
    });

    // The credential key is a separate key (packed x5c does not require leaf==cred).
    const credKeyPair = generateEcKeyPair();
    const coseBytes = ecCoseKeyFromJwk(credKeyPair.jwk);
    const credId = new Uint8Array(32).fill(3);
    const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
    const cdh = clientDataHash();
    // packed sig is by the ATTESTATION (leaf) key over authData ‖ clientDataHash.
    const sig = nodeSign('sha256', concatBuffers(authData, cdh), leaf.privateKey);

    return {
      rootCert,
      leafCert,
      coseBytes,
      authData,
      cdh,
      sig: new Uint8Array(sig),
      cred,
    };
  }

  function attStmt(leafCert: { raw: Buffer }, sig: Uint8Array) {
    return new Map<string, unknown>([
      ['alg', -7],
      ['sig', sig],
      ['x5c', [new Uint8Array(leafCert.raw)]],
    ]);
  }

  it('verifies + trust-anchors a valid x5c chain (attestationVerified=true)', () => {
    const f = buildX5cFixture();
    const metadataService = new StaticMetadataService({
      rootsByAaguid: { [TEST_AAGUID_UUID]: [f.rootCert.toString()] },
    });

    const result = verifyPackedAttestation(
      makeVerifierInput({
        fmt: 'packed',
        attStmt: attStmt(f.leafCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
        metadataService,
      }),
    );

    expect(result.attestationVerified).toBe(true);
    expect(result.trustPath).toBeDefined();
    expect(result.trustPath?.[0]).toContain('BEGIN CERTIFICATE');
    expect(result.aaguid).toBe(TEST_AAGUID_UUID);
  });

  it('verifies cryptographically but is NOT trust-anchored without a metadataService (false, no throw)', () => {
    const f = buildX5cFixture();
    const result = verifyPackedAttestation(
      makeVerifierInput({
        fmt: 'packed',
        attStmt: attStmt(f.leafCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
      }),
    );
    expect(result.attestationVerified).toBe(false);
    expect(result.trustPath).toBeUndefined();
  });

  it('is NOT trust-anchored against an unrelated root (false)', () => {
    const f = buildX5cFixture();
    const unrelated = generateEcKeyPair();
    const unrelatedRoot = buildCertificate({
      subject: { CN: 'Unrelated Root' },
      issuer: { CN: 'Unrelated Root' },
      subjectKey: unrelated,
      issuerPrivateKey: unrelated.privateKey,
      extensions: [basicConstraintsExt(true)],
    });
    const metadataService = new StaticMetadataService({
      defaultRoots: [unrelatedRoot.toString()],
    });

    const result = verifyPackedAttestation(
      makeVerifierInput({
        fmt: 'packed',
        attStmt: attStmt(f.leafCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
        metadataService,
      }),
    );
    expect(result.attestationVerified).toBe(false);
  });

  it('throws when the signature is invalid', () => {
    const f = buildX5cFixture();
    const badSig = new Uint8Array(f.sig);
    badSig[badSig.length - 1] ^= 0xff;
    expect(() =>
      verifyPackedAttestation(
        makeVerifierInput({
          fmt: 'packed',
          attStmt: attStmt(f.leafCert, badSig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/signature is invalid/);
  });

  it('throws when the leaf subject OU is not "Authenticator Attestation"', () => {
    const f = buildX5cFixture({ badOu: true });
    expect(() =>
      verifyPackedAttestation(
        makeVerifierInput({
          fmt: 'packed',
          attStmt: attStmt(f.leafCert, f.sig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/Authenticator Attestation/);
  });

  it('throws when the leaf certificate is a CA', () => {
    const f = buildX5cFixture({ leafIsCa: true });
    expect(() =>
      verifyPackedAttestation(
        makeVerifierInput({
          fmt: 'packed',
          attStmt: attStmt(f.leafCert, f.sig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/CA = false/);
  });

  it('throws when the leaf AAGUID extension does not match authData AAGUID', () => {
    const f = buildX5cFixture({ wrongAaguidExt: true });
    expect(() =>
      verifyPackedAttestation(
        makeVerifierInput({
          fmt: 'packed',
          attStmt: attStmt(f.leafCert, f.sig),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/AAGUID extension does not match/);
  });

  it('accepts a leaf without the AAGUID extension (extension is optional)', () => {
    const f = buildX5cFixture({ omitAaguidExt: true });
    const metadataService = new StaticMetadataService({
      rootsByAaguid: { [TEST_AAGUID_UUID]: [f.rootCert.toString()] },
    });
    const result = verifyPackedAttestation(
      makeVerifierInput({
        fmt: 'packed',
        attStmt: attStmt(f.leafCert, f.sig),
        authData: f.authData,
        clientDataHash: f.cdh,
        credentialPublicKey: parseCose(f.coseBytes),
        aaguid: TEST_AAGUID,
        metadataService,
      }),
    );
    expect(result.attestationVerified).toBe(true);
  });
});
