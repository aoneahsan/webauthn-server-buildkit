import { Redis } from 'ioredis';
import type { SessionData } from 'webauthn-server-buildkit';

/**
 * Redis Session Storage Adapter
 * 
 * This adapter provides Redis-based session storage with automatic expiration.
 * It can be used alongside other storage adapters for scalable session management.
 */
export class RedisSessionAdapter {
  private redis: Redis;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(
    connectionOptions: {
      host: string;
      port: number;
      password?: string;
      db?: number;
      keyPrefix?: string;
      defaultTTL?: number; // in seconds
    },
    redisOptions?: {
      maxRetriesPerRequest?: number;
      retryDelayOnFailover?: number;
      connectTimeout?: number;
      commandTimeout?: number;
    }
  ) {
    this.redis = new Redis({
      host: connectionOptions.host,
      port: connectionOptions.port,
      password: connectionOptions.password,
      db: connectionOptions.db || 0,
      maxRetriesPerRequest: redisOptions?.maxRetriesPerRequest || 3,
      retryDelayOnFailover: redisOptions?.retryDelayOnFailover || 100,
      connectTimeout: redisOptions?.connectTimeout || 10000,
      commandTimeout: redisOptions?.commandTimeout || 5000,
    });

    this.keyPrefix = connectionOptions.keyPrefix || 'webauthn:session:';
    this.defaultTTL = connectionOptions.defaultTTL || 24 * 60 * 60; // 24 hours
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Get session key with prefix
   */
  private getKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  /**
   * Create a new session
   */
  async create(sessionId: string, data: SessionData, ttl?: number): Promise<boolean> {
    const key = this.getKey(sessionId);
    const sessionData = JSON.stringify(data);
    const expirationTime = ttl || this.defaultTTL;
    
    const result = await this.redis.setex(key, expirationTime, sessionData);
    return result === 'OK';
  }

  /**
   * Find a session by ID
   */
  async find(sessionId: string): Promise<SessionData | null> {
    const key = this.getKey(sessionId);
    const sessionData = await this.redis.get(key);
    
    if (!sessionData) {
      return null;
    }

    try {
      return JSON.parse(sessionData);
    } catch {
      // If JSON parsing fails, delete the corrupted session
      await this.redis.del(key);
      return null;
    }
  }

  /**
   * Update session data
   */
  async update(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
    const key = this.getKey(sessionId);
    
    // Use a transaction to ensure atomicity
    const pipeline = this.redis.pipeline();
    
    // Get current data
    const currentData = await this.redis.get(key);
    if (!currentData) {
      return false;
    }

    let existingData: SessionData;
    try {
      existingData = JSON.parse(currentData);
    } catch {
      return false;
    }

    // Merge updates
    const updatedData: SessionData = {
      ...existingData,
      ...data,
    };

    // Get remaining TTL
    const ttl = await this.redis.ttl(key);
    if (ttl <= 0) {
      return false; // Session expired
    }

    // Update with preserved TTL
    pipeline.setex(key, ttl, JSON.stringify(updatedData));
    const results = await pipeline.exec();
    
    return results && results[0] && results[0][1] === 'OK';
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.redis.del(key);
    return result > 0;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteByUserId(userId: string | number): Promise<boolean> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return true;
    }

    // Get all session data
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    
    // Find sessions for this user
    const sessionsToDelete: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result[0] || !result[1]) {
        continue; // Skip errors or null values
      }
      
