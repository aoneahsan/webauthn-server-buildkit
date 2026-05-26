import { describe, it, expect } from 'vitest';
import { verifyAppleAttestation } from '@/attestation/formats';
import { StaticMetadataService, APPLE_WEBAUTHN_ROOT_CA_PEM, parseCertPem } from '@/attestation';
import { VerificationError } from '@/types';
import { sha256 } from '@/utils/hash';
import { concatBuffers } from '@/utils/buffer';
import {
  buildCertificate,
  basicConstraintsExt,
  derContext,
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

const APPLE_NONCE_OID = '1.2.840.113635.100.8.2';

/**
 * Build the Apple nonce extension value: `SEQUENCE { [1] { OCTET STRING nonce } }`.
 * `findExtension` returns the contents of the extnValue OCTET STRING, i.e. the
 * outer SEQUENCE bytes.
 */
function appleNonceExt(nonce: Uint8Array): CertExtension {
  const inner = derContext(1, derOctet(Buffer.from(nonce))); // [1] { OCTET STRING }
  return { oid: APPLE_NONCE_OID, value: derSeq(inner) };
}

/**
 * Build an apple-format fixture. The credential key and the leaf certificate key
 * are the SAME key (apple asserts leaf-key == credential-key). The nonce is
 * SHA-256(authData ‖ clientDataHash). Chains leaf → a generated test root that
 * is supplied to the verifier via the MetadataService (the production verifier
 * unions the bundled Apple root with RP-supplied roots, so this exercises the
 * real chain/nonce/key logic without weakening production code).
 */
function buildAppleFixture(overrides?: {
  wrongNonce?: boolean;
  wrongKey?: boolean;
  omitNonceExt?: boolean;
}) {
  const root: TestKeyPair = generateEcKeyPair();
  const credKey: TestKeyPair = generateEcKeyPair();

  const coseBytes = ecCoseKeyFromJwk(credKey.jwk);
  const credId = new Uint8Array(32).fill(7);
  const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });
  const cdh = clientDataHash();
  const realNonce = sha256(concatBuffers(authData, cdh));
  const nonce = overrides?.wrongNonce ? new Uint8Array(32).fill(0xaa) : realNonce;

  const rootCert = buildCertificate({
    subject: { CN: 'Apple Test Root' },
    issuer: { CN: 'Apple Test Root' },
    subjectKey: root,
    issuerPrivateKey: root.privateKey,
    extensions: [basicConstraintsExt(true)],
  });

  // Leaf uses the credential key (so leaf-key == credential-key), unless wrongKey.
  const leafKey = overrides?.wrongKey ? generateEcKeyPair() : credKey;
  const extensions: CertExtension[] = [];
  if (!overrides?.omitNonceExt) {
    extensions.push(appleNonceExt(nonce));
  }
  const leafCert = buildCertificate({
    subject: { CN: 'Apple Test Leaf' },
    issuer: { CN: 'Apple Test Root' },
    subjectKey: leafKey,
    issuerPrivateKey: root.privateKey,
    extensions,
  });

  return { rootCert, leafCert, coseBytes, authData, cdh, credKey };
}

function appleAttStmt(leafCert: { raw: Buffer }) {
  return new Map<string, unknown>([['x5c', [new Uint8Array(leafCert.raw)]]]);
}

describe('apple', () => {
  it('verifies a valid apple attestation (nonce + key + chain) → attestationVerified=true', () => {
    const f = buildAppleFixture();
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });

    const result = verifyAppleAttestation(
      makeVerifierInput({
        fmt: 'apple',
        attStmt: appleAttStmt(f.leafCert),
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

  it('throws on a nonce mismatch', () => {
    const f = buildAppleFixture({ wrongNonce: true });
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    expect(() =>
      verifyAppleAttestation(
        makeVerifierInput({
          fmt: 'apple',
          attStmt: appleAttStmt(f.leafCert),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
          metadataService,
        }),
      ),
    ).toThrow(/nonce/);
  });

  it('throws when the leaf certificate key does not match the credential key', () => {
    const f = buildAppleFixture({ wrongKey: true });
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    expect(() =>
      verifyAppleAttestation(
        makeVerifierInput({
          fmt: 'apple',
          attStmt: appleAttStmt(f.leafCert),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
          metadataService,
        }),
      ),
    ).toThrow(/does not match the credential public key/);
  });

  it('throws when the nonce extension is missing', () => {
    const f = buildAppleFixture({ omitNonceExt: true });
    const metadataService = new StaticMetadataService({ defaultRoots: [f.rootCert.toString()] });
    expect(() =>
      verifyAppleAttestation(
        makeVerifierInput({
          fmt: 'apple',
          attStmt: appleAttStmt(f.leafCert),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
          metadataService,
        }),
      ),
    ).toThrow(/nonce extension/);
  });

  it('throws when the chain does not anchor to the Apple root (no test root supplied)', () => {
    // Nonce + key are valid, but with no matching root the chain cannot anchor —
    // and apple treats an unanchorable chain as an invalid statement (throw),
    // since the bundled Apple root is the known anchor.
    const f = buildAppleFixture();
    expect(() =>
      verifyAppleAttestation(
        makeVerifierInput({
          fmt: 'apple',
          attStmt: appleAttStmt(f.leafCert),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(/chain does not anchor/);
  });

  it('throws when x5c is missing', () => {
    const f = buildAppleFixture();
    expect(() =>
      verifyAppleAttestation(
        makeVerifierInput({
          fmt: 'apple',
          attStmt: new Map(),
          authData: f.authData,
          clientDataHash: f.cdh,
          credentialPublicKey: parseCose(f.coseBytes),
          aaguid: TEST_AAGUID,
        }),
      ),
    ).toThrow(VerificationError);
  });

  it('parses the bundled Apple WebAuthn Root CA (sanity)', () => {
    const cert = parseCertPem(APPLE_WEBAUTHN_ROOT_CA_PEM);
    expect(cert.subject).toContain('Apple WebAuthn Root CA');
  });
});
