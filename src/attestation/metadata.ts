import type { MetadataRootQuery, MetadataService, MetadataStatement } from '@/types';

/** Construction options for {@link StaticMetadataService}. */
export interface StaticMetadataServiceOptions {
  /**
   * Trusted root certificate PEMs keyed by authenticator AAGUID (lowercase,
   * hyphenated UUID string). Matched first when a query supplies an `aaguid`.
   */
  rootsByAaguid?: Record<string, string[]>;
  /**
   * Trusted root certificate PEMs keyed by attestation-certificate key
   * identifier (base64url). Matched for formats without an AAGUID (e.g.
   * fido-u2f) and as a secondary lookup.
   */
  rootsByCertKeyId?: Record<string, string[]>;
  /**
   * Fallback root certificate PEMs returned when neither the AAGUID nor the
   * cert-key-id lookup matches. Useful for a single-vendor deployment with one
   * known root (e.g. the bundled Apple WebAuthn Root CA).
   */
  defaultRoots?: string[];
  /** FIDO MDS metadata statements keyed by AAGUID. */
  statements?: Record<string, MetadataStatement>;
}

/**
 * A simple, fully in-memory {@link MetadataService} built from RP-supplied data.
 *
 * The relying party constructs it once with the roots / statements it trusts
 * (typically derived from a downloaded FIDO MDS blob, or a fixed vendor root
 * such as {@link APPLE_WEBAUTHN_ROOT_CA_PEM}). All lookups are synchronous and
 * allocation-free beyond returning the stored arrays.
 *
 * @example
 * ```typescript
 * import { StaticMetadataService, APPLE_WEBAUTHN_ROOT_CA_PEM } from 'webauthn-server-buildkit';
 *
 * const metadataService = new StaticMetadataService({
 *   defaultRoots: [APPLE_WEBAUTHN_ROOT_CA_PEM],
 * });
 * ```
 */
export class StaticMetadataService implements MetadataService {
  private readonly rootsByAaguid: Record<string, string[]>;
  private readonly rootsByCertKeyId: Record<string, string[]>;
  private readonly defaultRoots: string[];
  private readonly statements: Record<string, MetadataStatement>;

  constructor(options: StaticMetadataServiceOptions = {}) {
    this.rootsByAaguid = options.rootsByAaguid ?? {};
    this.rootsByCertKeyId = options.rootsByCertKeyId ?? {};
    this.defaultRoots = options.defaultRoots ?? [];
    this.statements = options.statements ?? {};
  }

  /**
   * Return trusted root PEMs for the queried authenticator, trying the AAGUID
   * map first, then the cert-key-id map, then {@link defaultRoots}.
   */
  getRootCertificates(query: MetadataRootQuery): string[] {
    if (query.aaguid) {
      const byAaguid = this.rootsByAaguid[query.aaguid.toLowerCase()];
      if (byAaguid && byAaguid.length > 0) {
        return byAaguid;
      }
    }

    if (query.attestationCertificateKeyIdentifier) {
      const byKeyId = this.rootsByCertKeyId[query.attestationCertificateKeyIdentifier];
      if (byKeyId && byKeyId.length > 0) {
        return byKeyId;
      }
    }

    return this.defaultRoots;
  }

  /** Return the stored metadata statement for an AAGUID, if any. */
  getStatement(aaguid: string): MetadataStatement | undefined {
    return this.statements[aaguid.toLowerCase()];
  }
}
