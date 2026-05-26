import { describe, it, expect } from 'vitest';
import {
  ASN1_TAG,
  readTLV,
  readSequence,
  readChildren,
  decodeOID,
  readOctetString,
  readInteger,
  readBitString,
  findExtension,
} from '@/attestation/asn1';
import { pemToDer } from '@/attestation/x509';
import { VerificationError } from '@/types';
import { bufferToHex } from '@/utils/buffer';
import { TEST_LEAF_PEM, TEST_LEAF_AAGUID_EXT_OID, TEST_LEAF_AAGUID_HEX } from './fixtures';

describe('asn1 — readTLV', () => {
  it('parses a short-form SEQUENCE of two INTEGERs', () => {
    // SEQUENCE { INTEGER 1, INTEGER 0x0102 }
    const der = Uint8Array.from([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x02, 0x01, 0x02]);
    const node = readTLV(der, 0);
    expect(node.tag).toBe(ASN1_TAG.SEQUENCE);
    expect(node.constructed).toBe(true);
    expect(node.end).toBe(9);

    const children = readChildren(node.content);
    expect(children).toHaveLength(2);
    expect(readInteger(children[0]!)).toEqual(Uint8Array.from([0x01]));
    expect(readInteger(children[1]!)).toEqual(Uint8Array.from([0x01, 0x02]));
  });

  it('parses a long-form length (0x81)', () => {
    // OCTET STRING with a 200-byte payload uses the long form: 0x04 0x81 0xC8 ...
    const payload = new Uint8Array(200).fill(0xab);
    const der = Uint8Array.from([0x04, 0x81, 0xc8, ...payload]);
    const node = readTLV(der, 0);
    expect(node.tag).toBe(ASN1_TAG.OCTET_STRING);
    expect(readOctetString(node)).toHaveLength(200);
    expect(node.end).toBe(203);
  });

  it('reads a BIT STRING dropping the unused-bits octet', () => {
    // BIT STRING { 0 unused bits, payload 0xCA 0xFE }
    const der = Uint8Array.from([0x03, 0x03, 0x00, 0xca, 0xfe]);
    const node = readTLV(der, 0);
    expect(readBitString(node)).toEqual(Uint8Array.from([0xca, 0xfe]));
  });

  it('rejects indefinite-length encoding', () => {
    const der = Uint8Array.from([0x30, 0x80, 0x00, 0x00]);
    expect(() => readTLV(der, 0)).toThrow(VerificationError);
    expect(() => readTLV(der, 0)).toThrow(/indefinite-length/i);
  });

  it('rejects a length that overruns the buffer', () => {
    // Claims 5 content bytes but only 2 are present.
    const der = Uint8Array.from([0x04, 0x05, 0x01, 0x02]);
    expect(() => readTLV(der, 0)).toThrow(/exceeds buffer/i);
  });

  it('rejects truncated input (no length octet)', () => {
    const der = Uint8Array.from([0x30]);
    expect(() => readTLV(der, 0)).toThrow(/truncated/i);
  });

  it('rejects reading past the end of the buffer', () => {
    const der = Uint8Array.from([0x02, 0x01, 0x05]);
    expect(() => readTLV(der, 3)).toThrow(/past end/i);
  });

  it('rejects children that do not exactly fill their container', () => {
    // SEQUENCE content claims 3 bytes, but the inner INTEGER consumes only 3 and
    // leaves a dangling byte if mis-sized. Here the inner TLV overruns.
    const content = Uint8Array.from([0x02, 0x05, 0x01]); // INTEGER len 5, only 1 byte
    expect(() => readChildren(content)).toThrow(VerificationError);
  });
});

describe('asn1 — decodeOID', () => {
  it('decodes a multi-byte OID (Apple anonymous attestation nonce)', () => {
    // 1.2.840.113635.100.8.2 → DER content bytes.
    const oidContent = Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x08, 0x02]);
    expect(decodeOID(oidContent)).toBe('1.2.840.113635.100.8.2');
  });

  it('decodes a short OID via an OID node', () => {
    // OID 2.5.29.19 (basicConstraints): 0x06 0x03 0x55 0x1D 0x13
    const node = readTLV(Uint8Array.from([0x06, 0x03, 0x55, 0x1d, 0x13]), 0);
    expect(decodeOID(node)).toBe('2.5.29.19');
  });

  it('rejects an empty OID', () => {
    expect(() => decodeOID(new Uint8Array(0))).toThrow(/empty OID/i);
  });

  it('rejects a truncated final arc', () => {
    // Continuation bit set on the last octet with no terminator.
    const oidContent = Uint8Array.from([0x2a, 0x86]);
    expect(() => decodeOID(oidContent)).toThrow(/truncated OID/i);
  });
});

describe('asn1 — findExtension against a real certificate', () => {
  it('extracts a custom extension (FIDO AAGUID) value by OID', () => {
    const der = pemToDer(TEST_LEAF_PEM);
    const extnValue = findExtension(der, TEST_LEAF_AAGUID_EXT_OID);
    expect(extnValue).toBeDefined();

    // extnValue is itself the DER of an OCTET STRING wrapping the 16-byte AAGUID.
    const inner = readOctetString(readTLV(extnValue!, 0));
    expect(bufferToHex(inner)).toBe(TEST_LEAF_AAGUID_HEX);
  });

  it('extracts the standard basicConstraints extension (2.5.29.19)', () => {
    const der = pemToDer(TEST_LEAF_PEM);
    const extnValue = findExtension(der, '2.5.29.19');
    expect(extnValue).toBeDefined();
    // basicConstraints value is a SEQUENCE.
    expect(readTLV(extnValue!, 0).tag).toBe(ASN1_TAG.SEQUENCE);
  });

  it('returns undefined for an OID not present in the certificate', () => {
    const der = pemToDer(TEST_LEAF_PEM);
    expect(findExtension(der, '1.2.3.4.5.6.7.8.9')).toBeUndefined();
  });

  it('throws on malformed certificate DER', () => {
    expect(() => findExtension(Uint8Array.from([0x30, 0x02, 0x01]), '2.5.29.19')).toThrow(
      VerificationError,
    );
  });

  it('confirms the leaf cert parses as a SEQUENCE of three elements (tbs, sigAlg, sig)', () => {
    const der = pemToDer(TEST_LEAF_PEM);
    const children = readSequence(der, 0);
    expect(children).toHaveLength(3);
    expect(children[0]!.tag).toBe(ASN1_TAG.SEQUENCE); // tbsCertificate
  });
});
