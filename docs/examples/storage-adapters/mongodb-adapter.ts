import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type {
  StorageAdapter,
  UserModel,
  WebAuthnCredential,
  ChallengeData,
  SessionData,
  Base64URLString,
} from 'webauthn-server-buildkit';

interface MongoUserDocument {
  _id?: ObjectId;
  id: number;
  username: string;
  displayName: string;
  email?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  updatedAt: Date;
}

interface MongoCredentialDocument {
  _id?: ObjectId;
  id: string;
  userId: number;
  webAuthnUserID: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  backupEligible: boolean;
  backupState: boolean;
  lastUsed?: Date;
  createdAt: Date;
}

interface MongoChallengeDocument {
  _id?: ObjectId;
  challenge: string;
  userId: number;
  type: string;
  expiresAt: Date;
  createdAt: Date;
}

interface MongoSessionDocument {
  _id?: ObjectId;
  sessionId: string;
  userId: number;
  credentialId: string;
  userVerified: boolean;
  additionalData?: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * MongoDB Storage Adapter for WebAuthn Server
 * 
 * This adapter provides production-ready MongoDB storage for WebAuthn data.
 * It includes connection pooling, error handling, and optimized queries with indexes.
 */
export class MongoDBStorageAdapter implements StorageAdapter {
  private client: MongoClient;
  private db: Db;
  private connected = false;
  private userIdCounter = 1;

  // Collections
  private usersCollection: Collection<MongoUserDocument>;
  private credentialsCollection: Collection<MongoCredentialDocument>;
  private challengesCollection: Collection<MongoChallengeDocument>;
  private sessionsCollection: Collection<MongoSessionDocument>;

  constructor(
    private connectionString: string,
    private databaseName: string,
    private options: {
      maxPoolSize?: number;
      minPoolSize?: number;
      maxIdleTimeMS?: number;
      serverSelectionTimeoutMS?: number;
      socketTimeoutMS?: number;
      connectTimeoutMS?: number;
    } = {}
  ) {
    this.client = new MongoClient(connectionString, {
      maxPoolSize: options.maxPoolSize || 10,
      minPoolSize: options.minPoolSize || 5,
      maxIdleTimeMS: options.maxIdleTimeMS || 30000,
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS || 5000,
      socketTimeoutMS: options.socketTimeoutMS || 45000,
      connectTimeoutMS: options.connectTimeoutMS || 10000,
    });
  }

  /**
   * Connect to MongoDB and initialize collections
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect();
    this.db = this.client.db(this.databaseName);
    
    // Initialize collections
    this.usersCollection = this.db.collection<MongoUserDocument>('webauthn_users');
    this.credentialsCollection = this.db.collection<MongoCredentialDocument>('webauthn_credentials');
    this.challengesCollection = this.db.collection<MongoChallengeDocument>('webauthn_challenges');
    this.sessionsCollection = this.db.collection<MongoSessionDocument>('webauthn_sessions');

    // Create indexes
    await this.createIndexes();

    // Initialize user ID counter
    await this.initializeUserIdCounter();

    this.connected = true;
  }

  /**
   * Close MongoDB connection
   */
  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    // Users indexes
    await this.usersCollection.createIndex({ username: 1 }, { unique: true });
    await this.usersCollection.createIndex({ id: 1 }, { unique: true });
    await this.usersCollection.createIndex({ email: 1 }, { sparse: true });

    // Credentials indexes
    await this.credentialsCollection.createIndex({ id: 1 }, { unique: true });
    await this.credentialsCollection.createIndex({ userId: 1 });
    await this.credentialsCollection.createIndex({ webAuthnUserID: 1 });
    await this.credentialsCollection.createIndex({ createdAt: -1 });

    // Challenges indexes
    await this.challengesCollection.createIndex({ challenge: 1 }, { unique: true });
    await this.challengesCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.challengesCollection.createIndex({ userId: 1 });

    // Sessions indexes
    await this.sessionsCollection.createIndex({ sessionId: 1 }, { unique: true });
    await this.sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.sessionsCollection.createIndex({ userId: 1 });
  }

  /**
   * Initialize user ID counter
   */
  private async initializeUserIdCounter(): Promise<void> {
    const counterCollection = this.db.collection('counters');
    const counterDoc = await counterCollection.findOne({ _id: 'userId' });
    
    if (!counterDoc) {
      // Find the highest existing user ID
      const highestUser = await this.usersCollection.findOne({}, { sort: { id: -1 } });
      const startValue = highestUser ? highestUser.id + 1 : 1;
      
      await counterCollection.insertOne({
        _id: 'userId',
        sequence_value: startValue,
      });
      
      this.userIdCounter = startValue;
    } else {
      this.userIdCounter = counterDoc.sequence_value;
    }
  }

