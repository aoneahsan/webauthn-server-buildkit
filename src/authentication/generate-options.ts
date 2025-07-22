import {
  PublicKeyCredentialRequestOptionsJSON,
  PublicKeyCredentialDescriptor,
  WebAuthnCredential,
  InternalConfig,
  UserVerificationRequirement,
} from '@/types';
import { generateChallenge } from '@/crypto';

/**
 * Options for generating authentication options
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptions
 */
export interface GenerateAuthenticationOptionsParams {
  /**
   * List of credentials to allow
   */
  allowCredentials?: WebAuthnCredential[];
  /**
   * User verification requirement
   */
  userVerification?: UserVerificationRequirement;
  /**
   * RP ID
   */
  rpId?: string;
  /**
   * WebAuthn extensions to request
   * @see https://www.w3.org/TR/webauthn-3/#sctn-extensions
   */
  extensions?: Record<string, unknown>;
  /**
   * Custom timeout for this operation (overrides server default)
   */
  timeout?: number;
}

/**
 * Generate authentication options for WebAuthn
 */
export function generateAuthenticationOptions(
  config: InternalConfig,
  params: GenerateAuthenticationOptionsParams = {},
): PublicKeyCredentialRequestOptionsJSON {
  const {
    allowCredentials = [],
    userVerification = config.userVerification,
    rpId = config.rpID,
    extensions,
    timeout,
  } = params;

  // Generate challenge
  const challenge = generateChallenge(config.challengeSize);

  // Build allow credentials list
  const allowCredentialsList: PublicKeyCredentialDescriptor[] = allowCredentials.map((cred) => ({
    id: cred.id,
    type: 'public-key',
    transports: cred.transports,
  }));

  const options: PublicKeyCredentialRequestOptionsJSON = {
    challenge,
    timeout: timeout ?? config.timeout,
    rpId,
    userVerification,
    extensions,
  };

  // Only include allowCredentials if we have some
  if (allowCredentialsList.length > 0) {
    options.allowCredentials = allowCredentialsList;
  }

  // Log if debug is enabled
  if (config.debug && config.logger) {
    config.logger('debug', 'Generated authentication options', {
      challenge,
      allowCredentialsCount: allowCredentialsList.length,
      userVerification,
      rpId,
    });
  }

  return options;
}
