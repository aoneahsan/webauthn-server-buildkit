import { VerificationError } from '@/types';

/**
 * Minimal, strict parsers for the two TPM 2.0 binary structures a WebAuthn `tpm`
 * attestation statement carries: `TPMS_ATTEST` (the `certInfo`) and
 * `TPMT_PUBLIC` (the `pubArea`). Only the fields the verifier consults are
 * decoded; everything is bounds-checked and fails closed via
 * {@link VerificationError} (`ATTESTATION_INVALID`).
 *
 * References: TPM 2.0 Library Specification, Part 2 (Structures).
 */

/** `TPM_GENERATED_VALUE` magic that prefixes a genuine TPMS_ATTEST. */
export const TPM_GENERATED_VALUE = 0xff544347;
/** `TPM_ST_ATTEST_CERTIFY` structure tag. */
export const TPM_ST_ATTEST_CERTIFY = 0x8017;

/** TPM_ALG_ID values used by WebAuthn tpm attestation. */
export const TPM_ALG = {
  RSA: 0x0001,
  SHA1: 0x0004,
  SHA256: 0x000b,
  SHA384: 0x000c,
  SHA512: 0x000d,
  NULL: 0x0010,
  ECC: 0x0023,
} as const;

/** TPM_ECC_CURVE values used by WebAuthn tpm attestation. */
export const TPM_ECC_CURVE = {
  NIST_P256: 0x0003,
  NIST_P384: 0x0004,
  NIST_P521: 0x0005,
} as const;

/** A bounded big-endian reader over a `Uint8Array`. */
class Reader {
  private offset = 0;
  constructor(private readonly buf: Uint8Array) {}

  private ensure(n: number): void {
    if (this.offset + n > this.buf.length) {
      throw new VerificationError('TPM structure truncated', 'ATTESTATION_INVALID');
    }
  }

  uint8(): number {
    this.ensure(1);
    return this.buf[this.offset++]!;
  }

  uint16(): number {
    this.ensure(2);
    const v = this.buf[this.offset]! * 256 + this.buf[this.offset + 1]!;
    this.offset += 2;
    return v;
  }

  uint32(): number {
    this.ensure(4);
    let v = 0;
    for (let i = 0; i < 4; i++) {
      v = v * 256 + this.buf[this.offset + i]!;
    }
    this.offset += 4;
    return v;
  }

