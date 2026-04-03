# AI Integration Guide: Biometric Authentication System

> **For AI Development Agents**: This guide provides complete implementation instructions for integrating `webauthn-server-buildkit` (backend) with `capacitor-biometric-authentication` (frontend) for biometric authentication.

## Package Overview

| Package | Role | npm |
|---------|------|-----|
| `webauthn-server-buildkit` | Backend WebAuthn server | [npm](https://www.npmjs.com/package/webauthn-server-buildkit) |
| `capacitor-biometric-authentication` | Frontend biometric UI | [npm](https://www.npmjs.com/package/capacitor-biometric-authentication) |

## Quick Setup

### 1. Install Packages

**Backend (Node.js):**
```bash
yarn add webauthn-server-buildkit
```

**Frontend (Web/Mobile App):**
```bash
yarn add capacitor-biometric-authentication
```

### 2. Backend Setup (Express.js Example)

```typescript
import express from 'express';
import { WebAuthnServer } from 'webauthn-server-buildkit';

const app = express();
app.use(express.json());

// Initialize WebAuthn server
const webauthn = new WebAuthnServer({
  rpName: 'My App',                    // Your app name
  rpID: 'myapp.com',                   // Your domain (no protocol)
  origin: [
    'https://myapp.com',               // Web origin
    'android-app://com.myapp.app',     // Android (optional)
    'ios-app://com.myapp.app',         // iOS (optional)
  ],
  encryptionSecret: process.env.ENCRYPTION_SECRET!, // Min 32 chars
});

// In-memory storage for demo (use database in production)
const users = new Map();
const credentials = new Map();

// REGISTRATION FLOW
// Step 1: Generate registration options
app.post('/api/webauthn/register/options', async (req, res) => {
  const { userId, username, displayName } = req.body;

  const user = {
    id: userId,
    username,
    displayName: displayName || username,
  };

  // Get existing credentials for this user (to exclude)
  const existingCredentials = Array.from(credentials.values())
    .filter(c => c.userId === userId);

  const { options, challenge } = await webauthn.createRegistrationOptions(
    user,
    existingCredentials
  );

  // Store challenge temporarily (use session/cache in production)
  users.set(userId, { ...user, challenge });

  res.json(options);
});

// Step 2: Verify registration response
app.post('/api/webauthn/register/verify', async (req, res) => {
  const { userId, response } = req.body;
  const user = users.get(userId);

  if (!user || !user.challenge) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  const { verified, registrationInfo } = await webauthn.verifyRegistration(
    response,
    user.challenge
  );

  if (verified && registrationInfo) {
    // Save credential to database
    credentials.set(registrationInfo.credential.id, {
      ...registrationInfo.credential,
      userId,
      webAuthnUserID: registrationInfo.credential.id,
    });

    // Clear challenge
    delete user.challenge;

    res.json({ verified: true, credentialId: registrationInfo.credential.id });
  } else {
    res.status(400).json({ verified: false });
  }
});

// AUTHENTICATION FLOW
// Step 1: Generate authentication options
app.post('/api/webauthn/authenticate/options', async (req, res) => {
  const { userId } = req.body;

  // Get user's credentials from database
  const userCredentials = Array.from(credentials.values())
    .filter(c => c.userId === userId);

  if (userCredentials.length === 0) {
    return res.status(400).json({ error: 'No credentials found' });
  }

  const { options, challenge } = await webauthn.createAuthenticationOptions(
    userCredentials
  );

  // Store challenge
  const user = users.get(userId) || { id: userId };
  users.set(userId, { ...user, authChallenge: challenge });

  res.json(options);
});

// Step 2: Verify authentication response
app.post('/api/webauthn/authenticate/verify', async (req, res) => {
  const { userId, response } = req.body;
  const user = users.get(userId);

  if (!user || !user.authChallenge) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  // Find the credential used
  const credential = credentials.get(response.id);

  if (!credential) {
    return res.status(400).json({ error: 'Credential not found' });
  }

  const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
    response,
    user.authChallenge,
    credential
  );

  if (verified && authenticationInfo) {
    // Update credential counter for replay protection
    credential.counter = authenticationInfo.newCounter;

    // Create session token
    const token = await webauthn.createSession(
      userId,
      credential.id,
      authenticationInfo.userVerified
    );

    // Clear challenge
    delete user.authChallenge;

    res.json({ verified: true, token });
  } else {
    res.status(401).json({ verified: false });
  }
});

// SESSION VALIDATION
app.get('/api/session/validate', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  const { valid, sessionData } = await webauthn.validateSession(token);

  res.json({ valid, userId: sessionData?.userId });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### 3. Frontend Setup (React Example)

```typescript
import BiometricAuth from 'capacitor-biometric-authentication';

const API_BASE = 'https://myapp.com/api';

// Check if biometrics available
async function checkBiometricSupport() {
  const available = await BiometricAuth.isAvailable();
  return available;
}

// REGISTRATION
async function registerBiometric(userId: string, username: string) {
  // Step 1: Get options from server
  const optionsRes = await fetch(`${API_BASE}/webauthn/register/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, username }),
  });
  const options = await optionsRes.json();

  // Step 2: Create credential using BiometricAuth
  const result = await BiometricAuth.authenticate({
    reason: 'Register your biometric',
    saveCredentials: true,
  });

  if (!result.success) {
    throw new Error(result.error?.message || 'Registration failed');
  }

  // Step 3: Send response to server
  const verifyRes = await fetch(`${API_BASE}/webauthn/register/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      response: result.credential,
    }),
  });

  return await verifyRes.json();
}

