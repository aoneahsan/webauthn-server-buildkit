# Storage Adapter Examples

This directory contains production-ready storage adapter implementations for the WebAuthn Server Buildkit. These adapters demonstrate how to integrate with popular databases and storage systems.

## Available Adapters

### 1. PostgreSQL Adapter (`postgresql-adapter.ts`)

A full-featured PostgreSQL adapter with connection pooling, optimized queries, and comprehensive error handling.

**Features:**
- Connection pooling with configurable limits
- Automatic table creation and indexing
- Transaction support
- Optimized queries with proper indexing
- Type-safe database operations
- Connection management with graceful shutdown

**Dependencies:**
```bash
npm install pg
npm install --save-dev @types/pg
```

**Usage:**
```typescript
import { PostgreSQLStorageAdapter } from './postgresql-adapter';

const adapter = new PostgreSQLStorageAdapter({
  host: 'localhost',
  port: 5432,
  database: 'webauthn_db',
  user: 'webauthn_user',
  password: 'secure_password',
  ssl: true,
  max: 20, // Connection pool size
});

await adapter.initialize();
```

### 2. MongoDB Adapter (`mongodb-adapter.ts`)

A MongoDB adapter with automatic indexing, TTL support, and efficient document operations.

**Features:**
- Connection pooling with MongoDB best practices
- Automatic index creation for performance
- TTL indexes for automatic expiration
- Efficient aggregation queries
- Document validation and type safety
- Counter-based user ID generation

**Dependencies:**
```bash
npm install mongodb
```

**Usage:**
```typescript
import { MongoDBStorageAdapter } from './mongodb-adapter';

const adapter = new MongoDBStorageAdapter(
  'mongodb://localhost:27017',
  'webauthn_db',
  {
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
  }
);

await adapter.connect();
```

### 3. Redis Session Adapter (`redis-session-adapter.ts`)

A specialized Redis adapter for session storage with automatic expiration and clustering support.

**Features:**
- High-performance session storage
- Automatic TTL management
- Session statistics and monitoring
- User-based session management
- Clustering support
- Memory usage optimization

**Dependencies:**
```bash
npm install ioredis
```

**Usage:**
```typescript
import { RedisSessionAdapter } from './redis-session-adapter';

const sessionAdapter = new RedisSessionAdapter({
  host: 'localhost',
  port: 6379,
  password: 'redis-password',
  keyPrefix: 'webauthn:session:',
  defaultTTL: 24 * 60 * 60, // 24 hours
});
```

## Installation Guide

### PostgreSQL Setup

1. **Install PostgreSQL:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   
   # Docker
   docker run --name webauthn-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
   ```

2. **Create Database:**
   ```sql
   CREATE DATABASE webauthn_db;
   CREATE USER webauthn_user WITH ENCRYPTED PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE webauthn_db TO webauthn_user;
   ```

3. **Install Dependencies:**
   ```bash
   npm install pg @types/pg
   ```

### MongoDB Setup

1. **Install MongoDB:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install mongodb
   
   # macOS
   brew install mongodb-community
   
   # Docker
   docker run --name webauthn-mongo -p 27017:27017 -d mongo
   ```

2. **Create Database and User:**
   ```javascript
   use webauthn_db
   db.createUser({
     user: "webauthn_user",
     pwd: "secure_password",
     roles: [{ role: "readWrite", db: "webauthn_db" }]
   })
   ```

3. **Install Dependencies:**
   ```bash
   npm install mongodb
   ```

### Redis Setup

1. **Install Redis:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install redis-server
   
   # macOS
   brew install redis
   
   # Docker
   docker run --name webauthn-redis -p 6379:6379 -d redis
   ```

2. **Configure Redis:**
   ```bash
   # Edit /etc/redis/redis.conf
   # Set password
   requirepass your-secure-password
   
   # Set memory policy
   maxmemory-policy allkeys-lru
   ```

3. **Install Dependencies:**
   ```bash
   npm install ioredis
   ```

## Configuration Examples

### Basic Configuration

```typescript
import { WebAuthnServer } from 'webauthn-server-buildkit';
import { PostgreSQLStorageAdapter } from './postgresql-adapter';

const storageAdapter = new PostgreSQLStorageAdapter({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'webauthn_db',
  user: process.env.DB_USER || 'webauthn_user',
  password: process.env.DB_PASSWORD || 'secure_password',
  ssl: process.env.NODE_ENV === 'production',
});

