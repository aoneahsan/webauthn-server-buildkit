import { Pool, PoolClient } from 'pg';
import type {
  StorageAdapter,
  UserModel,
  WebAuthnCredential,
  ChallengeData,
  SessionData,
  Base64URLString,
} from 'webauthn-server-buildkit';

/**
 * PostgreSQL Storage Adapter for WebAuthn Server
 * 
 * This adapter provides production-ready PostgreSQL storage for WebAuthn data.
 * It includes connection pooling, error handling, and optimized queries.
 */
export class PostgreSQLStorageAdapter implements StorageAdapter {
  private pool: Pool;

  constructor(connectionConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number; // Maximum number of connections in pool
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }) {
    this.pool = new Pool({
      ...connectionConfig,
      max: connectionConfig.max || 20,
      idleTimeoutMillis: connectionConfig.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: connectionConfig.connectionTimeoutMillis || 2000,
    });
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webauthn_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Credentials table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webauthn_credentials (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER REFERENCES webauthn_users(id) ON DELETE CASCADE,
          webauthn_user_id VARCHAR(255) NOT NULL,
          public_key BYTEA NOT NULL,
          counter BIGINT NOT NULL DEFAULT 0,
          transports TEXT[],
          backup_eligible BOOLEAN NOT NULL DEFAULT false,
          backup_state BOOLEAN NOT NULL DEFAULT false,
          last_used TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Challenges table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webauthn_challenges (
          challenge VARCHAR(255) PRIMARY KEY,
          user_id INTEGER REFERENCES webauthn_users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webauthn_sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL,
          credential_id VARCHAR(255) NOT NULL,
          user_verified BOOLEAN NOT NULL,
          additional_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // Create indexes for performance
      await client.query('CREATE INDEX IF NOT EXISTS idx_webauthn_users_username ON webauthn_users(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_webauthn_user_id ON webauthn_credentials(webauthn_user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webauthn_sessions_expires_at ON webauthn_sessions(expires_at)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webauthn_sessions_user_id ON webauthn_sessions(user_id)');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  users = {
    async findById(id: string | number): Promise<UserModel | null> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_users WHERE id = $1',
          [id]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        return {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          email: row.email,
          createdAt: row.created_at.toISOString(),
          lastLoginAt: row.last_login_at?.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async findByUsername(username: string): Promise<UserModel | null> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_users WHERE username = $1',
          [username]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        return {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          email: row.email,
          createdAt: row.created_at.toISOString(),
          lastLoginAt: row.last_login_at?.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async create(user: Omit<UserModel, 'id'>): Promise<UserModel> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO webauthn_users (username, display_name, email, created_at, last_login_at) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING *`,
          [user.username, user.displayName, user.email, user.createdAt, user.lastLoginAt]
        );
        
        const row = result.rows[0];
        return {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          email: row.email,
          createdAt: row.created_at.toISOString(),
          lastLoginAt: row.last_login_at?.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async update(id: string | number, updates: Partial<UserModel>): Promise<UserModel | null> {
      const client = await this.pool.connect();
      try {
        const setParts: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (updates.username !== undefined) {
          setParts.push(`username = $${paramIndex++}`);
          values.push(updates.username);
        }
        if (updates.displayName !== undefined) {
          setParts.push(`display_name = $${paramIndex++}`);
          values.push(updates.displayName);
        }
        if (updates.email !== undefined) {
          setParts.push(`email = $${paramIndex++}`);
          values.push(updates.email);
        }
        if (updates.lastLoginAt !== undefined) {
          setParts.push(`last_login_at = $${paramIndex++}`);
          values.push(updates.lastLoginAt);
        }

        if (setParts.length === 0) {
          return this.users.findById(id);
        }

        setParts.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await client.query(
          `UPDATE webauthn_users SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        return {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          email: row.email,
          createdAt: row.created_at.toISOString(),
          lastLoginAt: row.last_login_at?.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async delete(id: string | number): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM webauthn_users WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },
  };

  credentials = {
    async findById(id: Base64URLString): Promise<WebAuthnCredential | null> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_credentials WHERE id = $1',
          [id]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          webAuthnUserID: row.webauthn_user_id,
          publicKey: new Uint8Array(row.public_key),
          counter: row.counter,
          transports: row.transports,
          backupEligible: row.backup_eligible,
          backupState: row.backup_state,
          lastUsed: row.last_used?.toISOString(),
          createdAt: row.created_at.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async findByUserId(userId: string | number): Promise<WebAuthnCredential[]> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        
        return result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          webAuthnUserID: row.webauthn_user_id,
          publicKey: new Uint8Array(row.public_key),
          counter: row.counter,
          transports: row.transports,
          backupEligible: row.backup_eligible,
          backupState: row.backup_state,
          lastUsed: row.last_used?.toISOString(),
          createdAt: row.created_at.toISOString(),
        }));
      } finally {
        client.release();
      }
    },

    async findByWebAuthnUserId(webAuthnUserId: Base64URLString): Promise<WebAuthnCredential[]> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_credentials WHERE webauthn_user_id = $1 ORDER BY created_at DESC',
          [webAuthnUserId]
        );
        
        return result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          webAuthnUserID: row.webauthn_user_id,
          publicKey: new Uint8Array(row.public_key),
          counter: row.counter,
          transports: row.transports,
          backupEligible: row.backup_eligible,
          backupState: row.backup_state,
          lastUsed: row.last_used?.toISOString(),
          createdAt: row.created_at.toISOString(),
        }));
      } finally {
        client.release();
      }
    },

    async create(credential: Omit<WebAuthnCredential, 'createdAt'>): Promise<WebAuthnCredential> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO webauthn_credentials 
           (id, user_id, webauthn_user_id, public_key, counter, transports, backup_eligible, backup_state, last_used) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           RETURNING *`,
          [
            credential.id,
            credential.userId,
            credential.webAuthnUserID,
            Buffer.from(credential.publicKey),
            credential.counter,
            credential.transports,
            credential.backupEligible,
            credential.backupState,
            credential.lastUsed,
          ]
        );
        
        const row = result.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          webAuthnUserID: row.webauthn_user_id,
          publicKey: new Uint8Array(row.public_key),
          counter: row.counter,
          transports: row.transports,
          backupEligible: row.backup_eligible,
          backupState: row.backup_state,
          lastUsed: row.last_used?.toISOString(),
          createdAt: row.created_at.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async updateCounter(id: Base64URLString, counter: number): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'UPDATE webauthn_credentials SET counter = $1 WHERE id = $2',
          [counter, id]
        );
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },

    async updateLastUsed(id: Base64URLString): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'UPDATE webauthn_credentials SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
          [id]
        );
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },

    async delete(id: Base64URLString): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM webauthn_credentials WHERE id = $1', [id]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },

    async deleteByUserId(userId: string | number): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM webauthn_credentials WHERE user_id = $1', [userId]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },
  };

  challenges = {
    async create(challenge: ChallengeData): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        await client.query(
          'INSERT INTO webauthn_challenges (challenge, user_id, type, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
          [challenge.challenge, challenge.userId, challenge.type, challenge.expiresAt, challenge.createdAt]
        );
        return true;
      } finally {
        client.release();
      }
    },

    async find(challenge: string): Promise<ChallengeData | null> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_challenges WHERE challenge = $1',
          [challenge]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        return {
          challenge: row.challenge,
          userId: row.user_id,
          type: row.type,
          expiresAt: row.expires_at.toISOString(),
          createdAt: row.created_at.toISOString(),
        };
      } finally {
        client.release();
      }
    },

    async delete(challenge: string): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM webauthn_challenges WHERE challenge = $1', [challenge]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },

    async deleteExpired(): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        await client.query('DELETE FROM webauthn_challenges WHERE expires_at < CURRENT_TIMESTAMP');
        return true;
      } finally {
        client.release();
      }
    },
  };

  sessions = {
    async create(sessionId: string, data: SessionData): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        // Sessions expire after 24 hours by default
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await client.query(
          'INSERT INTO webauthn_sessions (session_id, user_id, credential_id, user_verified, additional_data, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [sessionId, data.userId, data.credentialId, data.userVerified, JSON.stringify(data.additionalData), expiresAt]
        );
        return true;
      } finally {
        client.release();
      }
    },

    async find(sessionId: string): Promise<SessionData | null> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM webauthn_sessions WHERE session_id = $1 AND expires_at > CURRENT_TIMESTAMP',
          [sessionId]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        return {
          userId: row.user_id,
          credentialId: row.credential_id,
          userVerified: row.user_verified,
          additionalData: row.additional_data,
        };
      } finally {
        client.release();
      }
    },

    async update(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const setParts: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.userId !== undefined) {
          setParts.push(`user_id = $${paramIndex++}`);
          values.push(data.userId);
        }
        if (data.credentialId !== undefined) {
          setParts.push(`credential_id = $${paramIndex++}`);
          values.push(data.credentialId);
        }
        if (data.userVerified !== undefined) {
          setParts.push(`user_verified = $${paramIndex++}`);
          values.push(data.userVerified);
        }
        if (data.additionalData !== undefined) {
          setParts.push(`additional_data = $${paramIndex++}`);
          values.push(JSON.stringify(data.additionalData));
        }

        if (setParts.length === 0) {
          return true;
        }

        values.push(sessionId);

        const result = await client.query(
          `UPDATE webauthn_sessions SET ${setParts.join(', ')} WHERE session_id = $${paramIndex} AND expires_at > CURRENT_TIMESTAMP`,
          values
        );
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },

    async delete(sessionId: string): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM webauthn_sessions WHERE session_id = $1', [sessionId]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },

    async deleteExpired(): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        await client.query('DELETE FROM webauthn_sessions WHERE expires_at < CURRENT_TIMESTAMP');
        return true;
      } finally {
        client.release();
      }
    },

    async deleteByUserId(userId: string | number): Promise<boolean> {
      const client = await this.pool.connect();
      try {
        const result = await client.query('DELETE FROM webauthn_sessions WHERE user_id = $1', [userId]);
        return result.rowCount > 0;
      } finally {
        client.release();
      }
    },
  };
}

// Usage example:
/*
import { PostgreSQLStorageAdapter } from './postgresql-adapter';
import { WebAuthnServer } from 'webauthn-server-buildkit';

const storageAdapter = new PostgreSQLStorageAdapter({
  host: 'localhost',
  port: 5432,
  database: 'webauthn_db',
  user: 'webauthn_user',
  password: 'secure_password',
  ssl: true,
  max: 20,
});

// Initialize database tables
await storageAdapter.initialize();

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET,
  storageAdapter,
});

// Don't forget to close the connection when shutting down
process.on('SIGINT', async () => {
  await storageAdapter.close();
  process.exit(0);
});
*/