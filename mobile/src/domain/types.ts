export const TRANSACTION_STATUSES = [
  'pending_local',
  'relayed',
  'synced',
  'settled',
  'rejected',
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export type TransactionDirection = 'incoming' | 'outgoing';

export interface PublicIdentity {
  signingPublicKey: string;
  encryptionPublicKey: string;
}

export interface PrivateIdentity extends PublicIdentity {
  signingPrivateKey: string;
  encryptionPrivateKey: string;
}

export interface WalletSnapshot extends PublicIdentity {
  availableBalanceMinor: number;
  lockedBalanceMinor: number;
}

export interface TransactionPayload {
  amountMinor: number;
  createdAt: number;
  currency: 'INR';
  nonce: string;
  receiverPublicKey: string;
  senderPublicKey: string;
  version: 1;
}

export interface SignedTransaction {
  payload: TransactionPayload;
  signature: string;
}

export interface EncryptedEnvelope {
  algorithm: 'X25519-SEAL+XCHACHA20-POLY1305-IETF';
  ciphertext: string;
  nonce: string;
  recipientPublicKey: string;
  version: 1;
  wrappedKey: string;
}

export interface StoredTransaction {
  amountMinor: number;
  createdAt: number;
  direction: TransactionDirection;
  encryptedPayload: string;
  nonce: string;
  receiverPublicKey: string;
  recordedAt: number;
  senderPublicKey: string;
  status: TransactionStatus;
}

export interface CreatedTransaction {
  amountMinor: number;
  createdAt: number;
  encryptedPayload: string;
  nonce: string;
}
