import {
  AuthenticationCredentialJSON,
  VerifiedAuthenticationInfo,
  InternalConfig,
  VerificationError,
  AuthenticationError,
  ParsedClientDataJSON,
  WebAuthnCredential,
} from '@/types';
import {
  parseAuthenticatorData,
  validateAuthenticatorDataFlags,
  parseCOSEPublicKey,
  verifySignature,
} from '@/crypto';
import { base64URLToBuffer, base64URLToString } from '@/utils/base64url';
import { sha256 } from '@/utils/hash';
import { buffersEqual, concatBuffers } from '@/utils/buffer';

/**
 * Options for verifying authentication response
 */
export interface VerifyAuthenticationResponseParams {
  response: AuthenticationCredentialJSON;
  expectedChallenge: string;
  expectedOrigin: string | string[];
  expectedRPID?: string | string[];
  credential: WebAuthnCredential;
  requireUserVerification?: boolean;
}

/**
 * Verify an authentication response
 */
export function verifyAuthenticationResponse(
  config: InternalConfig,
  params: VerifyAuthenticationResponseParams,
): {
  verified: boolean;
  authenticationInfo?: VerifiedAuthenticationInfo;
} {
  const {
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID = config.rpID,
    credential,
    requireUserVerification = config.userVerification === 'required',
  } = params;

  try {
    // Verify credential ID matches
    if (response.id !== credential.id) {
      throw new AuthenticationError('Credential ID mismatch', 'CREDENTIAL_ID_MISMATCH');
    }

    // Decode client data JSON
    const clientDataJSON = base64URLToBuffer(response.response.clientDataJSON);
    const clientData = JSON.parse(
      base64URLToString(response.response.clientDataJSON),
    ) as ParsedClientDataJSON;

    // Verify client data type
    if (clientData.type !== 'webauthn.get') {
      throw new VerificationError('Invalid client data type', 'INVALID_CLIENT_DATA_TYPE');
    }

    // Verify challenge
    if (clientData.challenge !== expectedChallenge) {
      throw new VerificationError('Challenge mismatch', 'CHALLENGE_MISMATCH');
    }

    // Verify origin
    const origins = Array.isArray(expectedOrigin) ? expectedOrigin : [expectedOrigin];
    if (!origins.includes(clientData.origin)) {
      throw new VerificationError('Origin mismatch', 'ORIGIN_MISMATCH');
    }

    // Decode authenticator data
    const authenticatorData = base64URLToBuffer(response.response.authenticatorData);
    const authData = parseAuthenticatorData(authenticatorData);

    // Verify RP ID hash
    const rpIds = Array.isArray(expectedRPID) ? expectedRPID : [expectedRPID];
    let rpIdMatch = false;
    let matchedRpId: string | undefined;
    for (const rpId of rpIds) {
      const expectedRPIDHash = sha256(rpId);
      if (buffersEqual(authData.rpIdHash, expectedRPIDHash)) {
        rpIdMatch = true;
        matchedRpId = rpId;
        break;
      }
    }
    if (!rpIdMatch) {
      throw new VerificationError('RP ID hash mismatch', 'RPID_MISMATCH');
    }

    // Validate flags
    validateAuthenticatorDataFlags(authData.flags, requireUserVerification);

    // Verify counter - WebAuthn spec requires counter to strictly increase
    // Exception: Allow 0 -> 0 for fresh credentials that haven't been used yet
    // This prevents cloned authenticator detection bypass
    if (!(authData.counter === 0 && credential.counter === 0)) {
      if (authData.counter <= credential.counter) {
        throw new AuthenticationError(
          `Authenticator counter did not increase (was ${credential.counter}, got ${authData.counter})`,
          'COUNTER_ERROR',
        );
      }
    }

    // Parse public key
    const publicKey = parseCOSEPublicKey(credential.publicKey);

    // Create signature base
    const clientDataHash = sha256(clientDataJSON);
    const signatureBase = concatBuffers(authenticatorData, clientDataHash);

    // Decode signature
    const signature = base64URLToBuffer(response.response.signature);

    // Verify signature
    const isValidSignature = verifySignature(signature, signatureBase, publicKey);

    if (!isValidSignature) {
      throw new AuthenticationError(
        'Signature verification failed',
        'SIGNATURE_VERIFICATION_FAILED',
      );
    }

    const authenticationInfo: VerifiedAuthenticationInfo = {
      newCounter: authData.counter,
      origin: clientData.origin,
      rpID: matchedRpId,
      userVerified: authData.flags.userVerified,
      credentialID: response.id,
    };

    // Log if debug is enabled
    if (config.debug && config.logger) {
      config.logger('debug', 'Authentication verified successfully', {
        credentialId: response.id,
        userVerified: authData.flags.userVerified,
        newCounter: authData.counter,
        previousCounter: credential.counter,
      });
    }

    return {
      verified: true,
      authenticationInfo,
    };
  } catch (error) {
    // Log error if debug is enabled
    if (config.debug && config.logger) {
      config.logger('error', 'Authentication verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof VerificationError ? error.code : undefined,
      });
    }

    if (error instanceof VerificationError || error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError(
      'Authentication verification failed',
      'AUTHENTICATION_VERIFICATION_FAILED',
    );
  }
}
