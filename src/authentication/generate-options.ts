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
 */
export interface GenerateAuthenticationOptionsParams {
  allowCredentials?: WebAuthnCredential[];
  userVerification?: UserVerificationRequirement;
  rpId?: string;
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
    timeout: config.timeout,
    rpId,
    userVerification,
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
