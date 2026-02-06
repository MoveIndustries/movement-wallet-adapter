import { useContext, createContext } from "react";
import {
  AccountAuthenticator,
  AccountInfo,
  AdapterWallet,
  AnyRawTransaction,
  MovementSignAndSubmitTransactionOutput,
  InputTransactionData,
  NetworkInfo,
  MovementSignMessageInput,
  MovementSignMessageOutput,
  AdapterNotDetectedWallet,
  Network,
  MovementChangeNetworkOutput,
  PendingTransactionResponse,
  InputSubmitTransactionData,
  MovementSignInInput,
  MovementSignInOutput,
} from "@moveindustries/wallet-adapter-core";

export interface WalletContextState {
  connected: boolean;
  isLoading: boolean;
  account: AccountInfo | null;
  network: NetworkInfo | null;
  connect(walletName: string): void;
  signIn(args: {
    walletName: string;
    input: MovementSignInInput;
  }): Promise<MovementSignInOutput | void>;
  signAndSubmitTransaction(
    transaction: InputTransactionData,
  ): Promise<MovementSignAndSubmitTransactionOutput>;
  signTransaction(args: {
    transactionOrPayload: AnyRawTransaction | InputTransactionData;
    asFeePayer?: boolean;
  }): Promise<{
    authenticator: AccountAuthenticator;
    rawTransaction: Uint8Array;
  }>;
  signMessage(message: MovementSignMessageInput): Promise<MovementSignMessageOutput>;
  signMessageAndVerify(message: MovementSignMessageInput): Promise<boolean>;
  disconnect(): void;
  changeNetwork(network: Network): Promise<MovementChangeNetworkOutput>;
  submitTransaction(
    transaction: InputSubmitTransactionData,
  ): Promise<PendingTransactionResponse>;
  wallet: AdapterWallet | null;
  wallets: ReadonlyArray<AdapterWallet>;
  notDetectedWallets: ReadonlyArray<AdapterNotDetectedWallet>;
}

const DEFAULT_CONTEXT = {
  connected: false,
};

export const WalletContext = createContext<WalletContextState>(
  DEFAULT_CONTEXT as WalletContextState,
);

export function useWallet(): WalletContextState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletContextState");
  }
  return context;
}
