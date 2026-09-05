import { reactNativeCryptoProvider } from './crypto/reactNativeCryptoProvider';
import { KeychainPrivateKeyStore } from './security/KeychainPrivateKeyStore';
import { WatermelonWalletRepository } from './storage/WatermelonWalletRepository';
import { database } from './storage/database';
import { DeviceIdentityService } from './wallet/DeviceIdentityService';
import { WalletService } from './wallet/WalletService';
import { createWalletStore } from './wallet/walletStore';

const repository = new WatermelonWalletRepository(database);
const secureKeyStore = new KeychainPrivateKeyStore();

export const deviceIdentityService = new DeviceIdentityService(
  reactNativeCryptoProvider,
  secureKeyStore,
  repository,
);

export const walletService = new WalletService(
  reactNativeCryptoProvider,
  deviceIdentityService,
  repository,
);

export const walletStore = createWalletStore(walletService);

let initialization: Promise<void> | null = null;

export const initializeRelayPayWallet = (): Promise<void> => {
  if (!initialization) {
    initialization = deviceIdentityService
      .initialize()
      .then(() => walletStore.getState().refresh())
      .catch((error: unknown) => {
        initialization = null;
        throw error;
      });
  }

  return initialization;
};
