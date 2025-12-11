import { describe, it, expect } from 'vitest';
import { generateRegistrationOptions } from '@/registration/generate-options';
import { InternalConfig, UserModel, WebAuthnCredential } from '@/types';
import { TEST_RP_ID, TEST_RP_NAME, TEST_ORIGIN, TEST_USER, TEST_TIMEOUT } from '../fixtures/webauthn-data';

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

// Create a mock user
function createMockUser(overrides?: Partial<UserModel>): UserModel {
  return {
    id: TEST_USER.id,
    username: TEST_USER.name,
    displayName: TEST_USER.displayName,
    ...overrides,
  };
}

describe('generateRegistrationOptions', () => {
  describe('basic functionality', () => {
    it('should generate registration options with required fields', () => {
      const config = createMockConfig();
      const user = createMockUser();

      const options = generateRegistrationOptions(config, { user });

      // Check required fields
      expect(options.challenge).toBeDefined();
      expect(options.challenge.length).toBeGreaterThan(0);
      expect(options.rp).toBeDefined();
      expect(options.rp.name).toBe(TEST_RP_NAME);
      expect(options.rp.id).toBe(TEST_RP_ID);
      expect(options.user).toBeDefined();
      expect(options.user.name).toBe(TEST_USER.name);
      expect(options.user.displayName).toBe(TEST_USER.displayName);
      expect(options.pubKeyCredParams).toBeDefined();
      expect(options.pubKeyCredParams.length).toBeGreaterThan(0);
    });

    it('should generate a unique challenge for each call', () => {
      const config = createMockConfig();
      const user = createMockUser();

      const options1 = generateRegistrationOptions(config, { user });
      const options2 = generateRegistrationOptions(config, { user });

      expect(options1.challenge).not.toBe(options2.challenge);
    });

    it('should generate a unique user ID for each call', () => {
      const config = createMockConfig();
      const user = createMockUser();

      const options1 = generateRegistrationOptions(config, { user });
      const options2 = generateRegistrationOptions(config, { user });

      expect(options1.user.id).not.toBe(options2.user.id);
    });
  });

  describe('pubKeyCredParams', () => {
    it('should include supported algorithms', () => {
      const config = createMockConfig({
        supportedAlgorithms: [-7, -257, -8],
      });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, { user });

      expect(options.pubKeyCredParams).toHaveLength(3);
      expect(options.pubKeyCredParams.map((p) => p.alg)).toEqual([-7, -257, -8]);
      options.pubKeyCredParams.forEach((param) => {
        expect(param.type).toBe('public-key');
      });
    });
  });

  describe('authenticatorSelection', () => {
    it('should use config defaults', () => {
      const config = createMockConfig({
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        userVerification: 'required',
      });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, { user });

      expect(options.authenticatorSelection?.authenticatorAttachment).toBe('platform');
      expect(options.authenticatorSelection?.residentKey).toBe('required');
      expect(options.authenticatorSelection?.userVerification).toBe('required');
    });

    it('should allow params to override config', () => {
      const config = createMockConfig({
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
        },
      });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        authenticatorSelection: {
          authenticatorAttachment: 'cross-platform',
        },
      });

      expect(options.authenticatorSelection?.authenticatorAttachment).toBe('cross-platform');
    });

    it('should handle preferredAuthenticatorType: securityKey', () => {
      const config = createMockConfig();
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        preferredAuthenticatorType: 'securityKey',
      });

      expect(options.authenticatorSelection?.authenticatorAttachment).toBe('cross-platform');
    });

    it('should handle preferredAuthenticatorType: localDevice', () => {
      const config = createMockConfig();
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        preferredAuthenticatorType: 'localDevice',
      });

      expect(options.authenticatorSelection?.authenticatorAttachment).toBe('platform');
    });

    it('should handle preferredAuthenticatorType: remoteDevice', () => {
      const config = createMockConfig({
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
        },
      });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        preferredAuthenticatorType: 'remoteDevice',
      });

      // remoteDevice should remove authenticatorAttachment
      expect(options.authenticatorSelection?.authenticatorAttachment).toBeUndefined();
    });
  });

  describe('excludeCredentials', () => {
    it('should not include excludeCredentials when empty', () => {
      const config = createMockConfig();
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        excludeCredentials: [],
      });

      expect(options.excludeCredentials).toBeUndefined();
    });

    it('should include excludeCredentials when provided', () => {
      const config = createMockConfig();
      const user = createMockUser();
      const existingCredentials: WebAuthnCredential[] = [
        {
          id: 'credential-id-1',
          credentialId: 'credential-id-1',
          userId: 'user-1',
          publicKey: 'public-key-1',
          counter: 0,
          transports: ['internal'],
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          aaguid: '00000000-0000-0000-0000-000000000000',
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      ];

      const options = generateRegistrationOptions(config, {
        user,
        excludeCredentials: existingCredentials,
      });

      expect(options.excludeCredentials).toBeDefined();
      expect(options.excludeCredentials).toHaveLength(1);
      expect(options.excludeCredentials?.[0].id).toBe('credential-id-1');
      expect(options.excludeCredentials?.[0].type).toBe('public-key');
      expect(options.excludeCredentials?.[0].transports).toEqual(['internal']);
    });
  });

  describe('timeout', () => {
    it('should use config timeout by default', () => {
      const config = createMockConfig({ timeout: 30000 });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, { user });

      expect(options.timeout).toBe(30000);
    });

    it('should allow custom timeout in params', () => {
      const config = createMockConfig({ timeout: 30000 });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        timeout: 90000,
      });

      expect(options.timeout).toBe(90000);
    });
  });

  describe('attestation', () => {
    it('should use config attestationType by default', () => {
      const config = createMockConfig({ attestationType: 'direct' });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, { user });

      expect(options.attestation).toBe('direct');
    });

    it('should allow custom attestation in params', () => {
      const config = createMockConfig({ attestationType: 'none' });
      const user = createMockUser();

      const options = generateRegistrationOptions(config, {
        user,
        attestation: 'indirect',
      });

      expect(options.attestation).toBe('indirect');
    });
  });

  describe('extensions', () => {
    it('should include extensions when provided', () => {
      const config = createMockConfig();
      const user = createMockUser();
      const extensions = {
        credProps: true,
        minPinLength: true,
      };

      const options = generateRegistrationOptions(config, {
        user,
        extensions,
      });

      expect(options.extensions).toBeDefined();
      expect(options.extensions?.credProps).toBe(true);
      expect(options.extensions?.minPinLength).toBe(true);
    });
  });

  describe('user displayName', () => {
    it('should use displayName when provided', () => {
      const config = createMockConfig();
      const user = createMockUser({
        displayName: 'Custom Display Name',
      });

      const options = generateRegistrationOptions(config, { user });

      expect(options.user.displayName).toBe('Custom Display Name');
    });

    it('should fallback to username when displayName is not provided', () => {
      const config = createMockConfig();
      const user = createMockUser({
        displayName: undefined,
      });

      const options = generateRegistrationOptions(config, { user });

      expect(options.user.displayName).toBe(user.username);
    });
  });
});
