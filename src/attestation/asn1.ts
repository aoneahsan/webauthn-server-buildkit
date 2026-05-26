import { VerificationError } from '@/types';

/**
 * Minimal, strict DER/ASN.1 reader for attestation-statement parsing.
 *
 * This is intentionally a *small* in-house reader — the package stays dependency-
 * lean (see Phase 5 architecture notes). It supports exactly what the WebAuthn
 * attestation formats need: walking SEQUENCE/SET structures, decoding OIDs,
 * reading OCTET STRING / INTEGER / BIT STRING contents, and locating an X.509
 * extension by OID inside a certificate's raw DER.
 *
 * Strictness contract:
 * - Definite-length encoding only (BER indefinite-length form is rejected).
 * - No reading past the end of the buffer (every length is bounds-checked).
 * - Overlong / truncated length octets are rejected.
 * - Throws {@link VerificationError} with code `ASN1_PARSE_ERROR` on any
 *   malformed input. Callers treat a throw as "fail closed".
 */

/** ASN.1 universal tag numbers used by the attestation parsers. */
export const ASN1_TAG = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

/**
 * A single parsed Tag-Length-Value triple.
 *
 * @property tag - The raw first identifier octet (class + constructed bit + tag number).
 * @property tagNumber - The low 5 bits of {@link tag} (the universal tag number for tags < 31).
 * @property constructed - Whether the constructed bit (0x20) is set.
 * @property content - The value bytes (a view; not copied).
 * @property contentStart - Offset of the first content byte within the source buffer.
 * @property end - Offset one past the last content byte within the source buffer.
 */
export interface Asn1Node {
  tag: number;
  tagNumber: number;
  constructed: boolean;
  content: Uint8Array;
  contentStart: number;
  end: number;
}

function fail(message: string): never {
  throw new VerificationError(message, 'ASN1_PARSE_ERROR');
}

/**
 * Read one DER TLV starting at `offset` within `buf`.
 *
 * @returns the parsed node, whose `end` is the offset to continue reading from.
 * @throws {@link VerificationError} on truncated input, indefinite length, or
 * overlong length encoding.
 */
export function readTLV(buf: Uint8Array, offset: number): Asn1Node {
  if (offset < 0 || offset >= buf.length) {
    fail('ASN.1: read past end of buffer');
  }

  const tag = buf[offset]!;
  const constructed = (tag & 0x20) !== 0;
  const tagNumber = tag & 0x1f;

  // High-tag-number form (tag number >= 31) is not used by any structure we
  // parse; reject it rather than silently mis-reading.
  if (tagNumber === 0x1f) {
    fail('ASN.1: high-tag-number form is not supported');
  }

  let pos = offset + 1;
  if (pos >= buf.length) {
    fail('ASN.1: truncated before length octet');
  }

  const lengthByte = buf[pos]!;
  pos += 1;

  let length: number;
  if ((lengthByte & 0x80) === 0) {
    // Short form: length is the low 7 bits.
    length = lengthByte;
  } else {
    // Long form: low 7 bits are the count of subsequent length octets.
    const numLengthBytes = lengthByte & 0x7f;
    if (numLengthBytes === 0) {
      // 0x80 == indefinite length (BER only) — forbidden in DER.
      fail('ASN.1: indefinite-length encoding is not allowed');
    }
    if (numLengthBytes > 4) {
      // A length needing more than 4 octets exceeds anything sane in a cert
      // and would overflow a 32-bit JS integer index.
      fail('ASN.1: length encoding too large');
    }
    if (pos + numLengthBytes > buf.length) {
      fail('ASN.1: truncated length octets');
    }
    length = 0;
    for (let i = 0; i < numLengthBytes; i++) {
      length = length * 256 + buf[pos + i]!;
    }
    pos += numLengthBytes;
  }

  const contentStart = pos;
  const end = contentStart + length;
  if (end > buf.length) {
    fail('ASN.1: content length exceeds buffer');
  }

  return {
    tag,
    tagNumber,
    constructed,
    content: buf.subarray(contentStart, end),
    contentStart,
    end,
  };
}

/**
 * Parse all sibling TLVs contained within `content` (e.g. the children of a
 * SEQUENCE or SET). Stops exactly at the end of `content`; any byte left over
 * (a child that overruns the container) is a parse error.
 */
export function readChildren(content: Uint8Array): Asn1Node[] {
  const children: Asn1Node[] = [];
  let offset = 0;
  while (offset < content.length) {
    const node = readTLV(content, offset);
    children.push(node);
    offset = node.end;
  }
  if (offset !== content.length) {
    fail('ASN.1: children do not exactly fill their container');
  }
  return children;
}

/**
 * Read a TLV at `offset`, assert it is a SEQUENCE, and return its children.
 */
export function readSequence(buf: Uint8Array, offset = 0): Asn1Node[] {
  const node = readTLV(buf, offset);
  if (node.tag !== ASN1_TAG.SEQUENCE) {
    fail(`ASN.1: expected SEQUENCE (0x30), got 0x${node.tag.toString(16)}`);
  }
  return readChildren(node.content);
}

/**
 * Read a TLV at `offset`, assert it is a SET, and return its children.
 */
export function readSet(buf: Uint8Array, offset = 0): Asn1Node[] {
  const node = readTLV(buf, offset);
  if (node.tag !== ASN1_TAG.SET) {
    fail(`ASN.1: expected SET (0x31), got 0x${node.tag.toString(16)}`);
  }
  return readChildren(node.content);
}

