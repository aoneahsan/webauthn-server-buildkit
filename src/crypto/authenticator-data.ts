import { AuthenticatorDataFlags, ParsedAuthenticatorData, VerificationError } from '@/types';
import { bufferToNumber } from '@/utils/buffer';

/**
 * Parse authenticator data according to WebAuthn spec
 * https://w3c.github.io/webauthn/#authenticator-data
 */
export function parseAuthenticatorData(authData: Uint8Array): ParsedAuthenticatorData {
  if (authData.length < 37) {
    throw new VerificationError('Authenticator data too short', 'AUTHENTICATOR_DATA_TOO_SHORT');
  }

  let offset = 0;

  // RP ID hash (32 bytes)
  const rpIdHash = authData.slice(offset, offset + 32);
  offset += 32;

  // Flags (1 byte)
  const flagsByte = authData[offset]!;
  offset += 1;

  const flags: AuthenticatorDataFlags = {
    userPresent: (flagsByte & 0x01) !== 0,
    userVerified: (flagsByte & 0x04) !== 0,
    backupEligibility: (flagsByte & 0x08) !== 0,
    backupState: (flagsByte & 0x10) !== 0,
    attestedCredentialData: (flagsByte & 0x40) !== 0,
    extensionData: (flagsByte & 0x80) !== 0,
  };

  // Counter (4 bytes)
  const counter = bufferToNumber(authData.slice(offset, offset + 4));
  offset += 4;

  const parsed: ParsedAuthenticatorData = {
    rpIdHash,
    flags,
    counter,
  };

  // Parse attested credential data if present
  if (flags.attestedCredentialData) {
    if (authData.length < offset + 16 + 2) {
      throw new VerificationError(
        'Authenticator data with attested credential data too short',
        'AUTHENTICATOR_DATA_INVALID_CREDENTIAL_DATA',
      );
    }

    // AAGUID (16 bytes)
    parsed.aaguid = authData.slice(offset, offset + 16);
    offset += 16;

    // Credential ID length (2 bytes)
    const credentialIdLength = bufferToNumber(authData.slice(offset, offset + 2));
    offset += 2;

    if (authData.length < offset + credentialIdLength) {
      throw new VerificationError(
        'Authenticator data credential ID length exceeds data length',
        'AUTHENTICATOR_DATA_INVALID_CREDENTIAL_ID',
      );
    }

    // Credential ID
    parsed.credentialId = authData.slice(offset, offset + credentialIdLength);
    offset += credentialIdLength;

    // Credential public key (CBOR encoded)
    // We don't know the exact length, so we take the remaining bytes
    // minus any extension data
    if (flags.extensionData) {
      // If extensions are present, we need to parse CBOR to find the boundary
      // For now, we'll assume no extensions and take all remaining data
      parsed.credentialPublicKey = authData.slice(offset);
    } else {
      parsed.credentialPublicKey = authData.slice(offset);
    }
  }

  // Parse extension data if present
  if (flags.extensionData && !flags.attestedCredentialData) {
    parsed.extensionsData = authData.slice(offset);
  }

  return parsed;
}

/**
 * Validate authenticator data flags
 */
export function validateAuthenticatorDataFlags(
  flags: AuthenticatorDataFlags,
  requireUserVerification: boolean,
  requireUserPresence: boolean = true,
): void {
  if (requireUserPresence && !flags.userPresent) {
    throw new VerificationError('User presence flag not set', 'USER_PRESENCE_REQUIRED');
  }

  if (requireUserVerification && !flags.userVerified) {
    throw new VerificationError('User verification flag not set', 'USER_VERIFICATION_REQUIRED');
  }
}