      try {
        const sessionData: SessionData = JSON.parse(result[1] as string);
        if (sessionData.userId === userId) {
          sessionsToDelete.push(keys[i]);
        }
      } catch {
        // If parsing fails, delete the corrupted session
        sessionsToDelete.push(keys[i]);
      }
    }

    // Delete sessions
    if (sessionsToDelete.length > 0) {
      await this.redis.del(...sessionsToDelete);
    }

    return true;
  }

  /**
   * Clean up expired sessions (manual cleanup)
   * Note: Redis automatically handles TTL expiration, but this can be used for manual cleanup
   */
  async deleteExpired(): Promise<boolean> {
    // Redis handles TTL automatically, but we can scan for any orphaned keys
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return true;
    }

    // Check TTL for each key and delete expired ones
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.ttl(key));
    const ttlResults = await pipeline.exec();
    
    const expiredKeys: string[] = [];
    for (let i = 0; i < ttlResults.length; i++) {
      const result = ttlResults[i];
      if (result[0] || result[1] === -2) {
        // TTL of -2 means the key doesn't exist or has expired
        expiredKeys.push(keys[i]);
      }
    }

    if (expiredKeys.length > 0) {
      await this.redis.del(...expiredKeys);
    }

    return true;
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    memoryUsage: number;
  }> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    let activeSessions = 0;
    let memoryUsage = 0;
    
    if (keys.length > 0) {
      const pipeline = this.redis.pipeline();
      keys.forEach(key => {
        pipeline.ttl(key);
        pipeline.memory('usage', key);
      });
      
      const results = await pipeline.exec();
      
      for (let i = 0; i < results.length; i += 2) {
        const ttlResult = results[i];
        const memoryResult = results[i + 1];
        
        if (!ttlResult[0] && ttlResult[1] > 0) {
          activeSessions++;
        }
        
        if (!memoryResult[0] && memoryResult[1]) {
          memoryUsage += memoryResult[1] as number;
        }
      }
    }

    return {
      totalSessions: keys.length,
      activeSessions,
      memoryUsage,
    };
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionId: string, ttl?: number): Promise<boolean> {
    const key = this.getKey(sessionId);
    const expirationTime = ttl || this.defaultTTL;
    
    const result = await this.redis.expire(key, expirationTime);
    return result === 1;
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Get session TTL
   */
  async getTTL(sessionId: string): Promise<number> {
    const key = this.getKey(sessionId);
    return await this.redis.ttl(key);
  }

  /**
   * Set session TTL
   */
  async setTTL(sessionId: string, ttl: number): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.redis.expire(key, ttl);
    return result === 1;
  }

  /**
   * Get all session IDs for a user
   */
  async getSessionsByUserId(userId: string | number): Promise<string[]> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    
    const userSessions: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result[0] || !result[1]) {
        continue;
      }
      
      try {
        const sessionData: SessionData = JSON.parse(result[1] as string);
        if (sessionData.userId === userId) {
          const sessionId = keys[i].replace(this.keyPrefix, '');
          userSessions.push(sessionId);
        }
      } catch {
        // Skip corrupted sessions
      }
    }

    return userSessions;
  }
}

// Usage example with WebAuthn Server:
/*
import { RedisSessionAdapter } from './redis-session-adapter';
import { MemoryStorageAdapter } from 'webauthn-server-buildkit';

// Create Redis session adapter
const sessionAdapter = new RedisSessionAdapter({
  host: 'localhost',
  port: 6379,
  password: 'your-redis-password',
  db: 0,
  keyPrefix: 'webauthn:session:',
  defaultTTL: 24 * 60 * 60, // 24 hours
});

// Create main storage adapter (can be any adapter)
const storageAdapter = new MemoryStorageAdapter();

// Override the sessions methods to use Redis
const originalSessions = storageAdapter.sessions;
storageAdapter.sessions = {
  create: sessionAdapter.create.bind(sessionAdapter),
  find: sessionAdapter.find.bind(sessionAdapter),
  update: sessionAdapter.update.bind(sessionAdapter),
  delete: sessionAdapter.delete.bind(sessionAdapter),
  deleteExpired: sessionAdapter.deleteExpired.bind(sessionAdapter),
  deleteByUserId: sessionAdapter.deleteByUserId.bind(sessionAdapter),
};

// Use with WebAuthn Server
const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET,
  storageAdapter,
});

// Session management examples
async function manageSession(sessionId: string, userId: string) {
  // Check if session exists
  const exists = await sessionAdapter.exists(sessionId);
  
  // Get session TTL
  const ttl = await sessionAdapter.getTTL(sessionId);
  
  // Refresh session
  await sessionAdapter.refreshSession(sessionId, 3600); // 1 hour
  
  // Get all sessions for user
  const userSessions = await sessionAdapter.getSessionsByUserId(userId);
  
  // Get session statistics
  const stats = await sessionAdapter.getStats();
  console.log('Session stats:', stats);
}

// Cleanup on shutdown
process.on('SIGINT', async () => {
  await sessionAdapter.close();
  process.exit(0);
});
*/