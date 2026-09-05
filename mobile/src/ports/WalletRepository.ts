import type {
  PublicIdentity,
  StoredTransaction,
  WalletSnapshot,
} from '../domain/types';

export interface WalletRepository {
  claimNonce(
    senderPublicKey: string,
    nonce: string,
    seenAt: number,
  ): Promise<boolean>;
  creditLockedBalance(amountMinor: number): Promise<void>;
  debitLockedBalance(amountMinor: number): Promise<boolean>;
  getPublicIdentity(): Promise<PublicIdentity | null>;
  getWallet(): Promise<WalletSnapshot>;
  initializeWallet(identity: PublicIdentity): Promise<WalletSnapshot>;
  lockBalance(
    amountMinor: number,
    maximumLockedMinor: number,
  ): Promise<WalletSnapshot>;
  saveTransaction(transaction: StoredTransaction): Promise<void>;
}
