import type { PrivateIdentity } from '../src/domain/types';
import type { SecureKeyStore } from '../src/ports/SecureKeyStore';

export class InMemorySecureKeyStore implements SecureKeyStore {
  private identity: PrivateIdentity | null = null;

  async getPrivateIdentity(): Promise<PrivateIdentity | null> {
    return this.identity ? { ...this.identity } : null;
  }

  async setPrivateIdentity(identity: PrivateIdentity): Promise<void> {
    this.identity = { ...identity };
  }
}
