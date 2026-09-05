import type { PrivateIdentity } from '../domain/types';

export interface SecureKeyStore {
  getPrivateIdentity(): Promise<PrivateIdentity | null>;
  setPrivateIdentity(identity: PrivateIdentity): Promise<void>;
}