/**
 * Decode an OBJECT IDENTIFIER node's contents to a dotted-decimal string
 * (e.g. `"1.2.840.113635.100.8.2"`).
 *
 * Accepts either an {@link Asn1Node} (whose tag must be OID) or the raw OID
 * content bytes.
 */
export function decodeOID(input: Asn1Node | Uint8Array): string {
  let bytes: Uint8Array;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    if (input.tag !== ASN1_TAG.OID) {
      fail(`ASN.1: expected OID (0x06), got 0x${input.tag.toString(16)}`);
    }
    bytes = input.content;
  }

  if (bytes.length === 0) {
    fail('ASN.1: empty OID');
  }

  const parts: number[] = [];
  // First byte encodes the first two arcs: 40*X + Y.
  const first = bytes[0]!;
  parts.push(Math.floor(first / 40), first % 40);

  let value = 0;
  let started = false;
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i]!;
    // Each subsequent arc is base-128, high bit set on all but the final octet.
    value = value * 128 + (b & 0x7f);
    started = true;
    if ((b & 0x80) === 0) {
      parts.push(value);
      value = 0;
      started = false;
    }
  }
  if (started) {
    // The final arc had its continuation bit set with no terminating octet.
    fail('ASN.1: truncated OID arc');
  }

  return parts.join('.');
}

/**
 * Read the contents of an OCTET STRING node.
 *
 * @throws {@link VerificationError} if `node` is not an OCTET STRING.
 */
export function readOctetString(node: Asn1Node): Uint8Array {
  if (node.tag !== ASN1_TAG.OCTET_STRING) {
    fail(`ASN.1: expected OCTET STRING (0x04), got 0x${node.tag.toString(16)}`);
  }
  return node.content;
}

/**
 * Read the contents of an INTEGER node (raw big-endian two's-complement bytes,
 * including any leading 0x00 sign byte).
 *
 * @throws {@link VerificationError} if `node` is not an INTEGER.
 */
export function readInteger(node: Asn1Node): Uint8Array {
  if (node.tag !== ASN1_TAG.INTEGER) {
    fail(`ASN.1: expected INTEGER (0x02), got 0x${node.tag.toString(16)}`);
  }
  return node.content;
}

/**
 * Read the payload bits of a BIT STRING node, dropping the leading
 * "unused bits" count octet. Rejects an unused-bit count greater than 7.
 *
 * @throws {@link VerificationError} if `node` is not a BIT STRING or is empty.
 */
export function readBitString(node: Asn1Node): Uint8Array {
  if (node.tag !== ASN1_TAG.BIT_STRING) {
    fail(`ASN.1: expected BIT STRING (0x03), got 0x${node.tag.toString(16)}`);
  }
  if (node.content.length === 0) {
    fail('ASN.1: empty BIT STRING');
  }
  const unusedBits = node.content[0]!;
  if (unusedBits > 7) {
    fail('ASN.1: BIT STRING unused-bit count out of range');
  }
  return node.content.subarray(1);
}

/**
 * Locate an X.509 v3 extension by OID within a certificate's raw DER and return
 * its `extnValue` OCTET STRING contents (the DER-encoded extension value).
 *
 * Walk: Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm,
 * signatureValue }. Within tbsCertificate, the OPTIONAL `extensions` field is
 * `[3] EXPLICIT SEQUENCE OF Extension`, and each `Extension ::= SEQUENCE {
 * extnID OID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING }`.
 *
 * @param certDer - The full DER bytes of the certificate (e.g. `cert.raw`).
 * @param oid - Dotted-decimal extension OID to find.
 * @returns the `extnValue` OCTET STRING contents, or `undefined` if absent.
 * @throws {@link VerificationError} if the certificate DER is malformed.
 */
export function findExtension(certDer: Uint8Array, oid: string): Uint8Array | undefined {
  // Certificate ::= SEQUENCE { tbsCertificate, sigAlg, sigValue }
  const certChildren = readSequence(certDer, 0);
  const tbs = certChildren[0];
  if (!tbs || tbs.tag !== ASN1_TAG.SEQUENCE) {
    fail('ASN.1: certificate missing tbsCertificate SEQUENCE');
  }

  // Find the [3] EXPLICIT context-tagged element holding the extensions.
  // Context-class constructed tag [3] == 0xA3.
  const tbsChildren = readChildren(tbs.content);
  const extensionsWrapper = tbsChildren.find((node) => node.tag === 0xa3);
  if (!extensionsWrapper) {
    // No extensions present at all.
    return undefined;
  }

  // [3] EXPLICIT wraps a single SEQUENCE OF Extension.
  const extSeq = readTLV(extensionsWrapper.content, 0);
  if (extSeq.tag !== ASN1_TAG.SEQUENCE) {
    fail('ASN.1: extensions wrapper does not contain a SEQUENCE');
  }

  const extensions = readChildren(extSeq.content);
  for (const ext of extensions) {
    if (ext.tag !== ASN1_TAG.SEQUENCE) {
      fail('ASN.1: extension entry is not a SEQUENCE');
    }
    const extFields = readChildren(ext.content);
    const oidNode = extFields[0];
    if (!oidNode || oidNode.tag !== ASN1_TAG.OID) {
      fail('ASN.1: extension missing extnID OID');
    }
    if (decodeOID(oidNode) !== oid) {
      continue;
    }
    // extnValue is the last field and is always an OCTET STRING; the optional
    // `critical` BOOLEAN may sit between the OID and the value.
    const valueNode = extFields[extFields.length - 1];
    if (!valueNode || valueNode.tag !== ASN1_TAG.OCTET_STRING) {
      fail('ASN.1: extension missing extnValue OCTET STRING');
    }
    return valueNode.content;
  }

  return undefined;
}
