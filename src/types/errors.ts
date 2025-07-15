/**
 * Base WebAuthn error class
 */
export class WebAuthnError extends Error {
  constructor(
    message: string,
    public readonly code: string,
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
  constructor(message: string, code: string = 'REGISTRATION_ERROR') {
    super(message, code, 400);
    this.name = 'RegistrationError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends WebAuthnError {
  constructor(message: string, code: string = 'AUTHENTICATION_ERROR') {
    super(message, code, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Verification error
 */
export class VerificationError extends WebAuthnError {
  constructor(message: string, code: string = 'VERIFICATION_ERROR') {
    super(message, code, 400);
    this.name = 'VerificationError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends WebAuthnError {
  constructor(message: string, code: string = 'CONFIGURATION_ERROR') {
    super(message, code, 500);
    this.name = 'ConfigurationError';
  }
}

/**
 * Storage error
 */
export class StorageError extends WebAuthnError {
  constructor(message: string, code: string = 'STORAGE_ERROR') {
    super(message, code, 500);
    this.name = 'StorageError';
  }
}

/**
 * Session error
 */
export class SessionError extends WebAuthnError {
  constructor(message: string, code: string = 'SESSION_ERROR') {
    super(message, code, 401);
    this.name = 'SessionError';
  }
}
