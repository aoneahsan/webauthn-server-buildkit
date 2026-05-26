/**
 * Static certificate fixtures for the attestation-foundation tests.
 *
 * - `TEST_ROOT_PEM` / `TEST_LEAF_PEM` form a real 2-cert chain (P-256): the leaf
 *   is signed by the root and carries a custom extension at OID
 *   `1.3.6.1.4.1.45724.1.1.4` (the FIDO AAGUID extension) whose value is an
 *   OCTET STRING wrapping the 16-byte AAGUID `00112233445566778899aabbccddeeff`.
 * - `UNRELATED_ROOT_PEM` is an independent self-signed CA used for negative
 *   chain tests.
 *
 * Generated with `openssl` (prime256v1) during the v2.3.0 attestation-foundation
 * phase; valid ~10 years from generation. Tests that exercise the validity
 * window pass an explicit far-future `now` rather than relying on wall-clock
 * expiry, so they stay deterministic.
 */

export const TEST_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIBsTCCAVegAwIBAgIUCoaroo7zcYc8TdNd/i/aWJ5FqO4wCgYIKoZIzj0EAwIw
LjEVMBMGA1UEAwwMVGVzdCBSb290IENBMRUwEwYDVQQKDAxCdWlsZGtpdFRlc3Qw
HhcNMjYwNTI2MTk1MDAxWhcNMzYwNTIzMTk1MDAxWjAuMRUwEwYDVQQDDAxUZXN0
IFJvb3QgQ0ExFTATBgNVBAoMDEJ1aWxka2l0VGVzdDBZMBMGByqGSM49AgEGCCqG
SM49AwEHA0IABLN838Q+a8yr/IPw5LT3a4LUfsx2rmW/PksHIUJiC/pEprIH628r
Y4lh3+SHq+KABITc5LKYPBlg2htGOb0iJNOjUzBRMB0GA1UdDgQWBBRnTPdOsn5+
AbbqOTILZr8lyxKJBzAfBgNVHSMEGDAWgBRnTPdOsn5+AbbqOTILZr8lyxKJBzAP
BgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIQDD5RZc2qSh/Dllk1xu
TJq9NboJfwxBHFKiUFygqp2SNwIgY2MZ56n75sRQC80jleGoLrvwTcmSTVPWko13
dmlN/S4=
-----END CERTIFICATE-----`;

export const TEST_LEAF_PEM = `-----BEGIN CERTIFICATE-----
MIIB8zCCAZigAwIBAgIUU6+e4oxE0Vd88Au8+OgrrUEAqhwwCgYIKoZIzj0EAwIw
LjEVMBMGA1UEAwwMVGVzdCBSb290IENBMRUwEwYDVQQKDAxCdWlsZGtpdFRlc3Qw
HhcNMjYwNTI2MTk1MDAxWhcNMjcwNTI2MTk1MDAxWjBPMRIwEAYDVQQDDAlUZXN0
IExlYWYxFTATBgNVBAoMDEJ1aWxka2l0VGVzdDEiMCAGA1UECwwZQXV0aGVudGlj
YXRvciBBdHRlc3RhdGlvbjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABFuHtbJs
WkV1bEOg45bD9HAunOO3pUJvTnD1kUYjuoK/GyS8IDmB+iksXVqmvaCAYZMp9WmV
PfSpGAPrSlW4o1ajczBxMAwGA1UdEwEB/wQCMAAwIQYLKwYBBAGC5RwBAQQEEgQQ
ABEiM0RVZneImaq7zN3u/zAdBgNVHQ4EFgQUJzwq24tMQEz11oPJte4SYRcd4Yow
HwYDVR0jBBgwFoAUZ0z3TrJ+fgG26jkyC2a/JcsSiQcwCgYIKoZIzj0EAwIDSQAw
RgIhAOm2U0Ts06FkQbQzF0KwKVazUEH33B4dym5n4ai0OhRrAiEA/xiptOuQuUng
nxa7pNymEocLb7WHF5oEIw9kuVDweoo=
-----END CERTIFICATE-----`;

export const UNRELATED_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIBgzCCASmgAwIBAgIUPAnPfnZbGLi1SFZ4gzWtDJZJlzwwCgYIKoZIzj0EAwIw
FzEVMBMGA1UEAwwMVW5yZWxhdGVkIENBMB4XDTI2MDUyNjE5NTAxN1oXDTM2MDUy
MzE5NTAxN1owFzEVMBMGA1UEAwwMVW5yZWxhdGVkIENBMFkwEwYHKoZIzj0CAQYI
KoZIzj0DAQcDQgAEt2liXQrwhAAMeObn5PjO1Grs8MwuJVgnMXlV/BucqWHGBeUL
DNL+9LeVc/AhrHZyZaarIYCDidKGXHvETzYzw6NTMFEwHQYDVR0OBBYEFGzG2Su2
eFFiR9LJ5x2+gN7h8+5TMB8GA1UdIwQYMBaAFGzG2Su2eFFiR9LJ5x2+gN7h8+5T
MA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDSAAwRQIhAJJRLFLCni232rdy
duVcYlhWbXZjrTJv9Lgc7U48qEneAiBF9X3jTnQYbhwkWHlysU+4J1vPYIODxAUM
Pzr8zaYbsw==
-----END CERTIFICATE-----`;

/** The OID of the custom (FIDO AAGUID) extension embedded in `TEST_LEAF_PEM`. */
export const TEST_LEAF_AAGUID_EXT_OID = '1.3.6.1.4.1.45724.1.1.4';

/** The 16-byte AAGUID wrapped (as an OCTET STRING) inside that extension. */
export const TEST_LEAF_AAGUID_HEX = '00112233445566778899aabbccddeeff';

/** A `now` far past every fixture's `validTo`, for testing the expiry path. */
export const FAR_FUTURE = new Date('2099-01-01T00:00:00Z');
