/**
 * FIDO Metadata Service abstraction.
 *
 * The FIDO Metadata Service (MDS) maps an authenticator (by AAGUID or by its
 * attestation-certificate key identifier) to the trusted root certificates and
 * policy metadata needed to trust-anchor its attestation statement. The MDS blob
 * is large and frequently updated, so this package does NOT bundle or fetch it.
 * Instead the relying party supplies the data through this interface, keeping the
 * package offline-by-default.
 *
 * All methods are SYNCHRONOUS by contract — they are consulted from inside the
 * synchronous attestation-verification path and must not return Promises.
 */

/** A single status report from a FIDO MDS metadata entry. */
export interface MetadataStatusReport {
  /**
   * Authenticator status, e.g. `FIDO_CERTIFIED`, `NOT_FIDO_CERTIFIED`,
   * `REVOKED`, `USER_VERIFICATION_BYPASS`. The relying party decides which
   * statuses are acceptable.
   */
  status: string;
  /** ISO-8601 date the status was reported, if known. */
  effectiveDate?: string;
}

/**
 * Minimal FIDO MDS metadata statement for an authenticator. Only the fields this
 * package surfaces are modeled; relying parties may carry richer data of their
 * own outside this type.
 */
export interface MetadataStatement {
  /** The authenticator AAGUID (lowercase, hyphenated UUID string). */
  aaguid: string;
  /** Human-readable description of the authenticator model. */
  description?: string;
  /** Status reports (certification level, revocation, known issues). */
  statusReports?: MetadataStatusReport[];
}

/** Query identifying an authenticator when looking up its trust anchors. */
export interface MetadataRootQuery {
  /** Authenticator AAGUID (lowercase, hyphenated UUID string), if available. */
  aaguid?: string;
  /**
   * Base64url SHA-1 (or other) key identifier of the attestation certificate,
   * used by formats (e.g. fido-u2f) that have no AAGUID.
   */
  attestationCertificateKeyIdentifier?: string;
}

/**
 * Pluggable trust-anchor / metadata provider supplied by the relying party.
 *
 * Implementations are constructed from RP-supplied FIDO MDS data; the package
 * ships a {@link StaticMetadataService} for the common "I have a fixed set of
 * roots" case.
 */
export interface MetadataService {
  /**
   * Return the trusted root certificate PEMs for the queried authenticator.
   * Used to anchor an attestation certificate chain. Return an empty array when
   * no trust anchors are known for the authenticator (the format verifier then
   * reports the attestation as not trust-anchored rather than rejecting it).
   *
   * MUST be synchronous.
   */
  getRootCertificates(query: MetadataRootQuery): string[];

  /**
   * Optionally return the FIDO MDS metadata statement for an AAGUID (status
   * reports, description). Relying parties use this to reject revoked or
   * uncertified authenticators. MUST be synchronous when implemented.
   */
  getStatement?(aaguid: string): MetadataStatement | undefined;
}
