import {
  SessionData,
  InternalConfig,
  SessionError,
  StorageAdapter,
  Base64URLString,
} from '@/types';
import { createSessionToken, parseSessionToken, generateSessionId } from './token';

/**
 * Session manager for handling WebAuthn sessions
 */
export class SessionManager {
  constructor(
    private readonly config: InternalConfig,
    private readonly storage?: StorageAdapter,
  ) {}

  /**
   * Create a new session
   */
  async createSession(
    userId: string | number,
    credentialId: Base64URLString,
    userVerified: boolean,
    additionalData?: Record<string, unknown>,
  ): Promise<string> {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + this.config.sessionDuration);

    const sessionData: SessionData = {
      userId,
      credentialId,
      expiresAt,
      userVerified,
      ...additionalData,
    };

    // Store in storage adapter if available
    if (this.storage) {
      await this.storage.sessions.create(sessionId, sessionData);
    }

    // Create encrypted token
    const token = createSessionToken(sessionId, sessionData, this.config.encryptionSecret);

    // Log if debug is enabled
    if (this.config.debug && this.config.logger) {
      this.config.logger('debug', 'Session created', {
        sessionId,
        userId,
        credentialId,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return token;
  }

  /**
   * Validate a session token
   */
  async validateSession(token: string): Promise<{
    valid: boolean;
    sessionData?: SessionData;
    sessionId?: string;
  }> {
    try {
      // Parse token
      const { sessionId, data } = parseSessionToken(token, this.config.encryptionSecret);

      // Check if expired
      if (new Date(data.expiresAt) < new Date()) {
        throw new SessionError('Session expired', 'SESSION_EXPIRED');
      }

      // If storage adapter is available, verify session exists
      if (this.storage) {
        const storedSession = await this.storage.sessions.find(sessionId);
        if (!storedSession) {
          throw new SessionError('Session not found', 'SESSION_NOT_FOUND');
        }

        // Use stored session data
        return {
          valid: true,
          sessionData: storedSession,
          sessionId,
        };
      }

      return {
        valid: true,
        sessionData: data,
        sessionId,
      };
    } catch (error) {
      // Log if debug is enabled
      if (this.config.debug && this.config.logger) {
        this.config.logger('error', 'Session validation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      if (error instanceof SessionError) {
        throw error;
      }

      return {
        valid: false,
      };
    }
  }

  /**
   * Refresh a session
   */
  async refreshSession(token: string): Promise<string> {
    const { valid, sessionData, sessionId } = await this.validateSession(token);

    if (!valid || !sessionData || !sessionId) {
      throw new SessionError('Invalid session', 'INVALID_SESSION');
    }

    // Create new session with extended expiration
    const newExpiresAt = new Date(Date.now() + this.config.sessionDuration);
    const newSessionData: SessionData = {
      ...sessionData,
      expiresAt: newExpiresAt,
    };

    // Update in storage if available
    if (this.storage) {
      await this.storage.sessions.update(sessionId, { expiresAt: newExpiresAt });
    }

    // Create new token
    const newToken = createSessionToken(sessionId, newSessionData, this.config.encryptionSecret);

    // Log if debug is enabled
    if (this.config.debug && this.config.logger) {
      this.config.logger('debug', 'Session refreshed', {
        sessionId,
        newExpiresAt: newExpiresAt.toISOString(),
      });
    }

    return newToken;
  }

  /**
   * Revoke a session
   */
  async revokeSession(token: string): Promise<void> {
    try {
      const { sessionId } = parseSessionToken(token, this.config.encryptionSecret);

      if (this.storage) {
        await this.storage.sessions.delete(sessionId);
      }

      // Log if debug is enabled
      if (this.config.debug && this.config.logger) {
        this.config.logger('debug', 'Session revoked', { sessionId });
      }
    } catch (error) {
      // Ignore errors when revoking
      if (this.config.debug && this.config.logger) {
        this.config.logger('warn', 'Failed to revoke session', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeUserSessions(userId: string | number): Promise<void> {
    if (!this.storage) {
      throw new SessionError(
        'Storage adapter required for user session revocation',
        'STORAGE_REQUIRED',
      );
    }

    await this.storage.sessions.deleteByUserId(userId);

    // Log if debug is enabled
    if (this.config.debug && this.config.logger) {
      this.config.logger('debug', 'All user sessions revoked', { userId });
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    if (!this.storage) {
      return;
    }

    await this.storage.sessions.deleteExpired();

    // Log if debug is enabled
    if (this.config.debug && this.config.logger) {
      this.config.logger('debug', 'Expired sessions cleaned up');
    }
  }
}
