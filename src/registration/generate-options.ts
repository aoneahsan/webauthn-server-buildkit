import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialDescriptor,
  AuthenticatorSelectionCriteria,
  UserModel,
  WebAuthnCredential,
  InternalConfig,
  PreferredAuthenticatorType,
} from '@/types';
import { generateChallenge, generateRandomId } from '@/crypto';

/**
 * Options for generating registration options
 */
export interface GenerateRegistrationOptionsParams {
  user: UserModel;
  excludeCredentials?: WebAuthnCredential[];
  authenticatorSelection?: Partial<AuthenticatorSelectionCriteria>;
  preferredAuthenticatorType?: PreferredAuthenticatorType;
}

/**
 * Generate registration options for WebAuthn
 */
export function generateRegistrationOptions(
  config: InternalConfig,
  params: GenerateRegistrationOptionsParams,
): PublicKeyCredentialCreationOptionsJSON {
  const {
    user,
    excludeCredentials = [],
    authenticatorSelection = {},
    preferredAuthenticatorType,
  } = params;

  // Generate challenge
  const challenge = generateChallenge(config.challengeSize);

  // Generate WebAuthn user ID if not provided
  const webAuthnUserId = generateRandomId(32);

  // Build authenticator selection criteria
  const authSelection: AuthenticatorSelectionCriteria = {
    residentKey: config.authenticatorSelection.residentKey ?? 'preferred',
    userVerification: config.userVerification,
    ...config.authenticatorSelection,
    ...authenticatorSelection,
  };

  // Handle preferred authenticator type
  if (preferredAuthenticatorType || config.preferredAuthenticatorType) {
    const type = preferredAuthenticatorType || config.preferredAuthenticatorType;
    switch (type) {
      case 'securityKey':
        authSelection.authenticatorAttachment = 'cross-platform';
        break;
      case 'localDevice':
        authSelection.authenticatorAttachment = 'platform';
        break;
      case 'remoteDevice':
        // Hybrid auth doesn't have a specific attachment
        delete authSelection.authenticatorAttachment;
        break;
    }
  }

  // Build exclude credentials list
  const excludeCredentialsList: PublicKeyCredentialDescriptor[] = excludeCredentials.map(
    (cred) => ({
      id: cred.id,
      type: 'public-key',
      transports: cred.transports,
    }),
  );

  // Build supported algorithms
  const pubKeyCredParams = config.supportedAlgorithms.map((alg) => ({
    alg,
    type: 'public-key' as const,
  }));

  const options: PublicKeyCredentialCreationOptionsJSON = {
    challenge,
    rp: {
      name: config.rpName,
      id: config.rpID,
    },
    user: {
      id: webAuthnUserId,
      name: user.username,
      displayName: user.displayName || user.username,
    },
    pubKeyCredParams,
    timeout: config.timeout,
    attestation: config.attestationType,
    authenticatorSelection: authSelection,
    excludeCredentials: excludeCredentialsList.length > 0 ? excludeCredentialsList : undefined,
  };

  // Log if debug is enabled
  if (config.debug && config.logger) {
    config.logger('debug', 'Generated registration options', {
      userId: user.id,
      challenge,
      excludeCredentialsCount: excludeCredentialsList.length,
      authenticatorSelection: authSelection,
    });
  }

  return options;
}
