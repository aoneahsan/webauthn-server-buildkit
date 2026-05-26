import {
  WebAuthnServerConfig,
  InternalConfig,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationCredentialJSON,
  AuthenticationCredentialJSON,
  VerifiedRegistrationInfo,
  VerifiedAuthenticationInfo,
  UserModel,
  WebAuthnCredential,
  ChallengeData,
  COSEAlgorithmIdentifier,
  ConfigurationError,
  VerificationError,
  Base64URLString,
  SessionData,
  StorageAdapter,
} from '@/types';
import {
  generateRegistrationOptions,
  GenerateRegistrationOptionsParams,
  verifyRegistrationResponse,
  VerifyRegistrationResponseParams,
} from '@/registration';
import {
  generateAuthenticationOptions,
  GenerateAuthenticationOptionsParams,
  verifyAuthenticationResponse,
  VerifyAuthenticationResponseParams,
} from '@/authentication';
import { SessionManager } from '@/session';

/**
 * Main WebAuthn server class
 */
export class WebAuthnServer {
  private readonly config: InternalConfig;
  private readonly sessionManager: SessionManager;

  constructor(config: WebAuthnServerConfig) {
    // Validate config
    this.validateConfig(config);

    // Build internal config with defaults
    this.config = this.buildInternalConfig(config);

    // Initialize session manager
    this.sessionManager = new SessionManager(this.config, config.storageAdapter);

    // Log initialization if debug is enabled
    if (this.config.debug && this.config.logger) {
      this.config.logger('info', 'WebAuthn server initialized', {
        rpName: this.config.rpName,
        rpID: this.config.rpID,
        origin: this.config.origin,
      });
    }
  }

