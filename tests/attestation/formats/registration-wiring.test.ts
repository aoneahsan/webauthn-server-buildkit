import { describe, it, expect } from 'vitest';
import { sign as nodeSign } from 'node:crypto';
import { WebAuthnServer } from '@/server';
import { StaticMetadataService } from '@/attestation';
import { encodeCBOR } from '@/crypto';
import { sha256 } from '@/utils/hash';
import { concatBuffers } from '@/utils/buffer';
import { bufferToBase64URL, base64URLToBuffer, stringToBase64URL } from '@/utils/base64url';
import { buildCertificate, basicConstraintsExt, derOctet, generateEcKeyPair } from './cert-builder';
import { TEST_AAGUID, TEST_AAGUID_UUID, buildAuthData, ecCoseKeyFromJwk } from './helpers';

const RP_ID = 'example.com';
const ORIGIN = 'https://example.com';
const SECRET = 'test-encryption-secret-at-least-32-characters-long';
const PACKED_AAGUID_OID = '1.3.6.1.4.1.45724.1.1.4';

const challenge = bufferToBase64URL(new Uint8Array(32).fill(7));

/** Build a full packed-x5c registration response + the trusted root PEM. */
function buildPackedX5cRegistration() {
  const root = generateEcKeyPair();
  const leaf = generateEcKeyPair();
  const cred = generateEcKeyPair();

  const coseBytes = ecCoseKeyFromJwk(cred.jwk);
  const credId = new Uint8Array(32).fill(42);
  const authData = buildAuthData({ coseKey: coseBytes, credId, aaguid: TEST_AAGUID });

  const clientDataJSON = stringToBase64URL(
    JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN }),
  );
  const cdh = sha256(base64URLToBuffer(clientDataJSON));

  const rootCert = buildCertificate({
    subject: { CN: 'Wiring Root' },
    issuer: { CN: 'Wiring Root' },
    subjectKey: root,
    issuerPrivateKey: root.privateKey,
    extensions: [basicConstraintsExt(true)],
  });
  const leafCert = buildCertificate({
    subject: { CN: 'Wiring Leaf', OU: 'Authenticator Attestation' },
    issuer: { CN: 'Wiring Root' },
    subjectKey: leaf,
    issuerPrivateKey: root.privateKey,
    extensions: [
      { oid: PACKED_AAGUID_OID, value: derOctet(Buffer.from(TEST_AAGUID)) },
      basicConstraintsExt(false),
    ],
  });

  const sig = nodeSign('sha256', concatBuffers(authData, cdh), leaf.privateKey);
  const attObj = encodeCBOR(
    new Map<string, unknown>([
      ['fmt', 'packed'],
      [
        'attStmt',
        new Map<string, unknown>([
          ['alg', -7],
          ['sig', new Uint8Array(sig)],
          ['x5c', [new Uint8Array(leafCert.raw)]],
        ]),
      ],
      ['authData', authData],
    ]),
  );

  const response = {
    id: bufferToBase64URL(credId),
    rawId: bufferToBase64URL(credId),
    response: {
      attestationObject: bufferToBase64URL(attObj),
      clientDataJSON,
      transports: ['internal'],
    },
    clientExtensionResults: {},
    type: 'public-key' as const,
  };

  return { response, rootPem: rootCert.toString() };
}

describe('registration wiring — packed x5c attestation through WebAuthnServer', () => {
  it('surfaces trustPath + attestationVerified=true when trust-anchored via metadataService', async () => {
    const { response, rootPem } = buildPackedX5cRegistration();
    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
      attestationType: 'direct',
      metadataService: new StaticMetadataService({
        rootsByAaguid: { [TEST_AAGUID_UUID]: [rootPem] },
      }),
    });

    const result = await server.verifyRegistration(response, challenge);
    expect(result.verified).toBe(true);
    expect(result.registrationInfo?.fmt).toBe('packed');
    expect(result.registrationInfo?.attestationVerified).toBe(true);
    expect(result.registrationInfo?.trustPath?.[0]).toContain('BEGIN CERTIFICATE');
  });

  it('warns but verifies (attestationVerified=false) when no metadataService and requireTrustedAttestation is off', async () => {
    const { response } = buildPackedX5cRegistration();
    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
      attestationType: 'direct',
    });

    const result = await server.verifyRegistration(response, challenge);
    expect(result.verified).toBe(true);
    expect(result.registrationInfo?.attestationVerified).toBe(false);
    expect(result.registrationInfo?.trustPath).toBeUndefined();
  });

  it('rejects with ATTESTATION_NOT_TRUSTED when requireTrustedAttestation is on and no anchor available', async () => {
    const { response } = buildPackedX5cRegistration();
    const server = new WebAuthnServer({
      rpName: 'Test',
      rpID: RP_ID,
      origin: ORIGIN,
      encryptionSecret: SECRET,
      attestationType: 'direct',
      requireTrustedAttestation: true,
    });

    await expect(server.verifyRegistration(response, challenge)).rejects.toThrow(
      /could not be trust-anchored/,
    );
  });
});
