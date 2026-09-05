import {
  MAX_LOCKED_BALANCE_MINOR,
  MAX_TRANSACTION_AGE_MS,
  MAX_TRANSACTION_AMOUNT_MINOR,
  rupeesToMinor,
} from '../src/config/wallet';
import { parseEnvelope, serializeEnvelope } from '../src/domain/canonical';
import {
  DecryptionError,
  ExpiredTransactionError,
  InsufficientLockedBalanceError,
  InvalidAmountError,
  LockedBalanceLimitError,
  ReplayTransactionError,
  SignatureVerificationError,
} from '../src/domain/errors';
import type {
  PublicIdentity,
  SignedTransaction,
  TransactionPayload,
} from '../src/domain/types';
import type { SodiumCryptoProvider } from '../src/crypto/SodiumCryptoProvider';
import { DeviceIdentityService } from '../src/wallet/DeviceIdentityService';
import { type Clock, WalletService } from '../src/wallet/WalletService';
import { InMemorySecureKeyStore } from '../testUtils/InMemorySecureKeyStore';
import { InMemoryWalletRepository } from '../testUtils/InMemoryWalletRepository';
import { createNodeCryptoProvider } from '../testUtils/nodeCryptoProvider';

class FixedClock implements Clock {
  constructor(public value: number) {}

  now(): number {
    return this.value;
  }
}

interface Harness {
  clock: FixedClock;
  crypto: SodiumCryptoProvider;
  identity: DeviceIdentityService;
  publicIdentity: PublicIdentity;
  repository: InMemoryWalletRepository;
  secureKeyStore: InMemorySecureKeyStore;
  wallet: WalletService;
}

const BASE_TIME = 1_800_000_000_000;

const createHarness = async (
  availableBalanceMinor = 0,
  now = BASE_TIME,
): Promise<Harness> => {
  const crypto = createNodeCryptoProvider();
  const repository = new InMemoryWalletRepository(availableBalanceMinor);
  const secureKeyStore = new InMemorySecureKeyStore();
  const identity = new DeviceIdentityService(
    crypto,
    secureKeyStore,
    repository,
  );
  const clock = new FixedClock(now);
  const wallet = new WalletService(crypto, identity, repository, clock);
  const publicIdentity = await identity.initialize();

  return {
    clock,
    crypto,
    identity,
    publicIdentity,
    repository,
    secureKeyStore,
    wallet,
  };
};

const createFundedSenderAndReceiver = async () => {
  const sender = await createHarness(rupeesToMinor(10_000));
  const receiver = await createHarness();
  await sender.wallet.lockBalance(MAX_LOCKED_BALANCE_MINOR);
  return { receiver, sender };
};

const mutateBase64 = (value: string): string => {
  const replacement = value[0] === 'A' ? 'B' : 'A';
  return replacement + value.slice(1);
};

test('initializes one device identity and persists only public keys in the wallet repository', async () => {
  const crypto = createNodeCryptoProvider();
  const generateSpy = jest.spyOn(crypto, 'generateIdentity');
  const repository = new InMemoryWalletRepository();
  const secureKeyStore = new InMemorySecureKeyStore();
  const identity = new DeviceIdentityService(
    crypto,
    secureKeyStore,
    repository,
  );

  const first = await identity.initialize();
  const second = await identity.initialize();
  const persistedPublicIdentity = await repository.getPublicIdentity();
  const secureIdentity = await secureKeyStore.getPrivateIdentity();

  expect(second).toEqual(first);
  expect(generateSpy).toHaveBeenCalledTimes(1);
  expect(persistedPublicIdentity).toEqual(first);
  expect(persistedPublicIdentity).not.toHaveProperty('signingPrivateKey');
  expect(persistedPublicIdentity).not.toHaveProperty('encryptionPrivateKey');
  expect(secureIdentity?.signingPrivateKey).toBeTruthy();
  expect(secureIdentity?.encryptionPrivateKey).toBeTruthy();
});

test('a valid signed and encrypted transaction round-trips', async () => {
  const { receiver, sender } = await createFundedSenderAndReceiver();
  const amountMinor = rupeesToMinor(750);

  const created = await sender.wallet.createTransaction(
    receiver.publicIdentity.encryptionPublicKey,
    amountMinor,
  );
  const verified = await receiver.wallet.verifyTransaction(
    created.encryptedPayload,
    sender.publicIdentity.signingPublicKey,
  );

  expect(verified).toMatchObject({
    amountMinor,
    createdAt: BASE_TIME,
    currency: 'INR',
    nonce: created.nonce,
    receiverPublicKey: receiver.publicIdentity.encryptionPublicKey,
    senderPublicKey: sender.publicIdentity.signingPublicKey,
    version: 1,
  });
  expect(await sender.wallet.getLockedBalance()).toBe(
    MAX_LOCKED_BALANCE_MINOR - amountMinor,
  );
  expect(sender.repository.transactions[0]?.status).toBe('pending_local');
  expect(receiver.repository.transactions[0]?.status).toBe('relayed');
});

