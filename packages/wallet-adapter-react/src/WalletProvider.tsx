import {
  AvailableWallets,
  DappConfig,
  AccountInfo,
  AdapterWallet,
  NetworkInfo,
  InputTransactionData,
  MovementSignAndSubmitTransactionOutput,
  AnyRawTransaction,
  InputGenerateTransactionOptions,
  AccountAuthenticator,
  MovementSignMessageInput,
  MovementSignMessageOutput,
  AdapterNotDetectedWallet,
  WalletCore,
  Network,
  InputSubmitTransactionData,
  PendingTransactionResponse,
  WalletReadyState,
  MovementSignInInput,
  MovementSignInOutput,
  ConfidentialTransferInput,
  ConfidentialWriteOptions,
  VaultEnvelopeRecipient,
} from "@moveindustries/wallet-adapter-core";
import { ReactNode, FC, useState, useEffect, useCallback, useRef } from "react";
import { WalletContext } from "./useWallet";

export interface MovementWalletProviderProps {
  children: ReactNode;
  optInWallets?: ReadonlyArray<AvailableWallets>;
  autoConnect?:
    | boolean
    | ((core: WalletCore, adapter: AdapterWallet) => Promise<boolean>);
  dappConfig?: DappConfig;
  disableTelemetry?: boolean;
  onError?: (error: any) => void;
}

const initialState: {
  account: AccountInfo | null;
  network: NetworkInfo | null;
  connected: boolean;
  wallet: AdapterWallet | null;
} = {
  connected: false,
  account: null,
  network: null,
  wallet: null,
};

