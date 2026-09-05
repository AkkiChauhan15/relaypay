export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidAmountError extends WalletError {}
export class LockedBalanceLimitError extends WalletError {}
export class InsufficientAvailableBalanceError extends WalletError {}
export class InsufficientLockedBalanceError extends WalletError {}
export class IdentityStateError extends WalletError {}
export class InvalidEnvelopeError extends WalletError {}
export class DecryptionError extends WalletError {}
export class InvalidTransactionError extends WalletError {}
export class SignatureVerificationError extends WalletError {}
export class ExpiredTransactionError extends WalletError {}
export class FutureTransactionError extends WalletError {}
export class ReplayTransactionError extends WalletError {}
