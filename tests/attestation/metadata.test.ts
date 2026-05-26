import { describe, it, expect } from 'vitest';
import { StaticMetadataService, APPLE_WEBAUTHN_ROOT_CA_PEM } from '@/attestation';
import type { MetadataService, MetadataStatement } from '@/types';

const AAGUID = '00112233-4455-6677-8899-aabbccddeeff';
const ROOT_A = '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----';
const ROOT_B = '-----BEGIN CERTIFICATE-----\nBBB\n-----END CERTIFICATE-----';

describe('StaticMetadataService — getRootCertificates', () => {
  it('returns supplied roots by AAGUID (case-insensitive)', () => {
    const svc = new StaticMetadataService({ rootsByAaguid: { [AAGUID]: [ROOT_A] } });
    expect(svc.getRootCertificates({ aaguid: AAGUID })).toEqual([ROOT_A]);
    expect(svc.getRootCertificates({ aaguid: AAGUID.toUpperCase() })).toEqual([ROOT_A]);
  });

  it('returns roots by attestation-certificate key identifier', () => {
    const svc = new StaticMetadataService({ rootsByCertKeyId: { 'key-id-1': [ROOT_B] } });
    expect(svc.getRootCertificates({ attestationCertificateKeyIdentifier: 'key-id-1' })).toEqual([
      ROOT_B,
    ]);
  });

  it('falls back to defaultRoots when nothing matches', () => {
    const svc = new StaticMetadataService({ defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM] });
    expect(svc.getRootCertificates({ aaguid: 'unknown-aaguid' })).toEqual([
      APPLE_WEBAUTHN_ROOT_CA_PEM,
    ]);
    expect(svc.getRootCertificates({})).toEqual([APPLE_WEBAUTHN_ROOT_CA_PEM]);
  });

  it('returns [] when no roots are configured at all', () => {
    const svc = new StaticMetadataService();
    expect(svc.getRootCertificates({ aaguid: AAGUID })).toEqual([]);
    expect(svc.getRootCertificates({})).toEqual([]);
  });

  it('prefers the AAGUID match over defaultRoots', () => {
    const svc = new StaticMetadataService({
      rootsByAaguid: { [AAGUID]: [ROOT_A] },
      defaultRoots: [ROOT_B],
    });
    expect(svc.getRootCertificates({ aaguid: AAGUID })).toEqual([ROOT_A]);
    expect(svc.getRootCertificates({ aaguid: 'other' })).toEqual([ROOT_B]);
  });

  it('skips an empty AAGUID entry and falls through to defaultRoots', () => {
    const svc = new StaticMetadataService({
      rootsByAaguid: { [AAGUID]: [] },
      defaultRoots: [ROOT_B],
    });
    expect(svc.getRootCertificates({ aaguid: AAGUID })).toEqual([ROOT_B]);
  });
});

describe('StaticMetadataService — getStatement', () => {
  it('returns the stored metadata statement by AAGUID (case-insensitive)', () => {
    const statement: MetadataStatement = {
      aaguid: AAGUID,
      description: 'Test Authenticator',
      statusReports: [{ status: 'FIDO_CERTIFIED' }],
    };
    const svc = new StaticMetadataService({ statements: { [AAGUID]: statement } });
    expect(svc.getStatement(AAGUID)).toBe(statement);
    expect(svc.getStatement(AAGUID.toUpperCase())).toBe(statement);
  });

  it('returns undefined for an unknown AAGUID', () => {
    const svc = new StaticMetadataService();
    expect(svc.getStatement('unknown')).toBeUndefined();
  });
});

describe('StaticMetadataService — interface conformance', () => {
  it('is assignable to the MetadataService interface', () => {
    const svc: MetadataService = new StaticMetadataService({ defaultRoots: [ROOT_A] });
    expect(svc.getRootCertificates({})).toEqual([ROOT_A]);
  });
});