// AUTHENTICATION
async function authenticateWithBiometric(userId: string) {
  // Step 1: Get options from server
  const optionsRes = await fetch(`${API_BASE}/webauthn/authenticate/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const options = await optionsRes.json();

  // Step 2: Authenticate using BiometricAuth
  const result = await BiometricAuth.authenticate({
    reason: 'Log in to your account',
  });

  if (!result.success) {
    throw new Error(result.error?.message || 'Authentication failed');
  }

  // Step 3: Verify with server
  const verifyRes = await fetch(`${API_BASE}/webauthn/authenticate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      response: result.credential,
    }),
  });

  return await verifyRes.json();
}

// React component example
function BiometricLogin({ userId }: { userId: string }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkBiometricSupport().then(setIsAvailable);
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await authenticateWithBiometric(userId);
      if (result.verified) {
        // Store token, redirect to app
        localStorage.setItem('token', result.token);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Auth failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAvailable) return <p>Biometric not available</p>;

  return (
    <button onClick={handleLogin} disabled={isLoading}>
      {isLoading ? 'Authenticating...' : 'Login with Biometric'}
    </button>
  );
}
```

## API Reference Summary

### Backend (webauthn-server-buildkit)

| Method | Description |
|--------|-------------|
| `new WebAuthnServer(config)` | Initialize server |
| `createRegistrationOptions(user, excludeCredentials?)` | Generate registration challenge |
| `verifyRegistration(response, challenge)` | Verify registration |
| `createAuthenticationOptions(allowCredentials?)` | Generate auth challenge |
| `verifyAuthentication(response, challenge, credential)` | Verify authentication |
| `createSession(userId, credentialId, userVerified)` | Create session token |
| `validateSession(token)` | Validate session token |
| `revokeSession(token)` | Revoke session |

### Frontend (capacitor-biometric-authentication)

| Method | Description |
|--------|-------------|
| `BiometricAuth.isAvailable()` | Check biometric availability |
| `BiometricAuth.authenticate(options)` | Perform authentication |
| `BiometricAuth.getSupportedBiometrics()` | Get available biometric types |
| `BiometricAuth.deleteCredentials()` | Clear stored credentials |
| `BiometricAuth.configure(config)` | Configure plugin |
| `BiometricAuth.logout()` | Clear session |

## Configuration Reference

### Backend Configuration

```typescript
const webauthn = new WebAuthnServer({
  // Required
  rpName: string,           // Relying Party name
  rpID: string,             // Domain (e.g., 'example.com')
  origin: string | string[],// Expected origin(s)
  encryptionSecret: string, // Min 32 chars for session encryption

  // Optional
  sessionDuration: number,  // Session duration in ms (default: 24h)
  attestationType: 'none' | 'direct' | 'indirect' | 'enterprise',
  userVerification: 'required' | 'preferred' | 'discouraged',
  authenticatorSelection: {
    residentKey: 'required' | 'preferred' | 'discouraged',
    userVerification: 'required' | 'preferred' | 'discouraged',
    authenticatorAttachment: 'platform' | 'cross-platform',
  },
  supportedAlgorithms: number[], // COSE algorithm IDs (default: [-7, -257])
  challengeSize: number,    // Challenge size in bytes (default: 32)
  timeout: number,          // Operation timeout in ms (default: 60000)
  debug: boolean,           // Enable debug logging
});
```

### Frontend Configuration

```typescript
BiometricAuth.configure({
  sessionDuration: number,  // Session duration in seconds
  debug: boolean,           // Enable debug logging
});

