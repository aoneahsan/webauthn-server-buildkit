# WebAuthn Server Buildkit Examples

This directory contains examples demonstrating how to use the WebAuthn Server Buildkit package.

## Examples

### 1. Basic Example (`/basic`)
A simple Node.js script that demonstrates the core functionality of the library without any web framework.

```bash
cd examples/basic
npx ts-node index.ts
```

### 2. Express.js Example (`/express`)
A complete Express.js server implementation with REST API endpoints for WebAuthn registration and authentication.

```bash
cd examples/express
npm install
npx ts-node server.ts
```

## Key Concepts Demonstrated

- **User Registration Flow**: Creating registration options and verifying responses
- **User Authentication Flow**: Creating authentication options and verifying assertions
- **Session Management**: Creating, validating, and managing encrypted session tokens
- **Storage Adapters**: Using the built-in memory adapter and implementing custom adapters
- **Error Handling**: Proper error handling and response codes

## Storage Adapter Examples

For production use, you'll want to implement a proper storage adapter. Check the `/docs/examples/storage-adapters` directory for examples:

- MongoDB adapter example
- PostgreSQL adapter example
- Redis session adapter example

## Security Notes

1. **Always use HTTPS in production** - WebAuthn requires a secure context
2. **Use a strong encryption secret** - At least 32 characters for session encryption
3. **Implement rate limiting** - Protect against brute force attacks
4. **Validate origins** - Ensure requests come from expected sources
5. **Handle errors gracefully** - Don't expose sensitive information in error messages

## Client-Side Implementation

WebAuthn requires client-side JavaScript to interact with the browser's credential management API. Key steps:

1. Call `navigator.credentials.create()` for registration
2. Call `navigator.credentials.get()` for authentication
3. Send the responses to your server for verification

For a complete client-side implementation example, see the Express.js example README.