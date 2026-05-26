/**
 * Stable, machine-readable error codes thrown across the package. Use these to
 * branch on failures without matching on (human-readable) error messages.
 *
 * The {@link WebAuthnError.code} field is typed as an *open* union
 * (`WebAuthnErrorCode | (string & {})`), so this list documents the known codes
 * while still allowing future/custom codes to compile.
 */
export type WebAuthnErrorCode =
  // Challenge lifecycle
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_OPERATION_MISMATCH'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_MISMATCH'
  // Algorithm / COSE key
  | 'ALGORITHM_MISMATCH'
  | 'UNSUPPORTED_CREDENTIAL_ALGORITHM'
  | 'UNSUPPORTED_ALGORITHM'
  | 'UNSUPPORTED_OKP_ALGORITHM'
  | 'UNSUPPORTED_CURVE'
  | 'UNSUPPORTED_KEY_TYPE'
  | 'COSE_ALG_MISMATCH'
  | 'COSE_EC2_INVALID'
  | 'COSE_RSA_INVALID'
  | 'COSE_OKP_INVALID'
  | 'COSE_DECODE_ERROR'
  | 'COSE_INVALID_FORMAT'
  | 'COSE_MISSING_KTY'
  | 'COSE_UNSUPPORTED_KEY_TYPE'
  | 'COSE_UNKNOWN_ALGORITHM'
  // CBOR
  | 'CBOR_DECODE_ERROR'
  | 'CBOR_DECODE_FIRST_ERROR'
  | 'CBOR_ENCODE_ERROR'
  // Client data / origin / ceremony
  | 'INVALID_CLIENT_DATA_TYPE'
  | 'ORIGIN_MISMATCH'
  | 'RPID_MISMATCH'
  | 'CROSS_ORIGIN_NOT_ALLOWED'
  // Authenticator data
  | 'AUTHENTICATOR_DATA_TOO_SHORT'
  | 'AUTHENTICATOR_DATA_TRAILING_BYTES'
  | 'AUTHENTICATOR_DATA_INVALID_CREDENTIAL_ID'
  | 'AUTHENTICATOR_DATA_INVALID_CREDENTIAL_DATA'
  | 'USER_PRESENCE_REQUIRED'
  | 'USER_VERIFICATION_REQUIRED'
  | 'MISSING_CREDENTIAL_DATA'
  // Registration
  | 'REGISTRATION_ERROR'
  | 'REGISTRATION_VERIFICATION_FAILED'
  | 'CREDENTIAL_ALREADY_REGISTERED'
  | 'ATTESTATION_PARSE_ERROR'
  | 'ATTESTATION_SIGNATURE_INVALID'
  // Mobile attestation (opt-in JSON path)
  | 'INVALID_MOBILE_ATTESTATION'
  | 'INVALID_PLACEHOLDER_ATTESTATION'
  | 'MOBILE_CREDENTIAL_INVALID_ATTESTATION'
  | 'MOBILE_ATTESTATION_MISSING_CREDENTIAL_ID'
  | 'MOBILE_ATTESTATION_INVALID_PUBLIC_KEY'
  | 'MOBILE_ATTESTATION_INVALID_PUBLIC_KEY_FORMAT'
  // Authentication
  | 'AUTHENTICATION_ERROR'
  | 'AUTHENTICATION_VERIFICATION_FAILED'
  | 'CREDENTIAL_ID_MISMATCH'
  | 'USER_HANDLE_MISMATCH'
  | 'COUNTER_ERROR'
  | 'SIGNATURE_VERIFICATION_FAILED'
  // Verification (generic)
  | 'VERIFICATION_ERROR'
  // Configuration / storage
  | 'CONFIGURATION_ERROR'
  | 'STORAGE_ERROR'
  | 'STORAGE_REQUIRED'
  // Session
  | 'SESSION_ERROR'
  | 'SESSION_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_SESSION'
  | 'INVALID_TOKEN'
  | 'TOKEN_CREATION_FAILED';

/**
 * Base WebAuthn error class.
 *
 * @property code - A stable, machine-readable {@link WebAuthnErrorCode}. Typed
 *   as an open union so custom/future codes still compile.
 * @property statusCode - A suggested HTTP status for the failure:
 *   `400` (Bad Request) for malformed/invalid input and most verification
 *   failures, `401` (Unauthorized) for authentication/session failures, and
 *   `500` (Internal Server Error) for configuration/storage problems.
 */
export class WebAuthnError extends Error {
  constructor(
    message: string,
    public readonly code: WebAuthnErrorCode | (string & {}),
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'WebAuthnError';
  }
}

/**
 * Registration error
 */
export class RegistrationError extends WebAuthnError {
  constructor(message: string, code: WebAuthnErrorCode | (string & {}) = 'REGISTRATION_ERROR') {
    super(message, code, 400);
    this.name = 'RegistrationError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends WebAuthnError {
  constructor(message: string, code: WebAuthnErrorCode | (string & {}) = 'AUTHENTICATION_ERROR') {
    super(message, code, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Verification error
 */
export class VerificationError extends WebAuthnError {
  constructor(message: string, code: WebAuthnErrorCode | (string & {}) = 'VERIFICATION_ERROR') {
    super(message, code, 400);
    this.name = 'VerificationError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends WebAuthnError {
  constructor(message: string, code: WebAuthnErrorCode | (string & {}) = 'CONFIGURATION_ERROR') {
    super(message, code, 500);
    this.name = 'ConfigurationError';
  }
}

/**
 * Storage error
 */
export class StorageError extends WebAuthnError {
  constructor(message: string, code: WebAuthnErrorCode | (string & {}) = 'STORAGE_ERROR') {
    super(message, code, 500);
    this.name = 'StorageError';
  }
}

/**
 * Session error
 */
export class SessionError extends WebAuthnError {
  constructor(message: string, code: WebAuthnErrorCode | (string & {}) = 'SESSION_ERROR') {
    super(message, code, 401);
    this.name = 'SessionError';
  }
}
