import {
  RegistrationCredentialJSON,
  VerifiedRegistrationInfo,
  VerificationError,
  AuthenticatorTransportFuture,
} from '@/types';

/**
 * Mobile attestation structure
 * This is a JSON-based attestation format used by mobile native authenticators
 */
export interface MobileAttestationData {
  publicKey: string; // Base64-encoded public key
  credentialId: string;
  deviceType?: 'singleDevice' | 'multiDevice';
  userVerified?: boolean;
  platform?: 'ios' | 'android';
  attestationType?: string;
}

/**
 * Result of mobile attestation detection
 */
export interface MobileAttestationDetectionResult {
  isMobileAttestation: boolean;
  data?: MobileAttestationData;
  reason?: string;
}

/**
 * Detect if the attestation is from a mobile device using JSON format
 * instead of standard CBOR WebAuthn attestation
 */
export function detectMobileAttestation(
  response: RegistrationCredentialJSON,
): MobileAttestationDetectionResult {
  const attestationObject = response.response.attestationObject;

  // Check for known fake/placeholder attestation values
  const fakePlaceholders = [
    'mobile_attestation',
    'bW9iaWxlX2F0dGVzdGF0aW9u', // btoa('mobile_attestation')
    'YW5kcm9pZF9hdHRlc3RhdGlvbg==', // btoa('android_attestation')
    'aW9zX2F0dGVzdGF0aW9u', // btoa('ios_attestation')
  ];

  if (fakePlaceholders.includes(attestationObject)) {
    return {
      isMobileAttestation: false,
      reason: 'INVALID_PLACEHOLDER_ATTESTATION',
    };
  }

  // Check if credential ID suggests mobile origin
  const isMobileCredentialId = response.id?.startsWith('mobile_');

  // Try to detect JSON-based attestation
  try {
    // First, try to decode as base64
    let decoded: string;
    try {
      decoded = Buffer.from(attestationObject, 'base64').toString('utf-8');
    } catch {
      // Not valid base64, might be raw string or CBOR
      decoded = attestationObject;
    }

    // Check if it's JSON
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      const parsed = JSON.parse(decoded) as MobileAttestationData;

      // Validate required fields for mobile attestation
      if (parsed.publicKey && parsed.credentialId) {
        return {
          isMobileAttestation: true,
          data: parsed,
        };
      }
    }
  } catch {
    // Not JSON, continue with other checks
  }

  // If credential ID is mobile-prefixed but attestation is not valid JSON,
  // this is an invalid mobile registration attempt
  if (isMobileCredentialId) {
    return {
      isMobileAttestation: false,
      reason: 'MOBILE_CREDENTIAL_INVALID_ATTESTATION',
    };
  }

  // Standard WebAuthn attestation (CBOR)
  return {
    isMobileAttestation: false,
  };
}

/**
 * Validate mobile attestation data
 * Returns verified registration info if valid, throws otherwise
 */
export function validateMobileAttestation(
  _response: RegistrationCredentialJSON,
  data: MobileAttestationData,
  expectedOrigin: string | string[],
): VerifiedRegistrationInfo {
  // Validate public key format
  if (!data.publicKey || typeof data.publicKey !== 'string') {
    throw new VerificationError(
      'Mobile attestation missing valid public key',
      'MOBILE_ATTESTATION_INVALID_PUBLIC_KEY',
    );
  }

  // Decode and validate public key
  let publicKeyBytes: Uint8Array;
  try {
    const buffer = Buffer.from(data.publicKey, 'base64');
    publicKeyBytes = new Uint8Array(buffer);

    // Public key should be at least 32 bytes (EC256 public key minimum)
    if (publicKeyBytes.length < 32) {
      throw new Error('Public key too short');
    }
  } catch (error) {
    throw new VerificationError(
      'Mobile attestation public key is not valid base64 or is too short',
      'MOBILE_ATTESTATION_INVALID_PUBLIC_KEY_FORMAT',
    );
  }

  // Validate credential ID
  if (!data.credentialId || typeof data.credentialId !== 'string') {
    throw new VerificationError(
      'Mobile attestation missing credential ID',
      'MOBILE_ATTESTATION_MISSING_CREDENTIAL_ID',
    );
  }

  // Determine origin
  const origins = Array.isArray(expectedOrigin) ? expectedOrigin : [expectedOrigin];
  const origin: string = data.platform === 'ios' ? 'ios-app' : data.platform === 'android' ? 'android-app' : (origins[0] || 'unknown');

  const registrationInfo: VerifiedRegistrationInfo = {
    credential: {
      id: data.credentialId,
      publicKey: publicKeyBytes,
      counter: 0,
      transports: ['internal'] as AuthenticatorTransportFuture[],
    },
    credentialDeviceType: data.deviceType || 'singleDevice',
    credentialBackedUp: false,
    origin,
    userVerified: data.userVerified ?? true,
  };

  return registrationInfo;
}

/**
 * Check if an error is related to CBOR/COSE parsing
 * Used to detect when standard WebAuthn verification fails due to mobile attestation
 */
export function isCborParsingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  return (
    errorMessage.includes('cbor') ||
    errorMessage.includes('cose') ||
    errorMessage.includes('failed to decode') ||
    errorMessage.includes('invalid format')
  );
}