export const MovementWalletAdapterProvider: FC<MovementWalletProviderProps> = ({
  children,
  optInWallets,
  autoConnect = false,
  dappConfig,
  disableTelemetry = false,
  onError,
}: MovementWalletProviderProps) => {
  const didAttemptAutoConnectRef = useRef(false);
  // Track whether initial loading phase is complete to avoid interfering with user-initiated connections
  const initialLoadCompletedRef = useRef(false);

  const [{ account, network, connected, wallet }, setState] =
    useState(initialState);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [walletCore, setWalletCore] = useState<WalletCore>();

  const [wallets, setWallets] = useState<ReadonlyArray<AdapterWallet>>([]);
  const [notDetectedWallets, setNotDetectedWallets] = useState<
    ReadonlyArray<AdapterNotDetectedWallet>
  >([]);
  // Initialize WalletCore on first load
  useEffect(() => {
    const walletCore = new WalletCore(
      optInWallets,
      dappConfig,
      disableTelemetry,
    );
    setWalletCore(walletCore);
  }, []);

  // Update initial Wallets state once WalletCore has been initialized
  useEffect(() => {
    setWallets(walletCore?.wallets ?? []);
    setNotDetectedWallets(walletCore?.notDetectedWallets ?? []);
  }, [walletCore]);

  useEffect(() => {
    // Only attempt to auto connect once per render and only if there are wallets
    if (didAttemptAutoConnectRef.current || !walletCore?.wallets.length) {
      return;
    }

    // If auto connect is not set or is false, don't mark as attempted yet
    // This allows retry when autoConnect becomes true asynchronously
    if (!autoConnect) {
      // Only set isLoading to false during initial load, not on subsequent effect runs
      // to avoid interfering with user-initiated connect() calls
      if (!initialLoadCompletedRef.current) {
        initialLoadCompletedRef.current = true;
        setIsLoading(false);
      }
      return;
    }

    // Make sure the user has a previously connected wallet
    const walletName = localStorage.getItem("MovementWalletName");
    if (!walletName) {
      // No stored wallet name - mark as attempted since there's nothing to connect to
      didAttemptAutoConnectRef.current = true;
      if (!initialLoadCompletedRef.current) {
        initialLoadCompletedRef.current = true;
        setIsLoading(false);
      }
      return;
    }

    // Make sure the wallet is installed
    const selectedWallet = walletCore.wallets.find(
      (e) => e.name === walletName,
    ) as AdapterWallet | undefined;
    if (
      !selectedWallet ||
      selectedWallet.readyState !== WalletReadyState.Installed
    ) {
      // Wallet not found yet - DON'T mark as attempted
      // This allows retry when the wallet registers later
      if (!initialLoadCompletedRef.current) {
        initialLoadCompletedRef.current = true;
        setIsLoading(false);
      }
      return;
    }

    // Found the wallet and it's installed - mark as attempted to prevent duplicate connections
    didAttemptAutoConnectRef.current = true;

    if (!connected) {
      (async () => {
        try {
          let shouldConnect = true;

          // Providing a function to autoConnect allows the dapp to determine
          // whether to attempt to connect to the wallet using the `signIn`
          // or `connect` method. If `signIn` is successful, the user can
          // return `false` and skip the `connect` method.
          if (typeof autoConnect === "function") {
            shouldConnect = await autoConnect(walletCore, selectedWallet);
          } else {
            shouldConnect = autoConnect;
          }

          if (shouldConnect) await connect(walletName);
        } catch (error) {
          if (onError) onError(error);
          return Promise.reject(error);
        } finally {
          initialLoadCompletedRef.current = true;
          setIsLoading(false);
        }
      })();
    } else {
      initialLoadCompletedRef.current = true;
      setIsLoading(false);
    }
  }, [autoConnect, wallets]);

  const connect = async (walletName: string): Promise<void> => {
    try {
      setIsLoading(true);
      await walletCore?.connect(walletName);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (args: {
    walletName: string;
    input: MovementSignInInput;
  }): Promise<MovementSignInOutput> => {
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }

    try {
      setIsLoading(true);
      return await walletCore?.signIn(args);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      await walletCore?.disconnect();
    } catch (error) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const signAndSubmitTransaction = async (
    transaction: InputTransactionData,
  ): Promise<MovementSignAndSubmitTransactionOutput> => {
    try {
      if (!walletCore) {
        throw new Error("WalletCore is not initialized");
      }
      return await walletCore.signAndSubmitTransaction(transaction);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const signTransaction = async (args: {
    transactionOrPayload: AnyRawTransaction | InputTransactionData;
    asFeePayer?: boolean;
    options?: InputGenerateTransactionOptions & {
      expirationSecondsFromNow?: number;
      expirationTimestamp?: number;
    };
  }): Promise<{
    authenticator: AccountAuthenticator;
    rawTransaction: Uint8Array;
  }> => {
    const { transactionOrPayload, asFeePayer, options } = args;
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }
    try {
      return await walletCore.signTransaction({
        transactionOrPayload,
        asFeePayer,
      });
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const submitTransaction = async (
    transaction: InputSubmitTransactionData,
  ): Promise<PendingTransactionResponse> => {
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }
    try {
      return await walletCore?.submitTransaction(transaction);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const signMessage = async (
    message: MovementSignMessageInput,
  ): Promise<MovementSignMessageOutput> => {
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }
    try {
      return await walletCore?.signMessage(message);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const signMessageAndVerify = async (
    message: MovementSignMessageInput,
  ): Promise<boolean> => {
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }
    try {
      return await walletCore?.signMessageAndVerify(message);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const changeNetwork = async (network: Network) => {
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }
    try {
      return await walletCore?.changeNetwork(network);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const refetchMnsName = async (): Promise<void> => {
    if (!walletCore) {
      throw new Error("WalletCore is not initialized");
    }
    try {
      await walletCore.refetchMnsName();
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const supportsConfidentialAssets = (): boolean => {
    if (!walletCore) return false;
    const fn = walletCore.supportsConfidentialAssets;
    return typeof fn === "function" ? fn.call(walletCore) : false;
  };

  const confidentialGetBalances = async (tokens: string[]) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialGetBalances(tokens);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialIsRegistered = async (input: { token: string }) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialIsRegistered(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialGetEncryptionKey = async (input: { token: string }) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialGetEncryptionKey(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialGetGlobalAuditor = async () => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialGetGlobalAuditor();
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialGetAuditor = async (input: { token: string }) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialGetAuditor(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialTransfer = async (input: ConfidentialTransferInput) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialTransfer(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialRegister = async (input: { token: string } & ConfidentialWriteOptions) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialRegister(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialDeposit = async (
    input: { token: string; amount: string } & ConfidentialWriteOptions,
  ) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialDeposit(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialWithdraw = async (
    input: { token: string; amount: string } & ConfidentialWriteOptions,
  ) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialWithdraw(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialRolloverPending = async (
    input: { token: string } & ConfidentialWriteOptions,
  ) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialRolloverPending(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialPublishVaultEnvelopeKey = async () => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialPublishVaultEnvelopeKey();
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialSealVaultDk = async (input: {
    multisigAddress: string;
    recipients: VaultEnvelopeRecipient[];
  }) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialSealVaultDk(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  const confidentialOpenVaultDk = async (input: {
    multisigAddress: string;
    envelopeHex: string;
  }) => {
    if (!walletCore) throw new Error("WalletCore is not initialized");
    try {
      return await walletCore.confidentialOpenVaultDk(input);
    } catch (error: any) {
      if (onError) onError(error);
      return Promise.reject(error);
    }
  };

  // Handle the adapter's connect event
  const handleConnect = (): void => {
    setState((state) => {
      return {
        ...state,
        connected: true,
        account: walletCore?.account || null,
        network: walletCore?.network || null,
        wallet: walletCore?.wallet || null,
      };
    });
  };

  // Handle the adapter's account change event
  const handleAccountChange = useCallback((): void => {
    if (!connected) return;
    if (!walletCore?.wallet) return;
    setState((state) => {
      return {
        ...state,
        account: walletCore?.account || null,
      };
    });
  }, [connected]);

  // Handle the adapter's network event
  const handleNetworkChange = useCallback((): void => {
    if (!connected) return;
    if (!walletCore?.wallet) return;
    setState((state) => {
      return {
        ...state,
        network: walletCore?.network || null,
      };
    });
  }, [connected]);

  useEffect(() => {
    if (connected) {
      walletCore?.onAccountChange();
      walletCore?.onNetworkChange();
    }
  }, [connected]);

  // Handle the adapter's disconnect event
  const handleDisconnect = (): void => {
    if (!connected) return;
    setState((state) => {
      return {
        ...state,
        connected: false,
        account: walletCore?.account || null,
        network: walletCore?.network || null,
        wallet: null,
      };
    });
  };

  const handleStandardWalletsAdded = (standardWallet: AdapterWallet): void => {
    // Manage current wallet state by removing optional duplications
    // as new wallets are coming
    const existingWalletIndex = wallets.findIndex(
      (wallet) => wallet.name == standardWallet.name,
    );
    if (existingWalletIndex !== -1) {
      // If wallet exists, replace it with the new wallet
      setWallets((wallets) => [
        ...wallets.slice(0, existingWalletIndex),
        standardWallet,
        ...wallets.slice(existingWalletIndex + 1),
      ]);
    } else {
      // If wallet doesn't exist, add it to the array
      setWallets((wallets) => [...wallets, standardWallet]);
    }
  };

  const handleStandardNotDetectedWalletsAdded = (
    notDetectedWallet: AdapterNotDetectedWallet,
  ): void => {
    // Manage current wallet state by removing optional duplications
    // as new wallets are coming
    const existingWalletIndex = wallets.findIndex(
      (wallet) => wallet.name == notDetectedWallet.name,
    );
    if (existingWalletIndex !== -1) {
      // If wallet exists, replace it with the new wallet
      setNotDetectedWallets((wallets) => [
        ...wallets.slice(0, existingWalletIndex),
        notDetectedWallet,
        ...wallets.slice(existingWalletIndex + 1),
      ]);
    } else {
      // If wallet doesn't exist, add it to the array
      setNotDetectedWallets((wallets) => [...wallets, notDetectedWallet]);
    }
  };

  useEffect(() => {
    walletCore?.on("connect", handleConnect);
    walletCore?.on("accountChange", handleAccountChange);
    walletCore?.on("networkChange", handleNetworkChange);
    walletCore?.on("disconnect", handleDisconnect);
    walletCore?.on("standardWalletsAdded", handleStandardWalletsAdded);
    walletCore?.on(
      "standardNotDetectedWalletAdded",
      handleStandardNotDetectedWalletsAdded,
    );
    return () => {
      walletCore?.off("connect", handleConnect);
      walletCore?.off("accountChange", handleAccountChange);
      walletCore?.off("networkChange", handleNetworkChange);
      walletCore?.off("disconnect", handleDisconnect);
      walletCore?.off("standardWalletsAdded", handleStandardWalletsAdded);
      walletCore?.off(
        "standardNotDetectedWalletAdded",
        handleStandardNotDetectedWalletsAdded,
      );
    };
  }, [wallets, account]);

  return (
    <WalletContext.Provider
      value={{
        connect,
        signIn,
        disconnect,
        signAndSubmitTransaction,
        signTransaction,
        signMessage,
        signMessageAndVerify,
        changeNetwork,
        submitTransaction,
        refetchMnsName,
        supportsConfidentialAssets,
        confidentialGetBalances,
        confidentialIsRegistered,
        confidentialGetEncryptionKey,
        confidentialGetGlobalAuditor,
        confidentialGetAuditor,
        confidentialTransfer,
        confidentialRegister,
        confidentialDeposit,
        confidentialWithdraw,
        confidentialRolloverPending,
        confidentialPublishVaultEnvelopeKey,
        confidentialSealVaultDk,
        confidentialOpenVaultDk,
        account,
        network,
        connected,
        wallet,
        wallets,
        notDetectedWallets,
        isLoading,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