  /** Read `n` raw bytes (a view into the source buffer). */
  bytes(n: number): Uint8Array {
    this.ensure(n);
    const out = this.buf.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  /** Read a TPM2B (UINT16 length-prefixed byte string). */
  sized(): Uint8Array {
    const size = this.uint16();
    return this.bytes(size);
  }

  skip(n: number): void {
    this.ensure(n);
    this.offset += n;
  }

  get remaining(): number {
    return this.buf.length - this.offset;
  }
}

/** Parsed subset of TPMS_ATTEST (`certInfo`). */
export interface TpmsAttest {
  /** The `extraData` field (must equal hash(authData ‖ clientDataHash)). */
  extraData: Uint8Array;
  /** The attested object `name` (2-byte alg id ‖ digest of pubArea). */
  attestedName: Uint8Array;
}

/**
 * Parse the subset of `TPMS_ATTEST` the WebAuthn tpm verifier needs.
 *
 * @throws {@link VerificationError} if magic/type are wrong or the structure is
 * truncated.
 */
export function parseCertInfo(certInfo: Uint8Array): TpmsAttest {
  const r = new Reader(certInfo);

  if (r.uint32() !== TPM_GENERATED_VALUE) {
    throw new VerificationError(
      'TPM certInfo magic is not TPM_GENERATED_VALUE',
      'ATTESTATION_INVALID',
    );
  }
  if (r.uint16() !== TPM_ST_ATTEST_CERTIFY) {
    throw new VerificationError(
      'TPM certInfo type is not TPM_ST_ATTEST_CERTIFY',
      'ATTESTATION_INVALID',
    );
  }

  r.sized(); // qualifiedSigner (TPM2B_NAME) — not used
  const extraData = r.sized().slice(); // copy out of the source view
  r.skip(17); // TPMS_CLOCK_INFO: clock(8) + resetCount(4) + restartCount(4) + safe(1)
  r.skip(8); // firmwareVersion (UINT64)
  const attestedName = r.sized().slice(); // attested.name (TPM2B_NAME)
  // attested.qualifiedName follows but is not needed.

  return { extraData, attestedName };
}

/** Parsed subset of TPMT_PUBLIC (`pubArea`). */
export interface TpmtPublic {
  /** TPM_ALG_ID of the key type (RSA or ECC). */
  type: number;
  /** TPM_ALG_ID of the name hash algorithm (`nameAlg`). */
  nameAlg: number;
  /** RSA modulus (`unique`), when `type === RSA`. */
  rsaModulus?: Uint8Array;
  /** RSA public exponent from the parameters (0 means the default 65537). */
  rsaExponent?: number;
  /** ECC public point X coordinate (`unique.x`), when `type === ECC`. */
  eccX?: Uint8Array;
  /** ECC public point Y coordinate (`unique.y`), when `type === ECC`. */
  eccY?: Uint8Array;
  /** TPM_ECC_CURVE id from the ECC parameters, when `type === ECC`. */
  eccCurve?: number;
}

/**
 * Parse the subset of `TPMT_PUBLIC` the WebAuthn tpm verifier needs (key type,
 * name-hash algorithm, and the public key material in `unique`).
 *
 * @throws {@link VerificationError} on an unsupported key type or truncation.
 */
export function parsePubArea(pubArea: Uint8Array): TpmtPublic {
  const r = new Reader(pubArea);

  const type = r.uint16();
  const nameAlg = r.uint16();
  r.uint32(); // objectAttributes — not used
  r.sized(); // authPolicy (TPM2B_DIGEST) — not used

  if (type === TPM_ALG.RSA) {
    // TPMS_RSA_PARMS: symmetric(TPMT_SYM_DEF_OBJECT) scheme(TPMT_RSA_SCHEME)
    // keyBits(UINT16) exponent(UINT32).
    r.uint16(); // symmetric algorithm
    r.uint16(); // scheme
    r.uint16(); // keyBits
    const exponent = r.uint32();
    // unique: TPM2B_PUBLIC_KEY_RSA (the modulus).
    const rsaModulus = r.sized().slice();
    return {
      type,
      nameAlg,
      rsaModulus,
      rsaExponent: exponent === 0 ? 65537 : exponent,
    };
  }

  if (type === TPM_ALG.ECC) {
    // TPMS_ECC_PARMS: symmetric scheme curveID(TPM_ECC_CURVE) kdf(TPMT_KDF_SCHEME).
    r.uint16(); // symmetric algorithm
    r.uint16(); // scheme
    const eccCurve = r.uint16(); // curveID
    r.uint16(); // kdf scheme
    // unique: TPMS_ECC_POINT { x TPM2B_ECC_PARAMETER, y TPM2B_ECC_PARAMETER }.
    const eccX = r.sized().slice();
    const eccY = r.sized().slice();
    return { type, nameAlg, eccX, eccY, eccCurve };
  }

  throw new VerificationError(
    `TPM pubArea has an unsupported key type (0x${type.toString(16)})`,
    'ATTESTATION_INVALID',
  );
}

/** Map a TPM_ALG_ID name-hash to a Node digest name, or `undefined` if unsupported. */
export function tpmHashToNodeDigest(alg: number): string | undefined {
  switch (alg) {
    case TPM_ALG.SHA1:
      return 'sha1';
    case TPM_ALG.SHA256:
      return 'sha256';
    case TPM_ALG.SHA384:
      return 'sha384';
    case TPM_ALG.SHA512:
      return 'sha512';
    default:
      return undefined;
  }
}
