import type { ChallengeData, SessionData, UserModel, WebAuthnCredential } from './models';
import type { Base64URLString } from './base';

/**
 * Storage adapter interface for persisting WebAuthn data
 */
export interface StorageAdapter {
  /**
   * User operations
   */
  users: {
    findById(id: string | number): Promise<UserModel | null>;
    findByUsername(username: string): Promise<UserModel | null>;
    create(user: Omit<UserModel, 'id'>): Promise<UserModel>;
    update(id: string | number, updates: Partial<UserModel>): Promise<void>;
    delete(id: string | number): Promise<void>;
  };

  /**
   * Credential operations
   */
  credentials: {
    findById(id: Base64URLString): Promise<WebAuthnCredential | null>;
    findByUserId(userId: string | number): Promise<WebAuthnCredential[]>;
    findByWebAuthnUserId(webAuthnUserId: Base64URLString): Promise<WebAuthnCredential[]>;
    create(credential: Omit<WebAuthnCredential, 'createdAt'>): Promise<WebAuthnCredential>;
    updateCounter(id: Base64URLString, counter: number): Promise<void>;
    updateLastUsed(id: Base64URLString): Promise<void>;
    delete(id: Base64URLString): Promise<void>;
    deleteByUserId(userId: string | number): Promise<void>;
  };

  /**
   * Challenge operations
   */
  challenges: {
    create(challenge: ChallengeData): Promise<void>;
    find(challenge: string): Promise<ChallengeData | null>;
    delete(challenge: string): Promise<void>;
    deleteExpired(): Promise<void>;
  };

  /**
   * Session operations
   */
  sessions: {
    create(sessionId: string, data: SessionData): Promise<void>;
    find(sessionId: string): Promise<SessionData | null>;
    update(sessionId: string, data: Partial<SessionData>): Promise<void>;
    delete(sessionId: string): Promise<void>;
    deleteExpired(): Promise<void>;
    deleteByUserId(userId: string | number): Promise<void>;
  };
}
