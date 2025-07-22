import express from 'express';
import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

const app = express();
app.use(express.json());

// Initialize WebAuthn server
const webauthn = new WebAuthnServer({
  rpName: 'My Express App',
  rpID: 'localhost',
  origin: 'http://localhost:3000',
  encryptionSecret: 'your-very-secure-32-character-or-longer-secret-key',
  storageAdapter: new MemoryStorageAdapter(),
});

// Registration endpoints
app.post('/api/register/options', async (req, res) => {
  try {
    const user = {
      id: req.body.userId,
      username: req.body.username,
      displayName: req.body.displayName,
    };

    const existingCredentials = await webauthn
      .getStorageAdapter()
      .credentials.findByUserId(user.id);

    const { options, challenge } = await webauthn.createRegistrationOptions(
      user,
      existingCredentials,
    );

    // Store challenge in session (not shown here)
    req.session = req.session || {};
    req.session.challenge = challenge;

    res.json(options);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/register/verify', async (req, res) => {
  try {
    const challenge = req.session?.challenge;
    if (!challenge) {
      return res.status(400).json({ error: 'No challenge found' });
    }

    const { verified, registrationInfo } = await webauthn.verifyRegistration(req.body, challenge);

    if (verified && registrationInfo) {
      // Save credential to database
      await webauthn.getStorageAdapter().credentials.create({
        ...registrationInfo.credential,
        userId: req.body.userId,
        webAuthnUserID: registrationInfo.webAuthnUserID,
      });

      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Authentication endpoints
app.post('/api/authenticate/options', async (req, res) => {
  try {
    const { username } = req.body;

    // Find user and their credentials
    const user = await webauthn.getStorageAdapter().users.findByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const credentials = await webauthn.getStorageAdapter().credentials.findByUserId(user.id);

    const { options, challenge } = await webauthn.createAuthenticationOptions(credentials);

    // Store challenge in session
    req.session = req.session || {};
    req.session.challenge = challenge;

    res.json(options);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/authenticate/verify', async (req, res) => {
  try {
    const challenge = req.session?.challenge;
    if (!challenge) {
      return res.status(400).json({ error: 'No challenge found' });
    }

    // Find the credential being used
    const credential = await webauthn.getStorageAdapter().credentials.findById(req.body.id);

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const { verified, authenticationInfo } = await webauthn.verifyAuthentication(
      req.body,
      challenge,
      credential,
    );

    if (verified && authenticationInfo) {
      // Create session
      const sessionToken = await webauthn.createSession(
        credential.userId,
        credential.id,
        authenticationInfo.userVerified,
      );

      res.json({ verified: true, token: sessionToken });
    } else {
      res.status(401).json({ verified: false });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Session validation endpoint
app.get('/api/session/validate', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { valid, sessionData } = await webauthn.validateSession(token);

    if (valid && sessionData) {
      res.json({ valid: true, userId: sessionData.userId });
    } else {
      res.status(401).json({ valid: false });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}`);
});
