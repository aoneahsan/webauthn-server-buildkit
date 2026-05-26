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
  getCOSEAlgorithmIdentifier,
  parseAuthenticatorData,
  parseCOSEPublicKey,
  validateAuthenticatorDataFlags,
} from '@/crypto';
import { base64URLToBuffer, bufferToBase64URL } from '@/utils/base64url';
import { sha256 } from '@/utils/hash';
import { timingSafeEqualBytes } from '@/utils/buffer';
import {
  detectMobileAttestation,
  validateMobileAttestation,
  isCborParsingError,
} from './mobile-attestation';
import { verifyAttestationStatement } from './attestation';

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
    // Non-standard mobile JSON attestation path. OFF by default: it does NOT
    // perform cryptographic WebAuthn attestation (no challenge signature), so it
    // is only consulted when the relying party explicitly opts in. When
    // disabled, every response goes through the standard WebAuthn (CBOR) path.
    if (config.enableMobileAttestation) {
      const mobileDetection = detectMobileAttestation(response);

      if (mobileDetection.reason === 'INVALID_PLACEHOLDER_ATTESTATION') {
        throw new VerificationError(
          'Invalid mobile attestation: placeholder attestation values are not accepted',
          'INVALID_MOBILE_ATTESTATION',
        );
      }

      if (mobileDetection.reason === 'MOBILE_CREDENTIAL_INVALID_ATTESTATION') {
        throw new VerificationError(
          'Mobile credential ID detected but attestation is invalid',
          'MOBILE_CREDENTIAL_INVALID_ATTESTATION',
        );
      }

      // If valid mobile attestation, use mobile validation path
      if (mobileDetection.isMobileAttestation && mobileDetection.data) {
        // Loud warning: this credential is trusted without cryptographic proof.
        config.logger?.(
          'warn',
          'Mobile attestation accepted WITHOUT cryptographic verification (enableMobileAttestation=true). Enforce freshness/authenticity out-of-band.',
          {
            credentialId: mobileDetection.data.credentialId,
            platform: mobileDetection.data.platform,
          },
        );

        const registrationInfo = validateMobileAttestation(
          response,
          mobileDetection.data,
          expectedOrigin,
        );

        return {
          verified: true,
          registrationInfo,
        };
      }
    }

    // Standard WebAuthn verification path
    // Decode client data JSON once, deriving the string from the same bytes.
    const clientDataJSON = base64URLToBuffer(response.response.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON)) as ParsedClientDataJSON;

    // Verify client data type
    if (clientData.type !== 'webauthn.create') {
      throw new VerificationError('Invalid client data type', 'INVALID_CLIENT_DATA_TYPE');
    }

    // Verify challenge
    if (clientData.challenge !== expectedChallenge) {
      throw new VerificationError('Challenge mismatch', 'CHALLENGE_MISMATCH');
    }

    // Verify origin (a custom originVerifier overrides exact-string matching).
    const origins = Array.isArray(expectedOrigin) ? expectedOrigin : [expectedOrigin];
    const originAllowed = config.originVerifier
      ? config.originVerifier(clientData.origin)
      : origins.includes(clientData.origin);
    if (!originAllowed) {
      throw new VerificationError('Origin mismatch', 'ORIGIN_MISMATCH');
    }

    // Reject cross-origin (iframe) ceremonies unless explicitly allowed.
    if (clientData.crossOrigin === true && !config.allowCrossOriginIframe) {
      throw new VerificationError(
        'Cross-origin (iframe) ceremony is not allowed',
        'CROSS_ORIGIN_NOT_ALLOWED',
      );
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
      if (timingSafeEqualBytes(authData.rpIdHash, expectedRPIDHash)) {
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

    // Parse public key and enforce the configured algorithm allowlist.
    const credentialPublicKey = parseCOSEPublicKey(authData.credentialPublicKey);
    const credentialAlg = getCOSEAlgorithmIdentifier(credentialPublicKey);
    if (!config.supportedAlgorithms.includes(credentialAlg)) {
      throw new VerificationError(
        `Credential algorithm ${String(credentialAlg)} is not in the configured supportedAlgorithms`,
        'UNSUPPORTED_CREDENTIAL_ALGORITHM',
      );
    }

    // Verify the attestation statement (bounded: none + packed self-attestation;
    // certificate-chain formats are surfaced but not trust-anchored here).
    const attestation = verifyAttestationStatement({
      attestationObject,
      clientDataHash: sha256(clientDataJSON),
      credentialPublicKey,
    });

    // The relying party requested attestation but this library could not
    // trust-anchor the statement. Warn so the policy gap is visible. (Hard
    // enforcement via trust-anchored verification is added in a later phase.)
    if (config.attestationType !== 'none' && !attestation.attestationVerified) {
      config.logger?.(
        'warn',
        `Attestation "${config.attestationType}" was requested but the "${attestation.fmt}" statement is not trust-anchored by this library (attestationVerified=false). Verify it out-of-band if you rely on attestation.`,
        { fmt: attestation.fmt },
      );
    }

    // Build credential info
    const credentialId = bufferToBase64URL(authData.credentialId);
    const transports = response.response.transports as AuthenticatorTransportFuture[] | undefined;

    const registrationInfo: VerifiedRegistrationInfo = {
      credential: {
        id: credentialId,
        publicKey: authData.credentialPublicKey,
        counter: authData.counter,
        transports,
        alg: credentialAlg,
      },
      credentialDeviceType: authData.flags.backupEligibility ? 'multiDevice' : 'singleDevice',
      credentialBackedUp: authData.flags.backupState,
      origin: clientData.origin,
      rpID: rpIds[0],
      userVerified: authData.flags.userVerified,
      fmt: attestation.fmt,
      attestationVerified: attestation.attestationVerified,
      attestationObject: attestationObjectBuffer,
      clientDataJSON,
    };

    // Add AAGUID if present
    if (authData.aaguid) {
      registrationInfo.aaguid = bufferToBase64URL(authData.aaguid);
    }

    // Surface client extension outputs (e.g. credProps.rk) when the client
    // returned them, so the relying party knows whether a discoverable
    // credential was created.
    if (response.clientExtensionResults && typeof response.clientExtensionResults === 'object') {
      registrationInfo.clientExtensionResults = response.clientExtensionResults;
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

    // Check if this is a CBOR/COSE parsing error - might indicate mobile attestation issue
    if (isCborParsingError(error)) {
      throw new VerificationError(
        'Failed to parse attestation data. If this is a mobile registration, ensure the attestation is in valid JSON format with publicKey and credentialId fields.',
        'ATTESTATION_PARSE_ERROR',
      );
    }

    // Include original error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new VerificationError(
      `Registration verification failed: ${errorMessage}`,
      'REGISTRATION_VERIFICATION_FAILED',
    );
  }
}
