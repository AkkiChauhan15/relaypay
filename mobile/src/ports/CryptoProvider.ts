import type {
  EncryptedEnvelope,
  PrivateIdentity,
  PublicIdentity,
} from '../domain/types';

export interface CryptoProvider {
  decryptForReceiver(
    envelope: EncryptedEnvelope,
    receiverIdentity: PrivateIdentity,
  ): Promise<string>;
  encryptForReceiver(
    plaintext: string,
    receiverEncryptionPublicKey: string,
  ): Promise<EncryptedEnvelope>;
  generateIdentity(): Promise<PrivateIdentity>;
  generateNonce(byteLength: number): Promise<string>;
  sign(message: string, signingPrivateKey: string): Promise<string>;
  verify(
    message: string,
    signature: string,
    signingPublicKey: string,
  ): Promise<boolean>;
  validatePublicIdentity(identity: PublicIdentity): Promise<void>;
}
