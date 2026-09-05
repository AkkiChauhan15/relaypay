import { TRANSACTION_NONCE_BYTES } from '../config/wallet';
import { DecryptionError, InvalidEnvelopeError } from '../domain/errors';
import type {
  EncryptedEnvelope,
  PrivateIdentity,
  PublicIdentity,
} from '../domain/types';
import type { CryptoProvider } from '../ports/CryptoProvider';

interface SodiumKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface SodiumBindings {
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: string,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array | null;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: string,
    additionalData: string,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
  crypto_box_keypair(): SodiumKeyPair;
  crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
  crypto_box_seal_open(
    ciphertext: Uint8Array,
    publicKey: Uint8Array,
    privateKey: Uint8Array,
  ): Uint8Array | null;
  crypto_sign_detached(message: string, privateKey: Uint8Array): Uint8Array;
  crypto_sign_keypair(): SodiumKeyPair;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: string,
    publicKey: Uint8Array,
  ): boolean;
  from_base64(value: string): Uint8Array;
  randombytes_buf(length: number): Uint8Array;
  ready?: Promise<void>;
  to_base64(value: Uint8Array): string;
  to_string(value: Uint8Array): string;
}

const SIGNING_PUBLIC_KEY_BYTES = 32;
const ENCRYPTION_PUBLIC_KEY_BYTES = 32;
const ENVELOPE_ALGORITHM = 'X25519-SEAL+XCHACHA20-POLY1305-IETF' as const;

const associatedData = (recipientPublicKey: string): string =>
  `relaypay:encrypted-envelope:v1:${recipientPublicKey}`;

const wipe = (...values: Array<Uint8Array | null>): void => {
  for (const value of values) {
    value?.fill(0);
  }
};

export class SodiumCryptoProvider implements CryptoProvider {
  constructor(private readonly sodium: SodiumBindings) {}

  private async ensureReady(): Promise<void> {
    await this.sodium.ready;
  }

  async generateIdentity(): Promise<PrivateIdentity> {
    await this.ensureReady();
    const signing = this.sodium.crypto_sign_keypair();
    const encryption = this.sodium.crypto_box_keypair();

    try {
      return {
        signingPublicKey: this.sodium.to_base64(signing.publicKey),
        signingPrivateKey: this.sodium.to_base64(signing.privateKey),
        encryptionPublicKey: this.sodium.to_base64(encryption.publicKey),
        encryptionPrivateKey: this.sodium.to_base64(encryption.privateKey),
      };
    } finally {
      wipe(signing.privateKey, encryption.privateKey);
    }
  }

  async generateNonce(byteLength = TRANSACTION_NONCE_BYTES): Promise<string> {
    await this.ensureReady();
    return this.sodium.to_base64(this.sodium.randombytes_buf(byteLength));
  }

  async sign(message: string, signingPrivateKey: string): Promise<string> {
    await this.ensureReady();
    const privateKey = this.sodium.from_base64(signingPrivateKey);

    try {
      return this.sodium.to_base64(
        this.sodium.crypto_sign_detached(message, privateKey),
      );
    } finally {
      wipe(privateKey);
    }
  }

  async verify(
    message: string,
    signature: string,
    signingPublicKey: string,
  ): Promise<boolean> {
    await this.ensureReady();

    try {
      return this.sodium.crypto_sign_verify_detached(
        this.sodium.from_base64(signature),
        message,
        this.sodium.from_base64(signingPublicKey),
      );
    } catch {
      return false;
    }
  }

  async validatePublicIdentity(identity: PublicIdentity): Promise<void> {
    await this.ensureReady();

    try {
      const signingKey = this.sodium.from_base64(identity.signingPublicKey);
      const encryptionKey = this.sodium.from_base64(
        identity.encryptionPublicKey,
      );

      if (
        signingKey.length !== SIGNING_PUBLIC_KEY_BYTES ||
        encryptionKey.length !== ENCRYPTION_PUBLIC_KEY_BYTES
      ) {
        throw new TypeError('Invalid public key length');
      }
    } catch {
      throw new TypeError('Invalid public identity');
    }
  }

  async encryptForReceiver(
    plaintext: string,
    receiverEncryptionPublicKey: string,
  ): Promise<EncryptedEnvelope> {
    await this.ensureReady();
    const receiverPublicKey = this.sodium.from_base64(
      receiverEncryptionPublicKey,
    );
    const contentKey = this.sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
    const nonce = this.sodium.randombytes_buf(
      this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
    );

    try {
      const ciphertext = this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        plaintext,
        associatedData(receiverEncryptionPublicKey),
        null,
        nonce,
        contentKey,
      );
      const wrappedKey = this.sodium.crypto_box_seal(
        contentKey,
        receiverPublicKey,
      );

      return {
        algorithm: ENVELOPE_ALGORITHM,
        ciphertext: this.sodium.to_base64(ciphertext),
        nonce: this.sodium.to_base64(nonce),
        recipientPublicKey: receiverEncryptionPublicKey,
        version: 1,
        wrappedKey: this.sodium.to_base64(wrappedKey),
      };
    } finally {
      wipe(receiverPublicKey, contentKey, nonce);
    }
  }

  async decryptForReceiver(
    envelope: EncryptedEnvelope,
    receiverIdentity: PrivateIdentity,
  ): Promise<string> {
    await this.ensureReady();

    if (
      envelope.algorithm !== ENVELOPE_ALGORITHM ||
      envelope.recipientPublicKey !== receiverIdentity.encryptionPublicKey
    ) {
      throw new InvalidEnvelopeError(
        'Envelope is not addressed to this device',
      );
    }

    const receiverPublicKey = this.sodium.from_base64(
      receiverIdentity.encryptionPublicKey,
    );
    const receiverPrivateKey = this.sodium.from_base64(
      receiverIdentity.encryptionPrivateKey,
    );
    let contentKey: Uint8Array | null = null;

    try {
      contentKey = this.sodium.crypto_box_seal_open(
        this.sodium.from_base64(envelope.wrappedKey),
        receiverPublicKey,
        receiverPrivateKey,
      );

      if (!contentKey) {
        throw new DecryptionError('Unable to unwrap the content key');
      }

      const plaintext = this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        this.sodium.from_base64(envelope.ciphertext),
        associatedData(envelope.recipientPublicKey),
        this.sodium.from_base64(envelope.nonce),
        contentKey,
      );

      if (!plaintext) {
        throw new DecryptionError('Unable to authenticate encrypted payload');
      }

      return this.sodium.to_string(plaintext);
    } catch (error) {
      if (error instanceof InvalidEnvelopeError) {
        throw error;
      }
      if (error instanceof DecryptionError) {
        throw error;
      }

      throw new DecryptionError('Unable to decrypt transaction');
    } finally {
      wipe(receiverPrivateKey, contentKey);
    }
  }
}
