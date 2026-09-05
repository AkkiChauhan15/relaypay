import {
  MAX_ENCRYPTED_PAYLOAD_BYTES,
  MAX_FUTURE_CLOCK_SKEW_MS,
  MAX_LOCKED_BALANCE_MINOR,
  MAX_TRANSACTION_AGE_MS,
  MAX_TRANSACTION_AMOUNT_MINOR,
  TRANSACTION_NONCE_BYTES,
} from '../config/wallet';
import {
  canonicalizeTransaction,
  parseEnvelope,
  parseSignedTransaction,
  serializeEnvelope,
} from '../domain/canonical';
import {
  ExpiredTransactionError,
  FutureTransactionError,
  InsufficientLockedBalanceError,
  InvalidAmountError,
  InvalidEnvelopeError,
  InvalidTransactionError,
  ReplayTransactionError,
  SignatureVerificationError,
} from '../domain/errors';
import type {
  CreatedTransaction,
  SignedTransaction,
  TransactionPayload,
  WalletSnapshot,
} from '../domain/types';
import type { CryptoProvider } from '../ports/CryptoProvider';
import type { WalletRepository } from '../ports/WalletRepository';
import { DeviceIdentityService } from './DeviceIdentityService';

export interface Clock {
  now(): number;
}

const systemClock: Clock = {
  now: () => Date.now(),
};

const assertValidAmount = (amountMinor: number): void => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new InvalidAmountError(
      'Amount must be a positive integer in minor currency units',
    );
  }
};

export class WalletService {
  constructor(
    private readonly crypto: CryptoProvider,
    private readonly identityService: DeviceIdentityService,
    private readonly repository: WalletRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async lockBalance(amountMinor: number): Promise<WalletSnapshot> {
    assertValidAmount(amountMinor);
    await this.identityService.initialize();
    return this.repository.lockBalance(amountMinor, MAX_LOCKED_BALANCE_MINOR);
  }

  async getAvailableBalance(): Promise<number> {
    await this.identityService.initialize();
    return (await this.repository.getWallet()).availableBalanceMinor;
  }

  async getLockedBalance(): Promise<number> {
    await this.identityService.initialize();
    return (await this.repository.getWallet()).lockedBalanceMinor;
  }

  async createTransaction(
    receiverPublicKey: string,
    amountMinor: number,
  ): Promise<CreatedTransaction> {
    assertValidAmount(amountMinor);

    if (amountMinor > MAX_TRANSACTION_AMOUNT_MINOR) {
      throw new InvalidAmountError('Transaction exceeds the offline spend cap');
    }

    if (receiverPublicKey.length === 0) {
      throw new InvalidTransactionError('Receiver public key is required');
    }

    // The local debit is the authorization boundary. If it fails, no nonce is
    // generated and no signing function is invoked.
    const debited = await this.repository.debitLockedBalance(amountMinor);
    if (!debited) {
      throw new InsufficientLockedBalanceError(
        'Insufficient pre-locked offline balance',
      );
    }

    try {
      const identity = await this.identityService.getPrivateIdentity();
      await this.crypto.validatePublicIdentity({
        signingPublicKey: identity.signingPublicKey,
        encryptionPublicKey: receiverPublicKey,
      });
      const createdAt = this.clock.now();
      const nonce = await this.crypto.generateNonce(TRANSACTION_NONCE_BYTES);
      const payload: TransactionPayload = {
        amountMinor,
        createdAt,
        currency: 'INR',
        nonce,
        receiverPublicKey,
        senderPublicKey: identity.signingPublicKey,
        version: 1,
      };
      const signature = await this.crypto.sign(
        canonicalizeTransaction(payload),
        identity.signingPrivateKey,
      );
      const signedTransaction: SignedTransaction = { payload, signature };
      const envelope = await this.crypto.encryptForReceiver(
        JSON.stringify(signedTransaction),
        receiverPublicKey,
      );
      const encryptedPayload = serializeEnvelope(envelope);

      await this.repository.saveTransaction({
        amountMinor,
        createdAt,
        direction: 'outgoing',
        encryptedPayload,
        nonce,
        receiverPublicKey,
        recordedAt: this.clock.now(),
        senderPublicKey: identity.signingPublicKey,
        status: 'pending_local',
      });

      return { amountMinor, createdAt, encryptedPayload, nonce };
    } catch (error) {
      await this.repository.creditLockedBalance(amountMinor);
      throw error;
    }
  }

  async verifyTransaction(
    encryptedPayload: string,
    senderPublicKey: string,
  ): Promise<TransactionPayload> {
    if (
      encryptedPayload.length === 0 ||
      encryptedPayload.length > MAX_ENCRYPTED_PAYLOAD_BYTES
    ) {
      throw new InvalidEnvelopeError('Encrypted payload size is invalid');
    }

    const identity = await this.identityService.getPrivateIdentity();
    const envelope = parseEnvelope(encryptedPayload);
    const decrypted = await this.crypto.decryptForReceiver(envelope, identity);
    const signedTransaction = parseSignedTransaction(decrypted);
    const { payload, signature } = signedTransaction;

    // Signature verification deliberately precedes timestamp, nonce, balance,
    // or persistence handling. Unsigned data never reaches processing logic.
    const signatureValid = await this.crypto.verify(
      canonicalizeTransaction(payload),
      signature,
      senderPublicKey,
    );

    if (!signatureValid || payload.senderPublicKey !== senderPublicKey) {
      throw new SignatureVerificationError('Ed25519 signature is invalid');
    }

    if (payload.receiverPublicKey !== identity.encryptionPublicKey) {
      throw new InvalidTransactionError(
        'Signed transaction is addressed to a different receiver',
      );
    }

    if (payload.amountMinor > MAX_TRANSACTION_AMOUNT_MINOR) {
      throw new InvalidAmountError('Transaction exceeds the offline spend cap');
    }

    const now = this.clock.now();
    if (payload.createdAt < now - MAX_TRANSACTION_AGE_MS) {
      throw new ExpiredTransactionError('Transaction timestamp has expired');
    }
    if (payload.createdAt > now + MAX_FUTURE_CLOCK_SKEW_MS) {
      throw new FutureTransactionError(
        'Transaction timestamp is in the future',
      );
    }

    const claimed = await this.repository.claimNonce(
      senderPublicKey,
      payload.nonce,
      now,
    );
    if (!claimed) {
      throw new ReplayTransactionError(
        'Transaction nonce has already been seen',
      );
    }

    await this.repository.saveTransaction({
      amountMinor: payload.amountMinor,
      createdAt: payload.createdAt,
      direction: 'incoming',
      encryptedPayload,
      nonce: payload.nonce,
      receiverPublicKey: payload.receiverPublicKey,
      recordedAt: now,
      senderPublicKey: payload.senderPublicKey,
      status: 'relayed',
    });

    return payload;
  }
}