BiometricAuth.authenticate({
  reason: string,           // Message shown to user
  title: string,            // Android dialog title
  subtitle: string,         // Android dialog subtitle
  fallbackTitle: string,    // Fallback button text
  cancelTitle: string,      // Cancel button text
  maxAttempts: number,      // Max failed attempts
  saveCredentials: boolean, // Store credentials
});
```

## Database Schema Example

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WebAuthn credentials table
CREATE TABLE webauthn_credentials (
  id VARCHAR(255) PRIMARY KEY,        -- credentialId (base64url)
  user_id VARCHAR(255) NOT NULL,
  public_key BYTEA NOT NULL,          -- publicKey bytes
  counter INTEGER DEFAULT 0,          -- signature counter
  transports TEXT[],                  -- ['internal', 'usb', etc.]
  device_type VARCHAR(50),            -- 'singleDevice' or 'multiDevice'
  backed_up BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions table
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  credential_id VARCHAR(255),
  user_verified BOOLEAN,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Platform Support

| Platform | Backend | Frontend |
|----------|---------|----------|
| Web | ✅ Node.js 20+ | ✅ WebAuthn API |
| iOS | ✅ | ✅ Touch ID / Face ID |
| Android | ✅ | ✅ BiometricPrompt |
| Electron | ✅ | ✅ Windows Hello / Touch ID |

## Security Checklist

- [ ] Use HTTPS in production (required for WebAuthn)
- [ ] Set strong `encryptionSecret` (min 32 chars, use env variable)
- [ ] Configure proper `rpID` matching your domain
- [ ] Store credentials securely in database
- [ ] Track and validate signature counters
- [ ] Implement session expiry and refresh
- [ ] Handle all error cases gracefully

## Error Handling

```typescript
// Backend
import {
  RegistrationError,
  AuthenticationError,
  VerificationError
} from 'webauthn-server-buildkit';

try {
  await webauthn.verifyRegistration(response, challenge);
} catch (error) {
  if (error instanceof RegistrationError) {
    // Handle registration error
  }
}

// Frontend
import { BiometricErrorCode } from 'capacitor-biometric-authentication';

const result = await BiometricAuth.authenticate();
if (!result.success) {
  switch (result.error?.code) {
    case BiometricErrorCode.USER_CANCELLED:
      // User cancelled
      break;
    case BiometricErrorCode.LOCKOUT:
      // Too many attempts
      break;
  }
}
```

## Complete Working Example

See the `/examples` directory for complete working examples:
- `examples/express/` - Full Express.js server
- `examples/basic/` - Basic Node.js usage

## Links

- **Backend**: [GitHub](https://github.com/aoneahsan/webauthn-server-buildkit) | [npm](https://www.npmjs.com/package/webauthn-server-buildkit)
- **Frontend**: [GitHub](https://github.com/aoneahsan/capacitor-biometric-authentication) | [npm](https://www.npmjs.com/package/capacitor-biometric-authentication)
- **Author**: [Ahsan Mahmood](https://aoneahsan.com) | [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)
