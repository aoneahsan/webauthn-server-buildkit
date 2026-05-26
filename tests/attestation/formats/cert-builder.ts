/**
 * Test-only X.509 certificate builder.
 *
 * Mints real, signed DER certificates (EC P-256) with arbitrary extensions so
 * the per-format attestation tests can bind dynamic values — the Apple nonce,
 * the android-key challenge, the packed AAGUID — that depend on each test's
 * authData/clientDataHash. The certificates verify with Node's
 * `X509Certificate.verify` / `checkIssued`, so the production verifiers and the
 * `verifyCertChain` helper exercise genuine cryptography (no hard-coded,
 * unverifiable vectors).
 *
 * This file is NOT shipped — it lives under `tests/` only.
 */

import {
  createSign,
  generateKeyPairSync,
  X509Certificate,
  type KeyObject,
  type JsonWebKey,
} from 'node:crypto';

// ---- minimal DER encoders -------------------------------------------------

function encodeLength(n: number): Buffer {
  if (n < 0x80) {
    return Buffer.from([n]);
  }
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x = Math.floor(x / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

export function derSeq(...parts: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(parts));
}

function derSet(...parts: Buffer[]): Buffer {
  return tlv(0x31, Buffer.concat(parts));
}

export function derOid(dotted: string): Buffer {
  const arcs = dotted.split('.').map((p) => parseInt(p, 10));
  const first = 40 * arcs[0]! + arcs[1]!;
  const rest: number[] = [];
  for (let i = 2; i < arcs.length; i++) {
    let v = arcs[i]!;
    const tmp = [v & 0x7f];
    v = Math.floor(v / 128);
    while (v > 0) {
      tmp.unshift((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    rest.push(...tmp);
  }
  return tlv(0x06, Buffer.from([first, ...rest]));
}

function derSmallInt(n: number): Buffer {
  return tlv(0x02, Buffer.from([n]));
}

function derBigInt(buf: Buffer): Buffer {
  const b = buf[0]! & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf;
  return tlv(0x02, b);
}

export function derOctet(buf: Buffer): Buffer {
  return tlv(0x04, buf);
}

function derBitString(buf: Buffer): Buffer {
  return tlv(0x03, Buffer.concat([Buffer.from([0]), buf]));
}

function derBool(value: boolean): Buffer {
  return tlv(0x01, Buffer.from([value ? 0xff : 0x00]));
}

export function derContext(n: number, content: Buffer, constructed = true): Buffer {
  return tlv(0xa0 | n | (constructed ? 0x20 : 0), content);
}

function derUtf8(s: string): Buffer {
  return tlv(0x0c, Buffer.from(s, 'utf8'));
}

function derUtcTime(s: string): Buffer {
  return tlv(0x17, Buffer.from(s, 'ascii'));
}

// ---- name + SPKI ----------------------------------------------------------

const OID_CN = '2.5.4.3';
const OID_OU = '2.5.4.11';
const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';
const OID_PRIME256V1 = '1.2.840.10045.3.1.7';
const OID_ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const OID_BASIC_CONSTRAINTS = '2.5.29.19';

/** A relative distinguished name with an optional OU. */
export interface DistinguishedName {
  CN: string;
  OU?: string;
}

function encodeName(dn: DistinguishedName): Buffer {
  const rdns: Buffer[] = [derSet(derSeq(derOid(OID_CN), derUtf8(dn.CN)))];
  if (dn.OU !== undefined) {
    rdns.push(derSet(derSeq(derOid(OID_OU), derUtf8(dn.OU))));
  }
  return derSeq(...rdns);
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function ecSpki(jwk: JsonWebKey): Buffer {
  const x = b64urlToBuf(jwk.x ?? '');
  const y = b64urlToBuf(jwk.y ?? '');
  const point = Buffer.concat([Buffer.from([0x04]), x, y]);
  return derSeq(derSeq(derOid(OID_EC_PUBLIC_KEY), derOid(OID_PRIME256V1)), derBitString(point));
}

// ---- extension helpers ----------------------------------------------------

/** A single X.509 extension (extnID + DER-encoded extnValue contents). */
export interface CertExtension {
  oid: string;
  /** The DER bytes that go *inside* the extnValue OCTET STRING. */
  value: Buffer;
  critical?: boolean;
}

function encodeExtension(ext: CertExtension): Buffer {
  const fields: Buffer[] = [derOid(ext.oid)];
  if (ext.critical) {
    fields.push(derBool(true));
  }
  fields.push(derOctet(ext.value));
  return derSeq(...fields);
}

/** BasicConstraints extension (`cA` boolean). */
export function basicConstraintsExt(ca: boolean): CertExtension {
  return { oid: OID_BASIC_CONSTRAINTS, value: derSeq(derBool(ca)), critical: true };
}

// ---- key + cert generation ------------------------------------------------

/** A generated EC P-256 key pair with its JWK. */
export interface TestKeyPair {
  publicKey: KeyObject;
  privateKey: KeyObject;
  jwk: JsonWebKey;
}

/** Generate a fresh EC P-256 key pair. */
export function generateEcKeyPair(): TestKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { publicKey, privateKey, jwk: publicKey.export({ format: 'jwk' }) };
}

let serialCounter = 0x1000;

/** Options for {@link buildCertificate}. */
export interface BuildCertificateOptions {
  subject: DistinguishedName;
  issuer: DistinguishedName;
  subjectKey: TestKeyPair;
  /** Private key that signs the cert (the issuer's key). */
  issuerPrivateKey: KeyObject;
  extensions?: CertExtension[];
  /** Override validity window (defaults to 2025-01-01 → 2035-01-01). */
  notBefore?: string;
  notAfter?: string;
}

/**
 * Build and sign a DER certificate (ECDSA-with-SHA-256), returning the parsed
 * Node {@link X509Certificate}.
 */
export function buildCertificate(options: BuildCertificateOptions): X509Certificate {
  const serial = Buffer.from([(serialCounter >> 8) & 0xff, serialCounter & 0xff]);
  serialCounter += 1;

  const extBytes =
    options.extensions && options.extensions.length > 0
      ? [derContext(3, derSeq(...options.extensions.map(encodeExtension)))]
      : [];

  const tbs = derSeq(
    derContext(0, derSmallInt(2)), // version v3
    derBigInt(serial),
    derSeq(derOid(OID_ECDSA_SHA256)),
    encodeName(options.issuer),
    derSeq(
      derUtcTime(options.notBefore ?? '250101000000Z'),
      derUtcTime(options.notAfter ?? '350101000000Z'),
    ),
    encodeName(options.subject),
    ecSpki(options.subjectKey.jwk),
    ...extBytes,
  );

  const signer = createSign('sha256');
  signer.update(tbs);
  const signature = signer.sign(options.issuerPrivateKey);

  const certDer = derSeq(tbs, derSeq(derOid(OID_ECDSA_SHA256)), derBitString(signature));
  return new X509Certificate(certDer);
}
