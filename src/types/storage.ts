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
    update(id: string | number, updates: Partial<UserModel>): Promise<UserModel | null>;
    delete(id: string | number): Promise<boolean>;
  };

  /**
   * Credential operations
   */
  credentials: {
    findById(id: Base64URLString): Promise<WebAuthnCredential | null>;
    findByUserId(userId: string | number): Promise<WebAuthnCredential[]>;
    findByWebAuthnUserId(webAuthnUserId: Base64URLString): Promise<WebAuthnCredential[]>;
    create(credential: Omit<WebAuthnCredential, 'createdAt'>): Promise<WebAuthnCredential>;
    updateCounter(id: Base64URLString, counter: number): Promise<boolean>;
    updateLastUsed(id: Base64URLString): Promise<boolean>;
    delete(id: Base64URLString): Promise<boolean>;
    deleteByUserId(userId: string | number): Promise<boolean>;
  };

  /**
   * Challenge operations
   */
  challenges: {
    create(challenge: ChallengeData): Promise<boolean>;
    find(challenge: string): Promise<ChallengeData | null>;
    delete(challenge: string): Promise<boolean>;
    deleteExpired(): Promise<boolean>;
  };

  /**
   * Session operations
   */
  sessions: {
    create(sessionId: string, data: SessionData): Promise<boolean>;
    find(sessionId: string): Promise<SessionData | null>;
    update(sessionId: string, data: Partial<SessionData>): Promise<boolean>;
    delete(sessionId: string): Promise<boolean>;
    deleteExpired(): Promise<boolean>;
    deleteByUserId(userId: string | number): Promise<boolean>;
  };
}