  /**
   * Generate registration options
   * @param user - User information
   * @param params - Optional parameters to customize registration
   * @returns Registration options and challenge
   * @see https://www.w3.org/TR/webauthn-3/#sctn-createCredential
   */
  async createRegistrationOptions(
    user: UserModel,
    params?: Partial<Omit<GenerateRegistrationOptionsParams, 'user'>>,
  ): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challenge: string;
    /** The generated WebAuthn user handle (`options.user.id`). Persist this as `WebAuthnCredential.webAuthnUserID` to support usernameless (discoverable-credential) login. */
    webAuthnUserId: string;
  }> {
    const fullParams: GenerateRegistrationOptionsParams = {
      user,
      excludeCredentials: params?.excludeCredentials,
      authenticatorSelection: params?.authenticatorSelection ?? this.config.authenticatorSelection,
      preferredAuthenticatorType:
        params?.preferredAuthenticatorType ?? this.config.preferredAuthenticatorType,
      extensions: params?.extensions,
      timeout: params?.timeout,
      attestation: params?.attestation,
      rpIcon: params?.rpIcon,
    };

    const options = generateRegistrationOptions(this.config, fullParams);

    // Store challenge if storage is available
    if (this.config.storageAdapter) {
      const challengeData: ChallengeData = {
        challenge: options.challenge,
        userId: user.id,
        operation: 'registration',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (this.config.timeout || 60000)),
      };
      await this.config.storageAdapter.challenges.create(challengeData);
    }

    return {
      options,
      challenge: options.challenge,
      webAuthnUserId: options.user.id,
    };
  }

  /**
   * Verify registration response
   */
  async verifyRegistration(
    response: RegistrationCredentialJSON,
    expectedChallenge: string,
    expectedOrigin?: string | string[],
  ): Promise<{
    verified: boolean;
    registrationInfo?: VerifiedRegistrationInfo;
  }> {
    // Enforce a one-time, unexpired, registration-scoped challenge from storage
    // (secure-by-default; disable with `enforceChallengeStore: false`).
    await this.consumeChallengeFromStore(expectedChallenge, 'registration');

    const params: VerifyRegistrationResponseParams = {
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigin || this.config.origin,
      expectedRPID: this.config.rpID,
      requireUserVerification: this.config.userVerification === 'required',
    };

    try {
      return verifyRegistrationResponse(this.config, params);
    } finally {
      // Consume the challenge once, regardless of the verification outcome, so
      // it can never be replayed.
      if (this.config.storageAdapter) {
        await this.config.storageAdapter.challenges.delete(expectedChallenge).catch(() => false);
      }
    }
  }

  /**
   * Generate authentication options
   * @param params - Optional parameters to customize authentication
   * @returns Authentication options and challenge
   * @see https://www.w3.org/TR/webauthn-3/#sctn-getAssertion
   */
  async createAuthenticationOptions(params?: GenerateAuthenticationOptionsParams): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challenge: string;
  }> {
    const fullParams: GenerateAuthenticationOptionsParams = {
      allowCredentials: params?.allowCredentials,
      userVerification: params?.userVerification ?? this.config.userVerification,
      rpId: params?.rpId ?? this.config.rpID,
      extensions: params?.extensions,
      timeout: params?.timeout,
    };

    const options = generateAuthenticationOptions(this.config, fullParams);

    // Store challenge if storage is available
    if (this.config.storageAdapter) {
      const challengeData: ChallengeData = {
        challenge: options.challenge,
        operation: 'authentication',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (this.config.timeout || 60000)),
      };
      await this.config.storageAdapter.challenges.create(challengeData);
    }

    return {
      options,
      challenge: options.challenge,
    };
  }

  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    response: AuthenticationCredentialJSON,
    expectedChallenge: string,
    credential: WebAuthnCredential,
    expectedOrigin?: string | string[],
  ): Promise<{
    verified: boolean;
    authenticationInfo?: VerifiedAuthenticationInfo;
  }> {
    // Enforce a one-time, unexpired, authentication-scoped challenge from
    // storage (secure-by-default; disable with `enforceChallengeStore: false`).
    await this.consumeChallengeFromStore(expectedChallenge, 'authentication');

    const params: VerifyAuthenticationResponseParams = {
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigin || this.config.origin,
      expectedRPID: this.config.rpID,
      credential,
      requireUserVerification: this.config.userVerification === 'required',
    };

    let result: { verified: boolean; authenticationInfo?: VerifiedAuthenticationInfo };
    try {
      result = verifyAuthenticationResponse(this.config, params);
    } finally {
      // Consume the challenge once, regardless of the verification outcome.
      if (this.config.storageAdapter) {
        await this.config.storageAdapter.challenges.delete(expectedChallenge).catch(() => false);
      }
    }

    // Update counter and last used if verified and storage is available
    if (this.config.storageAdapter && result.verified && result.authenticationInfo) {
      await this.config.storageAdapter.credentials.updateCounter(
        credential.id,
        result.authenticationInfo.newCounter,
      );
      await this.config.storageAdapter.credentials.updateLastUsed(credential.id);
    }

    return result;
  }

  /**
   * When a storage adapter is configured and `enforceChallengeStore` is enabled
   * (the default), require the challenge to exist in storage, be unexpired, and
   * match the expected operation. Expired/mismatched challenges are deleted so
   * they cannot be retried. No-op when no storage adapter is configured or
   * enforcement is disabled.
   */
  private async consumeChallengeFromStore(
    expectedChallenge: string,
    operation: ChallengeData['operation'],
  ): Promise<void> {
    const storage = this.config.storageAdapter;
    if (!storage || !this.config.enforceChallengeStore) {
      return;
    }

    const stored = await storage.challenges.find(expectedChallenge);
    if (!stored) {
      throw new VerificationError('Challenge not found or already used', 'CHALLENGE_NOT_FOUND');
    }

    if (stored.operation !== operation) {
      await storage.challenges.delete(expectedChallenge).catch(() => false);
      throw new VerificationError(
        `Challenge was issued for "${stored.operation}", not "${operation}"`,
        'CHALLENGE_OPERATION_MISMATCH',
      );
    }

    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      await storage.challenges.delete(expectedChallenge).catch(() => false);
      throw new VerificationError('Challenge expired', 'CHALLENGE_EXPIRED');
    }
  }

  /**
   * Create a session after successful authentication
   */
  async createSession(
    userId: string | number,
    credentialId: Base64URLString,
    userVerified: boolean,
    additionalData?: Record<string, unknown>,
  ): Promise<string> {
    return this.sessionManager.createSession(userId, credentialId, userVerified, additionalData);
  }

  /**
   * Validate a session token
   */
  async validateSession(token: string): Promise<{
    valid: boolean;
    sessionData?: SessionData;
    sessionId?: string;
  }> {
    return this.sessionManager.validateSession(token);
  }

  /**
   * Refresh a session token
   */
  async refreshSession(token: string): Promise<string> {
    return this.sessionManager.refreshSession(token);
  }

  /**
   * Revoke a session
   */
  async revokeSession(token: string): Promise<void> {
    return this.sessionManager.revokeSession(token);
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeUserSessions(userId: string | number): Promise<void> {
    return this.sessionManager.revokeUserSessions(userId);
  }

  /**
   * Clean up expired data
   */
  async cleanup(): Promise<void> {
    if (this.config.storageAdapter) {
      await Promise.all([
        this.config.storageAdapter.challenges.deleteExpired(),
        this.sessionManager.cleanupExpiredSessions(),
      ]);
    }
  }

  /**
   * Get the storage adapter
   */
  getStorageAdapter(): StorageAdapter | undefined {
    return this.config.storageAdapter;
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: WebAuthnServerConfig): void {
    if (!config.rpName) {
      throw new ConfigurationError('rpName is required');
    }

    if (!config.rpID) {
      throw new ConfigurationError('rpID is required');
    }

    if (!config.origin) {
      throw new ConfigurationError('origin is required');
    }

    if (!config.encryptionSecret) {
      throw new ConfigurationError('encryptionSecret is required');
    }

    if (config.encryptionSecret.length < 32) {
      throw new ConfigurationError('encryptionSecret must be at least 32 characters');
    }

    if (config.challengeSize && (config.challengeSize < 16 || config.challengeSize > 64)) {
      throw new ConfigurationError('challengeSize must be between 16 and 64');
    }

    if (config.timeout && config.timeout < 10000) {
      throw new ConfigurationError('timeout must be at least 10000ms (10 seconds)');
    }
  }

  /**
   * Build internal config with defaults
   */
  private buildInternalConfig(config: WebAuthnServerConfig): InternalConfig {
    return {
      rpName: config.rpName,
      rpID: config.rpID,
      rpIcon: config.rpIcon,
      origin: config.origin,
      sessionDuration: config.sessionDuration || 24 * 60 * 60 * 1000, // 24 hours
      encryptionSecret: config.encryptionSecret,
      attestationType: config.attestationType || 'none',
      enableMobileAttestation: config.enableMobileAttestation ?? false,
      enforceChallengeStore: config.enforceChallengeStore ?? true,
      allowCrossOriginIframe: config.allowCrossOriginIframe ?? false,
      originVerifier: config.originVerifier,
      userVerification: config.userVerification || 'preferred',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: config.userVerification || 'preferred',
        ...config.authenticatorSelection,
      },
      supportedAlgorithms: config.supportedAlgorithms || [
        COSEAlgorithmIdentifier.ES256,
        COSEAlgorithmIdentifier.RS256,
      ],
      challengeSize: config.challengeSize || 32,
      timeout: config.timeout || 60000,
      debug: config.debug || false,
      storageAdapter: config.storageAdapter,
      preferredAuthenticatorType: config.preferredAuthenticatorType,
      logger: config.logger,
    };
  }
}
