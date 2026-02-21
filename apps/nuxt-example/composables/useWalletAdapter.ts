import { inject } from 'vue';
import type { WalletContextState } from '@moveindustries/wallet-adapter-vue';

export function useWalletAdapter() {
  const walletAdapter = inject<WalletContextState>('walletAdapter');
  if (!walletAdapter) {
    throw new Error('WalletAdapter not found. Make sure WalletProvider is in the component tree.');
  }
  return walletAdapter;
}