const webauthn = new WebAuthnServer({
  rpName: 'My App',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: process.env.ENCRYPTION_SECRET,
  storageAdapter,
});
```

### Hybrid Configuration (PostgreSQL + Redis)

```typescript
import { PostgreSQLStorageAdapter } from './postgresql-adapter';
import { RedisSessionAdapter } from './redis-session-adapter';

// Main storage with PostgreSQL
const storageAdapter = new PostgreSQLStorageAdapter(dbConfig);

// Session storage with Redis
const sessionAdapter = new RedisSessionAdapter(redisConfig);

// Override session methods to use Redis
storageAdapter.sessions = {
  create: sessionAdapter.create.bind(sessionAdapter),
  find: sessionAdapter.find.bind(sessionAdapter),
  update: sessionAdapter.update.bind(sessionAdapter),
  delete: sessionAdapter.delete.bind(sessionAdapter),
  deleteExpired: sessionAdapter.deleteExpired.bind(sessionAdapter),
  deleteByUserId: sessionAdapter.deleteByUserId.bind(sessionAdapter),
};
```

### Production Configuration

```typescript
import { MongoDBStorageAdapter } from './mongodb-adapter';

const adapter = new MongoDBStorageAdapter(
  'mongodb://user:password@host1:27017,host2:27017/webauthn_db?replicaSet=rs0',
  'webauthn_db',
  {
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  }
);

await adapter.connect();
```

## Performance Considerations

### Database Indexing

All adapters include optimized indexes for common queries:

- **Users**: `username` (unique), `email` (sparse)
- **Credentials**: `userId`, `webAuthnUserID`, `createdAt`
- **Challenges**: `expiresAt` (TTL), `userId`
- **Sessions**: `sessionId` (unique), `expiresAt` (TTL), `userId`

### Connection Pooling

Configure connection pools based on your application load:

```typescript
// PostgreSQL
const adapter = new PostgreSQLStorageAdapter({
  // ... other config
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000,
});

// MongoDB
const adapter = new MongoDBStorageAdapter(connectionString, dbName, {
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
});
```

### Redis Optimization

```typescript
const sessionAdapter = new RedisSessionAdapter({
  // ... other config
  defaultTTL: 24 * 60 * 60,  // 24 hours
  keyPrefix: 'wa:s:',        // Short prefix
}, {
  maxRetriesPerRequest: 3,
  commandTimeout: 5000,
});
```

## Monitoring and Health Checks

### Database Health Check

```typescript
async function checkDatabaseHealth() {
  try {
    const user = await storageAdapter.users.findById(1);
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

### Session Storage Health Check

```typescript
async function checkSessionHealth() {
  try {
    const stats = await sessionAdapter.getStats();
    return { status: 'healthy', stats };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

## Migration Guide

### From Memory to PostgreSQL

1. Export existing data (if any)
2. Initialize PostgreSQL adapter
3. Import data using adapter methods
4. Update WebAuthn server configuration

### From PostgreSQL to MongoDB

1. Create migration script
2. Map PostgreSQL schemas to MongoDB documents
3. Handle ID field differences
4. Test thoroughly before switching

## Security Considerations

### Database Security

- Use connection pooling to prevent connection exhaustion
- Configure SSL/TLS for database connections
- Use database-specific user accounts with minimal privileges
- Regularly update database software and dependencies

### Session Security

- Use secure, random session IDs
- Implement proper session expiration
- Consider session encryption for sensitive data
- Monitor for session hijacking attempts

### General Security

- Validate all inputs before database operations
- Use parameterized queries to prevent SQL injection
- Implement proper error handling without exposing sensitive information
- Log security events for monitoring

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Increase timeout values in adapter configuration
2. **Memory Issues**: Adjust connection pool sizes
3. **Performance**: Review query performance and indexes
4. **Session Expiration**: Check TTL configuration

### Debug Mode

Enable debug logging in your adapters:

```typescript
// PostgreSQL
process.env.DEBUG = 'pg:*';

// MongoDB
const adapter = new MongoDBStorageAdapter(uri, db, {
  // ... other options
  logger: {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  },
});
```

## Contributing

When creating new storage adapters:

1. Implement the full `StorageAdapter` interface
2. Include comprehensive error handling
3. Add proper TypeScript types
4. Include usage examples and documentation
5. Add performance optimizations (indexes, connection pooling)
6. Include health check methods
7. Add migration utilities if needed

---

For more information about storage adapters, see the [main documentation](../../README.md) or [API documentation](../api/).