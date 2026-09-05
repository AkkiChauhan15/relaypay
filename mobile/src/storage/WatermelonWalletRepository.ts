import { Q, type Database } from '@nozbe/watermelondb';

import {
  IdentityStateError,
  InsufficientAvailableBalanceError,
  LockedBalanceLimitError,
} from '../domain/errors';
import type {
  PublicIdentity,
  StoredTransaction,
  WalletSnapshot,
} from '../domain/types';
import type { WalletRepository } from '../ports/WalletRepository';
import { SeenNonceModel } from './models/SeenNonceModel';
import { TransactionModel } from './models/TransactionModel';
import { WalletModel } from './models/WalletModel';

const snapshot = (wallet: WalletModel): WalletSnapshot => ({
  availableBalanceMinor: wallet.availableBalanceMinor,
  lockedBalanceMinor: wallet.lockedBalanceMinor,
  signingPublicKey: wallet.signingPublicKey,
  encryptionPublicKey: wallet.encryptionPublicKey,
});

export class WatermelonWalletRepository implements WalletRepository {
  constructor(private readonly database: Database) {}

  private async findWallet(): Promise<WalletModel | null> {
    const wallets = await this.database
      .get<WalletModel>('wallets')
      .query()
      .fetch();

    if (wallets.length > 1) {
      throw new IdentityStateError('More than one local wallet exists');
    }

    return wallets[0] ?? null;
  }

  async getPublicIdentity(): Promise<PublicIdentity | null> {
    const wallet = await this.findWallet();
    return wallet
      ? {
          signingPublicKey: wallet.signingPublicKey,
          encryptionPublicKey: wallet.encryptionPublicKey,
        }
      : null;
  }

  async initializeWallet(identity: PublicIdentity): Promise<WalletSnapshot> {
    return this.database.write(async () => {
      const existing = await this.findWallet();
      if (existing) {
        if (
          existing.signingPublicKey !== identity.signingPublicKey ||
          existing.encryptionPublicKey !== identity.encryptionPublicKey
        ) {
          throw new IdentityStateError(
            'Existing wallet has a different public identity',
          );
        }
        return snapshot(existing);
      }

      const now = Date.now();
      const wallet = await this.database
        .get<WalletModel>('wallets')
        .create(record => {
          // A new device starts with no funds. Only backend-sourced funds may
          // populate availableBalanceMinor in a later phase.
          record.availableBalanceMinor = 0;
          record.lockedBalanceMinor = 0;
          record.signingPublicKey = identity.signingPublicKey;
          record.encryptionPublicKey = identity.encryptionPublicKey;
          record.createdAt = now;
          record.updatedAt = now;
        });

      return snapshot(wallet);
    });
  }

  async getWallet(): Promise<WalletSnapshot> {
    const wallet = await this.findWallet();
    if (!wallet) {
      throw new IdentityStateError('Wallet has not been initialized');
    }
    return snapshot(wallet);
  }

  async lockBalance(
    amountMinor: number,
    maximumLockedMinor: number,
  ): Promise<WalletSnapshot> {
    return this.database.write(async () => {
      const wallet = await this.findWallet();
      if (!wallet) {
        throw new IdentityStateError('Wallet has not been initialized');
      }

      if (wallet.lockedBalanceMinor + amountMinor > maximumLockedMinor) {
        throw new LockedBalanceLimitError(
          'Requested lock exceeds the offline locked-balance cap',
        );
      }
      if (wallet.availableBalanceMinor < amountMinor) {
        throw new InsufficientAvailableBalanceError(
          'Insufficient available balance to lock',
        );
      }

      await wallet.update(record => {
        record.availableBalanceMinor -= amountMinor;
        record.lockedBalanceMinor += amountMinor;
        record.updatedAt = Date.now();
      });

      return snapshot(wallet);
    });
  }

  async debitLockedBalance(amountMinor: number): Promise<boolean> {
    return this.database.write(async () => {
      const wallet = await this.findWallet();
      if (!wallet) {
        throw new IdentityStateError('Wallet has not been initialized');
      }
      if (wallet.lockedBalanceMinor < amountMinor) {
        return false;
      }

      await wallet.update(record => {
        record.lockedBalanceMinor -= amountMinor;
        record.updatedAt = Date.now();
      });
      return true;
    });
  }

  async creditLockedBalance(amountMinor: number): Promise<void> {
    await this.database.write(async () => {
      const wallet = await this.findWallet();
      if (!wallet) {
        throw new IdentityStateError('Wallet has not been initialized');
      }

      await wallet.update(record => {
        record.lockedBalanceMinor += amountMinor;
        record.updatedAt = Date.now();
      });
    });
  }

  async saveTransaction(transaction: StoredTransaction): Promise<void> {
    await this.database.write(async () => {
      await this.database
        .get<TransactionModel>('transactions')
        .create(record => {
          record.amountMinor = transaction.amountMinor;
          record.direction = transaction.direction;
          record.encryptedPayload = transaction.encryptedPayload;
          record.nonce = transaction.nonce;
          record.receiverPublicKey = transaction.receiverPublicKey;
          record.recordedAt = transaction.recordedAt;
          record.senderPublicKey = transaction.senderPublicKey;
          record.status = transaction.status;
          record.transactionCreatedAt = transaction.createdAt;
        });
    });
  }

  async claimNonce(
    senderPublicKey: string,
    nonce: string,
    seenAt: number,
  ): Promise<boolean> {
    return this.database.write(async () => {
      const existing = await this.database
        .get<SeenNonceModel>('seen_nonces')
        .query(
          Q.where('sender_public_key', senderPublicKey),
          Q.where('nonce', nonce),
        )
        .fetch();

      if (existing.length > 0) {
        return false;
      }

      await this.database.get<SeenNonceModel>('seen_nonces').create(record => {
        record.senderPublicKey = senderPublicKey;
        record.nonce = nonce;
        record.seenAt = seenAt;
      });
      return true;
    });
  }
}
