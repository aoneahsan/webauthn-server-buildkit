import {
  StorageAdapter,
  UserModel,
  WebAuthnCredential,
  ChallengeData,
  SessionData,
  Base64URLString,
} from '@/types';

/**
 * In-memory storage adapter for development and testing
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private usersMap = new Map<string | number, UserModel>();
  private usersByUsername = new Map<string, UserModel>();
  private credentialsMap = new Map<Base64URLString, WebAuthnCredential>();
  private credentialsByUserId = new Map<string | number, Set<Base64URLString>>();
  private credentialsByWebAuthnUserId = new Map<Base64URLString, Set<Base64URLString>>();
  private challengesMap = new Map<string, ChallengeData>();
  private sessionsMap = new Map<string, SessionData>();
  private sessionsByUserId = new Map<string | number, Set<string>>();
  private nextUserId = 1;

  users = {
    findById: (id: string | number): Promise<UserModel | null> => {
      return Promise.resolve(this.usersMap.get(id) || null);
    },

    findByUsername: (username: string): Promise<UserModel | null> => {
      return Promise.resolve(this.usersByUsername.get(username) || null);
    },

    create: (user: Omit<UserModel, 'id'>): Promise<UserModel> => {
      // Check if username already exists
      if (this.usersByUsername.has(user.username)) {
        return Promise.reject(new Error('Username already exists'));
      }
      const newUser: UserModel = {
        ...user,
        id: this.nextUserId++,
      };
      this.usersMap.set(newUser.id, newUser);
      this.usersByUsername.set(newUser.username, newUser);
      return Promise.resolve(newUser);
    },

    update: (id: string | number, updates: Partial<UserModel>): Promise<UserModel | null> => {
      const user = this.usersMap.get(id);
      if (!user) {
        return Promise.resolve(null);
      }

      // Update username index if changed
      if (updates.username && updates.username !== user.username) {
        this.usersByUsername.delete(user.username);
        this.usersByUsername.set(updates.username, user);
      }

      Object.assign(user, updates);
      return Promise.resolve(user);
    },

    delete: (id: string | number): Promise<boolean> => {
      const user = this.usersMap.get(id);
      if (user) {
        this.usersByUsername.delete(user.username);
        this.usersMap.delete(id);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },
  };

  credentials = {
    findById: (id: Base64URLString): Promise<WebAuthnCredential | null> => {
      return Promise.resolve(this.credentialsMap.get(id) || null);
    },

    findByUserId: (userId: string | number): Promise<WebAuthnCredential[]> => {
      const credentialIds = this.credentialsByUserId.get(userId) || new Set();
      const credentials: WebAuthnCredential[] = [];
      for (const id of credentialIds) {
        const credential = this.credentialsMap.get(id);
        if (credential) {
          credentials.push(credential);
        }
      }
      return Promise.resolve(credentials);
    },

    findByWebAuthnUserId: (webAuthnUserId: Base64URLString): Promise<WebAuthnCredential[]> => {
      const credentialIds = this.credentialsByWebAuthnUserId.get(webAuthnUserId) || new Set();
      const credentials: WebAuthnCredential[] = [];
      for (const id of credentialIds) {
        const credential = this.credentialsMap.get(id);
        if (credential) {
          credentials.push(credential);
        }
      }
      return Promise.resolve(credentials);
    },

    create: (credential: Omit<WebAuthnCredential, 'createdAt'>): Promise<WebAuthnCredential> => {
      const newCredential: WebAuthnCredential = {
        ...credential,
        createdAt: new Date(),
      };

      this.credentialsMap.set(newCredential.id, newCredential);

      // Update user index
      if (!this.credentialsByUserId.has(newCredential.userId)) {
        this.credentialsByUserId.set(newCredential.userId, new Set());
      }
      this.credentialsByUserId.get(newCredential.userId)!.add(newCredential.id);

      // Update WebAuthn user ID index
      if (!this.credentialsByWebAuthnUserId.has(newCredential.webAuthnUserID)) {
        this.credentialsByWebAuthnUserId.set(newCredential.webAuthnUserID, new Set());
      }
      this.credentialsByWebAuthnUserId.get(newCredential.webAuthnUserID)!.add(newCredential.id);

      return Promise.resolve(newCredential);
    },

    updateCounter: (id: Base64URLString, counter: number): Promise<boolean> => {
      const credential = this.credentialsMap.get(id);
      if (credential) {
        credential.counter = counter;
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    updateLastUsed: (id: Base64URLString): Promise<boolean> => {
      const credential = this.credentialsMap.get(id);
      if (credential) {
        credential.lastUsedAt = new Date();
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    delete: (id: Base64URLString): Promise<boolean> => {
      const credential = this.credentialsMap.get(id);
      if (credential) {
        // Remove from indexes
        const userCredentials = this.credentialsByUserId.get(credential.userId);
        if (userCredentials) {
          userCredentials.delete(id);
        }

        const webAuthnUserCredentials = this.credentialsByWebAuthnUserId.get(
          credential.webAuthnUserID,
        );
        if (webAuthnUserCredentials) {
          webAuthnUserCredentials.delete(id);
        }

        this.credentialsMap.delete(id);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    deleteByUserId: async (userId: string | number): Promise<boolean> => {
      const credentialIds = this.credentialsByUserId.get(userId) || new Set();
      if (credentialIds.size === 0) {
        return false;
      }
      for (const id of credentialIds) {
        await this.credentials.delete(id);
      }
      this.credentialsByUserId.delete(userId);
      return true;
    },
  };

  challenges = {
    create: (challenge: ChallengeData): Promise<boolean> => {
      this.challengesMap.set(challenge.challenge, challenge);
      return Promise.resolve(true);
    },

    find: (challenge: string): Promise<ChallengeData | null> => {
      const data = this.challengesMap.get(challenge);
      if (data) {
        const expiresAt =
          typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
        if (expiresAt > new Date()) {
          return Promise.resolve(data);
        }
      }
      return Promise.resolve(null);
    },

    delete: (challenge: string): Promise<boolean> => {
      const existed = this.challengesMap.has(challenge);
      this.challengesMap.delete(challenge);
      return Promise.resolve(existed);
    },

    deleteExpired: (): Promise<boolean> => {
      const now = new Date();
      let deletedAny = false;
      for (const [challenge, data] of this.challengesMap.entries()) {
        const expiresAt =
          typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
        if (expiresAt <= now) {
          this.challengesMap.delete(challenge);
          deletedAny = true;
        }
      }
      return Promise.resolve(deletedAny);
    },
  };

  sessions = {
    create: (sessionId: string, data: SessionData): Promise<boolean> => {
      this.sessionsMap.set(sessionId, data);

      // Update user index
      if (!this.sessionsByUserId.has(data.userId)) {
        this.sessionsByUserId.set(data.userId, new Set());
      }
      this.sessionsByUserId.get(data.userId)!.add(sessionId);
      return Promise.resolve(true);
    },

    find: (sessionId: string): Promise<SessionData | null> => {
      const data = this.sessionsMap.get(sessionId);
      if (data) {
        const expiresAt =
          typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
        if (expiresAt > new Date()) {
          return Promise.resolve(data);
        }
      }
      return Promise.resolve(null);
    },

    update: (sessionId: string, updates: Partial<SessionData>): Promise<boolean> => {
      const session = this.sessionsMap.get(sessionId);
      if (session) {
        Object.assign(session, updates);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    delete: (sessionId: string): Promise<boolean> => {
      const session = this.sessionsMap.get(sessionId);
      if (session) {
        // Remove from user index
        const userSessions = this.sessionsByUserId.get(session.userId);
        if (userSessions) {
          userSessions.delete(sessionId);
        }
        this.sessionsMap.delete(sessionId);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    deleteExpired: async (): Promise<boolean> => {
      const now = new Date();
      let deletedAny = false;
      for (const [sessionId, data] of this.sessionsMap.entries()) {
        const expiresAt =
          typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
        if (expiresAt <= now) {
          await this.sessions.delete(sessionId);
          deletedAny = true;
        }
      }
      return deletedAny;
    },

    deleteByUserId: (userId: string | number): Promise<boolean> => {
      const sessionIds = this.sessionsByUserId.get(userId) || new Set();
      if (sessionIds.size === 0) {
        return Promise.resolve(false);
      }
      for (const sessionId of sessionIds) {
        this.sessionsMap.delete(sessionId);
      }
      this.sessionsByUserId.delete(userId);
      return Promise.resolve(true);
    },
  };
}
