import * as Keychain from 'react-native-keychain';

import { IdentityStateError } from '../domain/errors';
import type { PrivateIdentity } from '../domain/types';
import type { SecureKeyStore } from '../ports/SecureKeyStore';

const KEYCHAIN_SERVICE = 'com.relaypay.wallet.device-identity.v1';
const KEYCHAIN_USERNAME = 'relaypay-device-identity';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parsePrivateIdentity = (value: string): PrivateIdentity => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new IdentityStateError('Secure identity is corrupted');
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.signingPublicKey !== 'string' ||
    typeof parsed.signingPrivateKey !== 'string' ||
    typeof parsed.encryptionPublicKey !== 'string' ||
    typeof parsed.encryptionPrivateKey !== 'string' ||
    parsed.signingPublicKey.length === 0 ||
    parsed.signingPrivateKey.length === 0 ||
    parsed.encryptionPublicKey.length === 0 ||
    parsed.encryptionPrivateKey.length === 0
  ) {
    throw new IdentityStateError('Secure identity has an invalid shape');
  }

  return {
    signingPublicKey: parsed.signingPublicKey,
    signingPrivateKey: parsed.signingPrivateKey,
    encryptionPublicKey: parsed.encryptionPublicKey,
    encryptionPrivateKey: parsed.encryptionPrivateKey,
  };
};

export class KeychainPrivateKeyStore implements SecureKeyStore {
  async getPrivateIdentity(): Promise<PrivateIdentity | null> {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    if (!credentials) {
      return null;
    }

    if (credentials.username !== KEYCHAIN_USERNAME) {
      throw new IdentityStateError('Unexpected secure identity entry');
    }

    return parsePrivateIdentity(credentials.password);
  }

  async setPrivateIdentity(identity: PrivateIdentity): Promise<void> {
    const result = await Keychain.setGenericPassword(
      KEYCHAIN_USERNAME,
      JSON.stringify(identity),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
        service: KEYCHAIN_SERVICE,
      },
    );

    if (!result) {
      throw new IdentityStateError('Secure identity could not be persisted');
    }
  }
}
