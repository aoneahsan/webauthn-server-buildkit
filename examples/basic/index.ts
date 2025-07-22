import { WebAuthnServer, MemoryStorageAdapter } from 'webauthn-server-buildkit';

// Initialize the WebAuthn server
const webauthn = new WebAuthnServer({
  rpName: 'My Application',
  rpID: 'example.com',
  origin: 'https://example.com',
  encryptionSecret: 'your-very-secure-32-character-or-longer-secret-key',
  storageAdapter: new MemoryStorageAdapter(),
  debug: true,
});

async function demonstrateWebAuthn() {
  // 1. Create a user
  const user = {
    id: 'user123',
    username: 'alice@example.com',
    displayName: 'Alice Smith',
  };

  await webauthn.getStorageAdapter().users.create(user);

  // 2. Generate registration options
  const { options: regOptions, challenge: regChallenge } = await webauthn.createRegistrationOptions(
    user,
    [],
  );

  // 3. Simulate credential creation (normally done in browser)
  const mockCredential = {
    id: 'mock-credential-id',
    rawId: 'mock-credential-id',
    response: {
      clientDataJSON: Buffer.from(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: regChallenge,
          origin: 'https://example.com',
        }),
      ).toString('base64url'),
      attestationObject: 'mock-attestation-object',
    },
    type: 'public-key',
  };

  // 4. Verify registration (this would normally work with real data)
  try {
    const { verified, registrationInfo } = await webauthn.verifyRegistration(
      mockCredential as any,
      regChallenge,
    );
  } catch (error) {
    console.error('Registration verification failed (expected with mock data):', error.message);
  }

  // 5. Store a mock credential for demonstration
  const storedCredential = await webauthn.getStorageAdapter().credentials.create({
    id: 'cred123',
    userId: user.id,
    webAuthnUserID: 'webauthn-user-123',
    publicKey: new Uint8Array(65), // Mock public key
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    transports: ['internal'],
  });

  // 6. Generate authentication options
  const credentials = await webauthn.getStorageAdapter().credentials.findByUserId(user.id);

  const { options: authOptions, challenge: authChallenge } =
    await webauthn.createAuthenticationOptions(credentials);

  // 7. Create a session
  const sessionToken = await webauthn.createSession(
    user.id,
    storedCredential.id,
    true, // userVerified
    { role: 'user' }, // additional data
  );

  // 8. Validate session
  const { valid, sessionData } = await webauthn.validateSession(sessionToken);

  // 9. Clean up
  await webauthn.cleanup();
}

// Run the demonstration
demonstrateWebAuthn().catch(console.error);
