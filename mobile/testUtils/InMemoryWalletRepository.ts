import {
  IdentityStateError,
  InsufficientAvailableBalanceError,
  LockedBalanceLimitError,
} from '../src/domain/errors';
import type {
  PublicIdentity,
  StoredTransaction,
  WalletSnapshot,
} from '../src/domain/types';
import type { WalletRepository } from '../src/ports/WalletRepository';

export class InMemoryWalletRepository implements WalletRepository {
  readonly seenNonces = new Set<string>();
  readonly transactions: StoredTransaction[] = [];

  private wallet: WalletSnapshot | null = null;

  constructor(private readonly initialAvailableBalanceMinor = 0) {}

  async claimNonce(
    senderPublicKey: string,
    nonce: string,
    _seenAt: number,
  ): Promise<boolean> {
    const key = `${senderPublicKey}:${nonce}`;
    if (this.seenNonces.has(key)) {
      return false;
    }
    this.seenNonces.add(key);
    return true;
  }

  async creditLockedBalance(amountMinor: number): Promise<void> {
    const wallet = this.requireWallet();
    wallet.lockedBalanceMinor += amountMinor;
  }

  async debitLockedBalance(amountMinor: number): Promise<boolean> {
    const wallet = this.requireWallet();
    if (wallet.lockedBalanceMinor < amountMinor) {
      return false;
    }
    wallet.lockedBalanceMinor -= amountMinor;
    return true;
  }

  async getPublicIdentity(): Promise<PublicIdentity | null> {
    return this.wallet
      ? {
          signingPublicKey: this.wallet.signingPublicKey,
          encryptionPublicKey: this.wallet.encryptionPublicKey,
        }
      : null;
  }

  async getWallet(): Promise<WalletSnapshot> {
    return { ...this.requireWallet() };
  }

  async initializeWallet(identity: PublicIdentity): Promise<WalletSnapshot> {
    if (!this.wallet) {
      this.wallet = {
        ...identity,
        availableBalanceMinor: this.initialAvailableBalanceMinor,
        lockedBalanceMinor: 0,
      };
    }
    return { ...this.wallet };
  }

  async lockBalance(
    amountMinor: number,
    maximumLockedMinor: number,
  ): Promise<WalletSnapshot> {
    const wallet = this.requireWallet();
    if (wallet.lockedBalanceMinor + amountMinor > maximumLockedMinor) {
      throw new LockedBalanceLimitError('Locked balance cap exceeded');
    }
    if (wallet.availableBalanceMinor < amountMinor) {
      throw new InsufficientAvailableBalanceError(
        'Insufficient available balance',
      );
    }
    wallet.availableBalanceMinor -= amountMinor;
    wallet.lockedBalanceMinor += amountMinor;
    return { ...wallet };
  }

  async saveTransaction(transaction: StoredTransaction): Promise<void> {
    this.transactions.push({ ...transaction });
  }

  private requireWallet(): WalletSnapshot {
    if (!this.wallet) {
      throw new IdentityStateError('Wallet has not been initialized');
    }
    return this.wallet;
  }
}