  /**
   * Get next user ID
   */
  private async getNextUserId(): Promise<number> {
    const counterCollection = this.db.collection('counters');
    const result = await counterCollection.findOneAndUpdate(
      { _id: 'userId' },
      { $inc: { sequence_value: 1 } },
      { returnDocument: 'after' }
    );
    
    return result.value.sequence_value;
  }

  /**
   * Convert MongoDB user document to UserModel
   */
  private mongoUserToModel(doc: MongoUserDocument): UserModel {
    return {
      id: doc.id,
      username: doc.username,
      displayName: doc.displayName,
      email: doc.email,
      createdAt: doc.createdAt.toISOString(),
      lastLoginAt: doc.lastLoginAt?.toISOString(),
    };
  }

  /**
   * Convert MongoDB credential document to WebAuthnCredential
   */
  private mongoCredentialToModel(doc: MongoCredentialDocument): WebAuthnCredential {
    return {
      id: doc.id,
      userId: doc.userId,
      webAuthnUserID: doc.webAuthnUserID,
      publicKey: new Uint8Array(doc.publicKey),
      counter: doc.counter,
      transports: doc.transports,
      backupEligible: doc.backupEligible,
      backupState: doc.backupState,
      lastUsed: doc.lastUsed?.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    };
  }

  /**
   * Convert MongoDB challenge document to ChallengeData
   */
  private mongoChallengeToModel(doc: MongoChallengeDocument): ChallengeData {
    return {
      challenge: doc.challenge,
      userId: doc.userId,
      type: doc.type,
      expiresAt: doc.expiresAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    };
  }

  /**
   * Convert MongoDB session document to SessionData
   */
  private mongoSessionToModel(doc: MongoSessionDocument): SessionData {
    return {
      userId: doc.userId,
      credentialId: doc.credentialId,
      userVerified: doc.userVerified,
      additionalData: doc.additionalData,
    };
  }