test('tampering with the encrypted payload fails AEAD verification', async () => {
  const { receiver, sender } = await createFundedSenderAndReceiver();
  const created = await sender.wallet.createTransaction(
    receiver.publicIdentity.encryptionPublicKey,
    rupeesToMinor(100),
  );
  const envelope = parseEnvelope(created.encryptedPayload);
  const tampered = serializeEnvelope({
    ...envelope,
    ciphertext: mutateBase64(envelope.ciphertext),
  });

  await expect(
    receiver.wallet.verifyTransaction(
      tampered,
      sender.publicIdentity.signingPublicKey,
    ),
  ).rejects.toBeInstanceOf(DecryptionError);
  expect(receiver.repository.seenNonces.size).toBe(0);
});

test('an expired but correctly signed transaction is rejected', async () => {
  const { receiver, sender } = await createFundedSenderAndReceiver();
  const created = await sender.wallet.createTransaction(
    receiver.publicIdentity.encryptionPublicKey,
    rupeesToMinor(100),
  );
  receiver.clock.value = BASE_TIME + MAX_TRANSACTION_AGE_MS + 1;

  await expect(
    receiver.wallet.verifyTransaction(
      created.encryptedPayload,
      sender.publicIdentity.signingPublicKey,
    ),
  ).rejects.toBeInstanceOf(ExpiredTransactionError);
  expect(receiver.repository.seenNonces.size).toBe(0);
});

test('a replayed sender and nonce pair is rejected', async () => {
  const { receiver, sender } = await createFundedSenderAndReceiver();
  const created = await sender.wallet.createTransaction(
    receiver.publicIdentity.encryptionPublicKey,
    rupeesToMinor(100),
  );

  await receiver.wallet.verifyTransaction(
    created.encryptedPayload,
    sender.publicIdentity.signingPublicKey,
  );

  await expect(
    receiver.wallet.verifyTransaction(
      created.encryptedPayload,
      sender.publicIdentity.signingPublicKey,
    ),
  ).rejects.toBeInstanceOf(ReplayTransactionError);
  expect(receiver.repository.transactions).toHaveLength(1);
});

test('spend-cap failures happen before transaction signing', async () => {
  const sender = await createHarness(rupeesToMinor(10_000));
  const receiver = await createHarness();
  await sender.wallet.lockBalance(rupeesToMinor(500));
  const signSpy = jest.spyOn(sender.crypto, 'sign');

  await expect(
    sender.wallet.createTransaction(
      receiver.publicIdentity.encryptionPublicKey,
      MAX_TRANSACTION_AMOUNT_MINOR + 1,
    ),
  ).rejects.toBeInstanceOf(InvalidAmountError);
  await expect(
    sender.wallet.createTransaction(
      receiver.publicIdentity.encryptionPublicKey,
      rupeesToMinor(600),
    ),
  ).rejects.toBeInstanceOf(InsufficientLockedBalanceError);

  expect(signSpy).not.toHaveBeenCalled();
  expect(await sender.wallet.getLockedBalance()).toBe(rupeesToMinor(500));
  expect(sender.repository.transactions).toHaveLength(0);
});

test('the total offline locked-balance cap is enforced', async () => {
  const wallet = await createHarness(rupeesToMinor(10_000));

  await expect(
    wallet.wallet.lockBalance(MAX_LOCKED_BALANCE_MINOR + 1),
  ).rejects.toBeInstanceOf(LockedBalanceLimitError);
  expect(await wallet.wallet.getAvailableBalance()).toBe(rupeesToMinor(10_000));
  expect(await wallet.wallet.getLockedBalance()).toBe(0);
});

test('an AEAD-valid transaction with an invalid signature is not processed', async () => {
  const sender = await createHarness(rupeesToMinor(1_000));
  const receiver = await createHarness();
  const payload: TransactionPayload = {
    amountMinor: rupeesToMinor(100),
    createdAt: BASE_TIME,
    currency: 'INR',
    nonce: await sender.crypto.generateNonce(32),
    receiverPublicKey: receiver.publicIdentity.encryptionPublicKey,
    senderPublicKey: sender.publicIdentity.signingPublicKey,
    version: 1,
  };
  const unsigned: SignedTransaction = {
    payload,
    signature: await sender.crypto.generateNonce(64),
  };
  const envelope = await sender.crypto.encryptForReceiver(
    JSON.stringify(unsigned),
    receiver.publicIdentity.encryptionPublicKey,
  );

  await expect(
    receiver.wallet.verifyTransaction(
      serializeEnvelope(envelope),
      sender.publicIdentity.signingPublicKey,
    ),
  ).rejects.toBeInstanceOf(SignatureVerificationError);
  expect(receiver.repository.seenNonces.size).toBe(0);
  expect(receiver.repository.transactions).toHaveLength(0);
});

test('a relay identity cannot decrypt a receiver envelope', async () => {
  const { receiver, sender } = await createFundedSenderAndReceiver();
  const relay = await createHarness();
  const created = await sender.wallet.createTransaction(
    receiver.publicIdentity.encryptionPublicKey,
    rupeesToMinor(100),
  );
  const receiverEnvelope = parseEnvelope(created.encryptedPayload);
  const relayIdentity = await relay.identity.getPrivateIdentity();

  await expect(
    relay.crypto.decryptForReceiver(
      {
        ...receiverEnvelope,
        recipientPublicKey: relay.publicIdentity.encryptionPublicKey,
      },
      relayIdentity,
    ),
  ).rejects.toBeInstanceOf(DecryptionError);
});
