import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialDescriptor,
  PublicKeyCredentialRpEntity,
  AuthenticatorSelectionCriteria,
  UserModel,
  WebAuthnCredential,
  InternalConfig,
  PreferredAuthenticatorType,
  AttestationConveyancePreference,
} from '@/types';
import { generateChallenge, generateRandomId } from '@/crypto';

/**
 * Options for generating registration options
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialcreationoptions
 */
export interface GenerateRegistrationOptionsParams {
  /**
   * User information
   */
  user: UserModel;
  /**
   * List of credentials to exclude
   */
  excludeCredentials?: WebAuthnCredential[];
  /**
   * Authenticator selection criteria
   */
  authenticatorSelection?: Partial<AuthenticatorSelectionCriteria>;
  /**
   * Preferred authenticator type (convenience parameter)
   */
  preferredAuthenticatorType?: PreferredAuthenticatorType;
  /**
   * WebAuthn extensions to request
   * @see https://www.w3.org/TR/webauthn-3/#sctn-extensions
   */
  extensions?: Record<string, unknown>;
  /**
   * Custom timeout for this operation (overrides server default)
   */
  timeout?: number;
  /**
   * Custom attestation preference for this operation (overrides server default)
   */
  attestation?: AttestationConveyancePreference;
  /**
   * Custom RP icon URL (deprecated in WebAuthn Level 3)
   * @deprecated
   */
  rpIcon?: string;
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
    extensions,
    timeout,
    attestation,
    rpIcon,
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

  // Build RP entity
  const rp: PublicKeyCredentialRpEntity = {
    name: config.rpName,
    id: config.rpID,
  };

  // Add RP icon if provided (deprecated but still supported)
  if (rpIcon || config.rpIcon) {
    rp.icon = rpIcon || config.rpIcon;
  }

  const options: PublicKeyCredentialCreationOptionsJSON = {
    challenge,
    rp,
    user: {
      id: webAuthnUserId,
      name: user.username,
      displayName: user.displayName || user.username,
    },
    pubKeyCredParams,
    timeout: timeout ?? config.timeout,
    attestation: attestation ?? config.attestationType,
    authenticatorSelection: authSelection,
    excludeCredentials: excludeCredentialsList.length > 0 ? excludeCredentialsList : undefined,
    extensions,
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
