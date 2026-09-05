import { IdentityStateError } from '../domain/errors';
import type { PrivateIdentity, PublicIdentity } from '../domain/types';
import type { CryptoProvider } from '../ports/CryptoProvider';
import type { SecureKeyStore } from '../ports/SecureKeyStore';
import type { WalletRepository } from '../ports/WalletRepository';

const IDENTITY_CHALLENGE = 'relaypay:device-identity-check:v1';

const publicIdentityFrom = (identity: PrivateIdentity): PublicIdentity => ({
  signingPublicKey: identity.signingPublicKey,
  encryptionPublicKey: identity.encryptionPublicKey,
});

const identitiesMatch = (
  left: PublicIdentity,
  right: PublicIdentity,
): boolean =>
  left.signingPublicKey === right.signingPublicKey &&
  left.encryptionPublicKey === right.encryptionPublicKey;

export class DeviceIdentityService {
  private initialization: Promise<PublicIdentity> | null = null;

  constructor(
    private readonly crypto: CryptoProvider,
    private readonly secureKeyStore: SecureKeyStore,
    private readonly repository: WalletRepository,
  ) {}

  initialize(): Promise<PublicIdentity> {
    if (!this.initialization) {
      this.initialization = this.initializeOnce().catch((error: unknown) => {
        this.initialization = null;
        throw error;
      });
    }

    return this.initialization;
  }

  private async initializeOnce(): Promise<PublicIdentity> {
    const [secureIdentity, storedPublicIdentity] = await Promise.all([
      this.secureKeyStore.getPrivateIdentity(),
      this.repository.getPublicIdentity(),
    ]);

    if (secureIdentity) {
      const publicIdentity = publicIdentityFrom(secureIdentity);
      await this.assertPrivateIdentityIsValid(secureIdentity);

      if (
        storedPublicIdentity &&
        !identitiesMatch(publicIdentity, storedPublicIdentity)
      ) {
        throw new IdentityStateError(
          'Secure identity does not match the SQLite public identity',
        );
      }

      if (!storedPublicIdentity) {
        await this.repository.initializeWallet(publicIdentity);
      }

      return publicIdentity;
    }

    if (storedPublicIdentity) {
      throw new IdentityStateError(
        'Private identity is missing; refusing to replace an existing wallet identity',
      );
    }

    const generatedIdentity = await this.crypto.generateIdentity();
    await this.assertPrivateIdentityIsValid(generatedIdentity);

    // Persist the private material first. If SQLite initialization fails, the
    // public half can be recovered from this secure record on the next launch.
    await this.secureKeyStore.setPrivateIdentity(generatedIdentity);
    await this.repository.initializeWallet(
      publicIdentityFrom(generatedIdentity),
    );

    return publicIdentityFrom(generatedIdentity);
  }

  async getPrivateIdentity(): Promise<PrivateIdentity> {
    await this.initialize();
    const identity = await this.secureKeyStore.getPrivateIdentity();

    if (!identity) {
      throw new IdentityStateError('Private identity is unavailable');
    }

    return identity;
  }

  private async assertPrivateIdentityIsValid(
    identity: PrivateIdentity,
  ): Promise<void> {
    await this.crypto.validatePublicIdentity(identity);
    const signature = await this.crypto.sign(
      IDENTITY_CHALLENGE,
      identity.signingPrivateKey,
    );
    const signatureValid = await this.crypto.verify(
      IDENTITY_CHALLENGE,
      signature,
      identity.signingPublicKey,
    );

    if (!signatureValid) {
      throw new IdentityStateError('Ed25519 keypair validation failed');
    }

    const envelope = await this.crypto.encryptForReceiver(
      IDENTITY_CHALLENGE,
      identity.encryptionPublicKey,
    );
    const decrypted = await this.crypto.decryptForReceiver(envelope, identity);

    if (decrypted !== IDENTITY_CHALLENGE) {
      throw new IdentityStateError('X25519 keypair validation failed');
    }
  }
}
