import type {
  EncryptedEnvelope,
  SignedTransaction,
  TransactionPayload,
} from './types';
import { InvalidEnvelopeError, InvalidTransactionError } from './errors';

const ENVELOPE_ALGORITHM = 'X25519-SEAL+XCHACHA20-POLY1305-IETF' as const;

export const canonicalizeTransaction = (payload: TransactionPayload): string =>
  JSON.stringify({
    amountMinor: payload.amountMinor,
    createdAt: payload.createdAt,
    currency: payload.currency,
    nonce: payload.nonce,
    receiverPublicKey: payload.receiverPublicKey,
    senderPublicKey: payload.senderPublicKey,
    version: payload.version,
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const parseSignedTransaction = (value: string): SignedTransaction => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new InvalidTransactionError('Transaction is not valid JSON');
  }

  if (!isRecord(parsed) || !isRecord(parsed.payload)) {
    throw new InvalidTransactionError(
      'Signed transaction has an invalid shape',
    );
  }

  const payload = parsed.payload;
  if (
    payload.version !== 1 ||
    payload.currency !== 'INR' ||
    !Number.isSafeInteger(payload.amountMinor) ||
    (payload.amountMinor as number) <= 0 ||
    !Number.isSafeInteger(payload.createdAt) ||
    !isNonEmptyString(payload.nonce) ||
    !isNonEmptyString(payload.receiverPublicKey) ||
    !isNonEmptyString(payload.senderPublicKey) ||
    !isNonEmptyString(parsed.signature)
  ) {
    throw new InvalidTransactionError('Signed transaction has invalid fields');
  }

  return {
    payload: {
      amountMinor: payload.amountMinor as number,
      createdAt: payload.createdAt as number,
      currency: 'INR',
      nonce: payload.nonce,
      receiverPublicKey: payload.receiverPublicKey,
      senderPublicKey: payload.senderPublicKey,
      version: 1,
    },
    signature: parsed.signature,
  };
};

export const serializeEnvelope = (envelope: EncryptedEnvelope): string =>
  JSON.stringify({
    algorithm: envelope.algorithm,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce,
    recipientPublicKey: envelope.recipientPublicKey,
    version: envelope.version,
    wrappedKey: envelope.wrappedKey,
  });

export const parseEnvelope = (value: string): EncryptedEnvelope => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new InvalidEnvelopeError('Encrypted payload is not valid JSON');
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    parsed.algorithm !== ENVELOPE_ALGORITHM ||
    !isNonEmptyString(parsed.ciphertext) ||
    !isNonEmptyString(parsed.nonce) ||
    !isNonEmptyString(parsed.recipientPublicKey) ||
    !isNonEmptyString(parsed.wrappedKey)
  ) {
    throw new InvalidEnvelopeError('Encrypted payload has an invalid shape');
  }

  return {
    algorithm: ENVELOPE_ALGORITHM,
    ciphertext: parsed.ciphertext,
    nonce: parsed.nonce,
    recipientPublicKey: parsed.recipientPublicKey,
    version: 1,
    wrappedKey: parsed.wrappedKey,
  };
};
