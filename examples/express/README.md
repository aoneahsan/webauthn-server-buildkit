# Express.js WebAuthn Example

This example demonstrates how to integrate WebAuthn Server Buildkit with an Express.js application.

## Setup

1. Install dependencies:
```bash
npm install express webauthn-server-buildkit
npm install --save-dev @types/express typescript ts-node
```

2. Create a `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

3. Run the server:
```bash
npx ts-node server.ts
```

## Client-Side Implementation

You'll need to implement the client-side WebAuthn API calls. Here's a basic example:

```javascript
// Registration
async function register() {
  // Get registration options
  const optionsResponse = await fetch('/api/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user123',
      username: 'john.doe',
      displayName: 'John Doe'
    })
  });
  
  const options = await optionsResponse.json();
  
  // Create credential
  const credential = await navigator.credentials.create(options);
  
  // Verify registration
  const verifyResponse = await fetch('/api/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...credential.response,
      userId: 'user123'
    })
  });
  
  const result = await verifyResponse.json();
  console.log('Registration result:', result);
}

// Authentication
async function authenticate() {
  // Get authentication options
  const optionsResponse = await fetch('/api/authenticate/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'john.doe'
    })
  });
  
  const options = await optionsResponse.json();
  
  // Get credential
  const assertion = await navigator.credentials.get(options);
  
  // Verify authentication
  const verifyResponse = await fetch('/api/authenticate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assertion.response)
  });
  
  const result = await verifyResponse.json();
  console.log('Authentication result:', result);
  
  if (result.token) {
    // Store the session token
    localStorage.setItem('sessionToken', result.token);
  }
}
```

## Notes

- This example uses in-memory storage. For production, implement a proper storage adapter.
- Session management is simplified. Consider using express-session or similar for production.
- Always use HTTPS in production as WebAuthn requires a secure context.
- Add proper error handling and validation in production code.