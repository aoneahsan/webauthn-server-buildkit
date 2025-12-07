import {
  RegistrationCredentialJSON,
  VerifiedRegistrationInfo,
  InternalConfig,
  VerificationError,
  AttestationObject,
  ParsedClientDataJSON,
  AuthenticatorTransportFuture,
} from '@/types';
import {
  decodeCBOR,
  parseAuthenticatorData,
  parseCOSEPublicKey,
  validateAuthenticatorDataFlags,
} from '@/crypto';
import { base64URLToBuffer, base64URLToString, bufferToBase64URL } from '@/utils/base64url';
import { sha256 } from '@/utils/hash';
import { buffersEqual } from '@/utils/buffer';

/**
 * Options for verifying registration response
 */
export interface VerifyRegistrationResponseParams {
  response: RegistrationCredentialJSON;
  expectedChallenge: string;
  expectedOrigin: string | string[];
  expectedRPID?: string | string[];
  requireUserVerification?: boolean;
}

/**
 * Verify a registration response
 */
export function verifyRegistrationResponse(
  config: InternalConfig,
  params: VerifyRegistrationResponseParams,
): {
  verified: boolean;
  registrationInfo?: VerifiedRegistrationInfo;
} {
  const {
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID = config.rpID,
    requireUserVerification = config.userVerification === 'required',
  } = params;

  try {
    // Decode client data JSON
    const clientDataJSON = base64URLToBuffer(response.response.clientDataJSON);
    const clientData = JSON.parse(
      base64URLToString(response.response.clientDataJSON),
    ) as ParsedClientDataJSON;

    // Verify client data type
    if (clientData.type !== 'webauthn.create') {
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

    // Decode attestation object
    const attestationObjectBuffer = base64URLToBuffer(response.response.attestationObject);
    const decodedAttestationObject = decodeCBOR<Map<string, unknown> | AttestationObject>(
      attestationObjectBuffer,
    );

    // Handle both Map (from cbor-x with mapsAsObjects: false) and Object formats
    let attestationObject: AttestationObject;
    if (decodedAttestationObject instanceof Map) {
      attestationObject = {
        fmt: decodedAttestationObject.get('fmt') as AttestationObject['fmt'],
        attStmt: decodedAttestationObject.get('attStmt') as Record<string, unknown>,
        authData: decodedAttestationObject.get('authData') as Uint8Array,
      };
    } else {
      attestationObject = decodedAttestationObject;
    }

    // Parse authenticator data
    const authData = parseAuthenticatorData(attestationObject.authData);

    // Verify RP ID hash
    const rpIds = Array.isArray(expectedRPID) ? expectedRPID : [expectedRPID];
    let rpIdMatch = false;
    for (const rpId of rpIds) {
      const expectedRPIDHash = sha256(rpId);
      if (buffersEqual(authData.rpIdHash, expectedRPIDHash)) {
        rpIdMatch = true;
        break;
      }
    }
    if (!rpIdMatch) {
      throw new VerificationError('RP ID hash mismatch', 'RPID_MISMATCH');
    }

    // Validate flags
    validateAuthenticatorDataFlags(authData.flags, requireUserVerification);

    // Verify that credential data is present
    if (
      !authData.flags.attestedCredentialData ||
      !authData.credentialId ||
      !authData.credentialPublicKey
    ) {
      throw new VerificationError('Missing attested credential data', 'MISSING_CREDENTIAL_DATA');
    }

    // Parse public key (for validation)
    parseCOSEPublicKey(authData.credentialPublicKey);

    // Build credential info
    const credentialId = bufferToBase64URL(authData.credentialId);
    const transports = response.response.transports as AuthenticatorTransportFuture[] | undefined;

    const registrationInfo: VerifiedRegistrationInfo = {
      credential: {
        id: credentialId,
        publicKey: authData.credentialPublicKey,
        counter: authData.counter,
        transports,
      },
      credentialDeviceType: authData.flags.backupEligibility ? 'multiDevice' : 'singleDevice',
      credentialBackedUp: authData.flags.backupState,
      origin: clientData.origin,
      rpID: rpIds[0],
      userVerified: authData.flags.userVerified,
      attestationObject: attestationObjectBuffer,
      clientDataJSON,
    };

    // Add AAGUID if present
    if (authData.aaguid) {
      registrationInfo.aaguid = bufferToBase64URL(authData.aaguid);
    }

    // Log if debug is enabled
    if (config.debug && config.logger) {
      config.logger('debug', 'Registration verified successfully', {
        credentialId,
        userVerified: authData.flags.userVerified,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
      });
    }

    return {
      verified: true,
      registrationInfo,
    };
  } catch (error) {
    // Log error if debug is enabled
    if (config.debug && config.logger) {
      config.logger('error', 'Registration verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof VerificationError ? error.code : undefined,
      });
    }

    if (error instanceof VerificationError) {
      throw error;
    }

    // Include original error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new VerificationError(
      `Registration verification failed: ${errorMessage}`,
      'REGISTRATION_VERIFICATION_FAILED',
    );
  }
}
