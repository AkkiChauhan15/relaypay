import { createStore } from 'zustand/vanilla';

import { WalletService } from './WalletService';

export interface WalletState {
  availableBalanceMinor: number;
  error: string | null;
  isLoading: boolean;
  lockedBalanceMinor: number;
  lockBalance(amountMinor: number): Promise<void>;
  refresh(): Promise<void>;
}

export const createWalletStore = (wallet: WalletService) =>
  createStore<WalletState>((set, get) => ({
    availableBalanceMinor: 0,
    error: null,
    isLoading: false,
    lockedBalanceMinor: 0,
    lockBalance: async (amountMinor: number) => {
      set({ error: null, isLoading: true });
      try {
        await wallet.lockBalance(amountMinor);
        await get().refresh();
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : 'Wallet update failed',
          isLoading: false,
        });
        throw error;
      }
    },
    refresh: async () => {
      set({ error: null, isLoading: true });
      try {
        const [availableBalanceMinor, lockedBalanceMinor] = await Promise.all([
          wallet.getAvailableBalance(),
          wallet.getLockedBalance(),
        ]);
        set({
          availableBalanceMinor,
          error: null,
          isLoading: false,
          lockedBalanceMinor,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Wallet load failed',
          isLoading: false,
        });
        throw error;
      }
    },
  }));
