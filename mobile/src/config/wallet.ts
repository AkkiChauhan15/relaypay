export const PAISE_PER_RUPEE = 100;

export const MAX_LOCKED_BALANCE_MINOR = 5_000 * PAISE_PER_RUPEE;
export const MAX_TRANSACTION_AMOUNT_MINOR = 1_000 * PAISE_PER_RUPEE;

export const MAX_TRANSACTION_AGE_MS = 5 * 60 * 1_000;
export const MAX_FUTURE_CLOCK_SKEW_MS = 60 * 1_000;

export const TRANSACTION_NONCE_BYTES = 32;
export const MAX_ENCRYPTED_PAYLOAD_BYTES = 64 * 1_024;

export const rupeesToMinor = (rupees: number): number => {
  if (!Number.isSafeInteger(rupees) || rupees < 0) {
    throw new TypeError('Rupees must be a non-negative safe integer');
  }

  return rupees * PAISE_PER_RUPEE;
};