  users = {
    async findById(id: string | number): Promise<UserModel | null> {
      const doc = await this.usersCollection.findOne({ id: Number(id) });
      return doc ? this.mongoUserToModel(doc) : null;
    },

    async findByUsername(username: string): Promise<UserModel | null> {
      const doc = await this.usersCollection.findOne({ username });
      return doc ? this.mongoUserToModel(doc) : null;
    },

    async create(user: Omit<UserModel, 'id'>): Promise<UserModel> {
      const id = await this.getNextUserId();
      const now = new Date();
      
      const doc: MongoUserDocument = {
        id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        createdAt: new Date(user.createdAt),
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
        updatedAt: now,
      };

      try {
        await this.usersCollection.insertOne(doc);
        return this.mongoUserToModel(doc);
      } catch (error) {
        // Handle duplicate username error
        if (error.code === 11000) {
          throw new Error(`Username '${user.username}' already exists`);
        }
        throw error;
      }
    },

    async update(id: string | number, updates: Partial<UserModel>): Promise<UserModel | null> {
      const updateDoc: Partial<MongoUserDocument> = {
        updatedAt: new Date(),
      };

      if (updates.username !== undefined) {
        updateDoc.username = updates.username;
      }
      if (updates.displayName !== undefined) {
        updateDoc.displayName = updates.displayName;
      }
      if (updates.email !== undefined) {
        updateDoc.email = updates.email;
      }
      if (updates.lastLoginAt !== undefined) {
        updateDoc.lastLoginAt = new Date(updates.lastLoginAt);
      }

      const result = await this.usersCollection.findOneAndUpdate(
        { id: Number(id) },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      return result.value ? this.mongoUserToModel(result.value) : null;
    },

    async delete(id: string | number): Promise<boolean> {
      const result = await this.usersCollection.deleteOne({ id: Number(id) });
      return result.deletedCount > 0;
    },
  };

  credentials = {
    async findById(id: Base64URLString): Promise<WebAuthnCredential | null> {
      const doc = await this.credentialsCollection.findOne({ id });
      return doc ? this.mongoCredentialToModel(doc) : null;
    },

    async findByUserId(userId: string | number): Promise<WebAuthnCredential[]> {
      const docs = await this.credentialsCollection
        .find({ userId: Number(userId) })
        .sort({ createdAt: -1 })
        .toArray();
      
      return docs.map(doc => this.mongoCredentialToModel(doc));
    },

    async findByWebAuthnUserId(webAuthnUserId: Base64URLString): Promise<WebAuthnCredential[]> {
      const docs = await this.credentialsCollection
        .find({ webAuthnUserID: webAuthnUserId })
        .sort({ createdAt: -1 })
        .toArray();
      
      return docs.map(doc => this.mongoCredentialToModel(doc));
    },

    async create(credential: Omit<WebAuthnCredential, 'createdAt'>): Promise<WebAuthnCredential> {
      const now = new Date();
      const doc: MongoCredentialDocument = {
        id: credential.id,
        userId: Number(credential.userId),
        webAuthnUserID: credential.webAuthnUserID,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
        backupEligible: credential.backupEligible,
        backupState: credential.backupState,
        lastUsed: credential.lastUsed ? new Date(credential.lastUsed) : undefined,
        createdAt: now,
      };

      await this.credentialsCollection.insertOne(doc);
      return this.mongoCredentialToModel(doc);
    },

    async updateCounter(id: Base64URLString, counter: number): Promise<boolean> {
      const result = await this.credentialsCollection.updateOne(
        { id },
        { $set: { counter } }
      );
      return result.modifiedCount > 0;
    },

    async updateLastUsed(id: Base64URLString): Promise<boolean> {
      const result = await this.credentialsCollection.updateOne(
        { id },
        { $set: { lastUsed: new Date() } }
      );
      return result.modifiedCount > 0;
    },

    async delete(id: Base64URLString): Promise<boolean> {
      const result = await this.credentialsCollection.deleteOne({ id });
      return result.deletedCount > 0;
    },

    async deleteByUserId(userId: string | number): Promise<boolean> {
      const result = await this.credentialsCollection.deleteMany({ userId: Number(userId) });
      return result.deletedCount > 0;
    },
  };

  challenges = {
    async create(challenge: ChallengeData): Promise<boolean> {
      const doc: MongoChallengeDocument = {
        challenge: challenge.challenge,
        userId: Number(challenge.userId),
        type: challenge.type,
        expiresAt: new Date(challenge.expiresAt),
        createdAt: new Date(challenge.createdAt),
      };

      await this.challengesCollection.insertOne(doc);
      return true;
    },

    async find(challenge: string): Promise<ChallengeData | null> {
      const doc = await this.challengesCollection.findOne({ challenge });
      return doc ? this.mongoChallengeToModel(doc) : null;
    },

    async delete(challenge: string): Promise<boolean> {
      const result = await this.challengesCollection.deleteOne({ challenge });
      return result.deletedCount > 0;
    },

    async deleteExpired(): Promise<boolean> {
      // MongoDB TTL indexes handle expiration automatically
      // This method is kept for interface compatibility
      const result = await this.challengesCollection.deleteMany({
        expiresAt: { $lt: new Date() },
      });
      return result.deletedCount >= 0;
    },
  };

  sessions = {
    async create(sessionId: string, data: SessionData): Promise<boolean> {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      const doc: MongoSessionDocument = {
        sessionId,
        userId: Number(data.userId),
        credentialId: data.credentialId,
        userVerified: data.userVerified,
        additionalData: data.additionalData,
        createdAt: now,
        expiresAt,
      };

      await this.sessionsCollection.insertOne(doc);
      return true;
    },

    async find(sessionId: string): Promise<SessionData | null> {
      const doc = await this.sessionsCollection.findOne({
        sessionId,
        expiresAt: { $gt: new Date() },
      });
      return doc ? this.mongoSessionToModel(doc) : null;
    },

    async update(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
      const updateDoc: Partial<MongoSessionDocument> = {};

      if (data.userId !== undefined) {
        updateDoc.userId = Number(data.userId);
      }
      if (data.credentialId !== undefined) {
        updateDoc.credentialId = data.credentialId;
      }
      if (data.userVerified !== undefined) {
        updateDoc.userVerified = data.userVerified;
      }
      if (data.additionalData !== undefined) {
        updateDoc.additionalData = data.additionalData;
      }

      const result = await this.sessionsCollection.updateOne(
        { sessionId, expiresAt: { $gt: new Date() } },
        { $set: updateDoc }
      );
      return result.modifiedCount > 0;
    },

    async delete(sessionId: string): Promise<boolean> {
      const result = await this.sessionsCollection.deleteOne({ sessionId });
      return result.deletedCount > 0;
    },

    async deleteExpired(): Promise<boolean> {
      // MongoDB TTL indexes handle expiration automatically
      // This method is kept for interface compatibility
      const result = await this.sessionsCollection.deleteMany({
        expiresAt: { $lt: new Date() },
      });
      return result.deletedCount >= 0;
    },

    async deleteByUserId(userId: string | number): Promise<boolean> {
      const result = await this.sessionsCollection.deleteMany({ userId: Number(userId) });
      return result.deletedCount > 0;
    },
  };
}

// Usage example:
/*
import { MongoDBStorageAdapter } from './mongodb-adapter';
import { WebAuthnServer } from 'webauthn-server-buildkit';

const storageAdapter = new MongoDBStorageAdapter(
  'mongodb://localhost:27017',
  'webauthn_db',
  {
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
  }
);

// Connect to MongoDB
await storageAdapter.connect();

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