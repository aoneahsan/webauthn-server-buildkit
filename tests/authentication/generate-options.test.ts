import { describe, it, expect } from 'vitest';
import { generateAuthenticationOptions } from '@/authentication/generate-options';
import { InternalConfig, WebAuthnCredential } from '@/types';
import { TEST_RP_ID, TEST_RP_NAME, TEST_ORIGIN, TEST_TIMEOUT } from '../fixtures/webauthn-data';

// Create a mock internal config
function createMockConfig(overrides?: Partial<InternalConfig>): InternalConfig {
  return {
    rpID: TEST_RP_ID,
    rpName: TEST_RP_NAME,
    rpOrigin: TEST_ORIGIN,
    timeout: TEST_TIMEOUT,
    challengeSize: 32,
    attestationType: 'none',
    userVerification: 'preferred',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithms: [-7, -257],
    debug: false,
    ...overrides,
  };
}

describe('generateAuthenticationOptions', () => {
  describe('basic functionality', () => {
    it('should generate authentication options with required fields', () => {
      const config = createMockConfig();

      const options = generateAuthenticationOptions(config, {});

      expect(options.challenge).toBeDefined();
      expect(options.challenge.length).toBeGreaterThan(0);
      expect(options.rpId).toBe(TEST_RP_ID);
      expect(options.timeout).toBe(TEST_TIMEOUT);
    });

    it('should generate a unique challenge for each call', () => {
      const config = createMockConfig();

      const options1 = generateAuthenticationOptions(config, {});
      const options2 = generateAuthenticationOptions(config, {});

      expect(options1.challenge).not.toBe(options2.challenge);
    });

    it('should work with empty params', () => {
      const config = createMockConfig();

      const options = generateAuthenticationOptions(config);

      expect(options).toBeDefined();
      expect(options.challenge).toBeDefined();
    });
  });

  describe('userVerification', () => {
    it('should use config userVerification by default', () => {
      const config = createMockConfig({ userVerification: 'required' });

      const options = generateAuthenticationOptions(config, {});

      expect(options.userVerification).toBe('required');
    });

    it('should allow params to override userVerification', () => {
      const config = createMockConfig({ userVerification: 'preferred' });

      const options = generateAuthenticationOptions(config, {
        userVerification: 'discouraged',
      });

      expect(options.userVerification).toBe('discouraged');
    });
  });

  describe('rpId', () => {
    it('should use config rpID by default', () => {
      const config = createMockConfig({ rpID: 'example.com' });

      const options = generateAuthenticationOptions(config, {});

      expect(options.rpId).toBe('example.com');
    });

    it('should allow params to override rpId', () => {
      const config = createMockConfig({ rpID: 'example.com' });

      const options = generateAuthenticationOptions(config, {
        rpId: 'subdomain.example.com',
      });

      expect(options.rpId).toBe('subdomain.example.com');
    });
  });

  describe('timeout', () => {
    it('should use config timeout by default', () => {
      const config = createMockConfig({ timeout: 30000 });

      const options = generateAuthenticationOptions(config, {});

      expect(options.timeout).toBe(30000);
    });

    it('should allow custom timeout in params', () => {
      const config = createMockConfig({ timeout: 30000 });

      const options = generateAuthenticationOptions(config, {
        timeout: 120000,
      });

      expect(options.timeout).toBe(120000);
    });
  });

  describe('allowCredentials', () => {
    it('should not include allowCredentials when empty', () => {
      const config = createMockConfig();

      const options = generateAuthenticationOptions(config, {
        allowCredentials: [],
      });

      expect(options.allowCredentials).toBeUndefined();
    });

    it('should include allowCredentials when provided', () => {
      const config = createMockConfig();
      const credentials: WebAuthnCredential[] = [
        {
          id: 'credential-id-1',
          credentialId: 'credential-id-1',
          userId: 'user-1',
          publicKey: 'public-key-1',
          counter: 5,
          transports: ['internal', 'hybrid'],
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          aaguid: '00000000-0000-0000-0000-000000000000',
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
        },
        {
          id: 'credential-id-2',
          credentialId: 'credential-id-2',
          userId: 'user-1',
          publicKey: 'public-key-2',
          counter: 3,
          transports: ['usb'],
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          aaguid: '00000000-0000-0000-0000-000000000001',
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      ];

      const options = generateAuthenticationOptions(config, {
        allowCredentials: credentials,
      });

      expect(options.allowCredentials).toBeDefined();
      expect(options.allowCredentials).toHaveLength(2);
      expect(options.allowCredentials?.[0].id).toBe('credential-id-1');
      expect(options.allowCredentials?.[0].type).toBe('public-key');
      expect(options.allowCredentials?.[0].transports).toEqual(['internal', 'hybrid']);
      expect(options.allowCredentials?.[1].id).toBe('credential-id-2');
      expect(options.allowCredentials?.[1].transports).toEqual(['usb']);
    });
  });

  describe('extensions', () => {
    it('should include extensions when provided', () => {
      const config = createMockConfig();
      const extensions = {
        appid: 'https://legacy.example.com',
        largeBlob: { read: true },
      };

      const options = generateAuthenticationOptions(config, {
        extensions,
      });

      expect(options.extensions).toBeDefined();
      expect(options.extensions?.appid).toBe('https://legacy.example.com');
      expect(options.extensions?.largeBlob).toEqual({ read: true });
    });

    it('should not include extensions when not provided', () => {
      const config = createMockConfig();

      const options = generateAuthenticationOptions(config, {});

      expect(options.extensions).toBeUndefined();
    });
  });

  describe('discoverable credentials (passkeys)', () => {
    it('should work without allowCredentials for discoverable credentials', () => {
      const config = createMockConfig();

      const options = generateAuthenticationOptions(config, {
        userVerification: 'required',
      });

      expect(options.allowCredentials).toBeUndefined();
      expect(options.userVerification).toBe('required');
      expect(options.rpId).toBeDefined();
      expect(options.challenge).toBeDefined();
    });
  });
});
