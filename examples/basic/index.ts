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
  console.log('WebAuthn Server Buildkit - Basic Example\n');

  // 1. Create a user
  const user = {
    id: 'user123',
    username: 'alice@example.com',
    displayName: 'Alice Smith',
  };

  console.log('1. Creating user:', user);
  await webauthn.getStorageAdapter().users.create(user);

  // 2. Generate registration options
  console.log('\n2. Generating registration options...');
  const { options: regOptions, challenge: regChallenge } = 
    await webauthn.createRegistrationOptions(user, []);
  
  console.log('Registration options:', {
    ...regOptions,
    challenge: '(base64url encoded)',
    user: {
      ...regOptions.user,
      id: '(base64url encoded)',
    },
  });

  // 3. Simulate credential creation (normally done in browser)
  console.log('\n3. Simulating credential creation...');
  const mockCredential = {
    id: 'mock-credential-id',
    rawId: 'mock-credential-id',
    response: {
      clientDataJSON: Buffer.from(JSON.stringify({
        type: 'webauthn.create',
        challenge: regChallenge,
        origin: 'https://example.com',
      })).toString('base64url'),
      attestationObject: 'mock-attestation-object',
    },
    type: 'public-key',
  };

  // 4. Verify registration (this would normally work with real data)
  console.log('\n4. Verifying registration...');
  try {
    const { verified, registrationInfo } = await webauthn.verifyRegistration(
      mockCredential as any,
      regChallenge,
    );
    console.log('Registration verified:', verified);
  } catch (error) {
    console.log('Registration verification failed (expected with mock data):', error.message);
  }

  // 5. Store a mock credential for demonstration
  console.log('\n5. Storing mock credential...');
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
  console.log('Credential stored:', storedCredential.id);

  // 6. Generate authentication options
  console.log('\n6. Generating authentication options...');
  const credentials = await webauthn.getStorageAdapter()
    .credentials.findByUserId(user.id);
  
  const { options: authOptions, challenge: authChallenge } = 
    await webauthn.createAuthenticationOptions(credentials);
  
  console.log('Authentication options:', {
    ...authOptions,
    challenge: '(base64url encoded)',
  });

  // 7. Create a session
  console.log('\n7. Creating session...');
  const sessionToken = await webauthn.createSession(
    user.id,
    storedCredential.id,
    true, // userVerified
    { role: 'user' }, // additional data
  );
  console.log('Session token created:', sessionToken.substring(0, 20) + '...');

  // 8. Validate session
  console.log('\n8. Validating session...');
  const { valid, sessionData } = await webauthn.validateSession(sessionToken);
  console.log('Session valid:', valid);
  console.log('Session data:', sessionData);

  // 9. Clean up
  console.log('\n9. Cleaning up expired data...');
  await webauthn.cleanup();
  console.log('Cleanup complete!');
}

// Run the demonstration
demonstrateWebAuthn().catch(console.error);