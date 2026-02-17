"use client";

import { MovementWalletAdapterProvider } from "@moveindustries/wallet-adapter-react";
import { setupAutomaticEthereumWalletDerivation } from "@moveindustries/derived-wallet-ethereum";
import { setupAutomaticSolanaWalletDerivation } from "@moveindustries/derived-wallet-solana";
import { PropsWithChildren } from "react";
import { Network } from "@moveindustries/ts-sdk";
import { useAutoConnect } from "./AutoConnectProvider";
import { useToast } from "./ui/use-toast";

setupAutomaticEthereumWalletDerivation({ defaultNetwork: Network.TESTNET });
setupAutomaticSolanaWalletDerivation({ defaultNetwork: Network.TESTNET });

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const { autoConnect } = useAutoConnect();
  const { toast } = useToast();

  return (
    <MovementWalletAdapterProvider
      autoConnect={autoConnect}
      dappConfig={{
        network: Network.TESTNET,
        movementApiKeys: {
          testnet: process.env.NEXT_PUBLIC_MOVEMENT_API_KEY_TESNET,
          devnet: process.env.NEXT_PUBLIC_MOVEMENT_API_KEY_DEVNET,
        },
        crossChainWallets: true,
      }}
      onError={(error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error || "Unknown wallet error",
        });
      }}
    >
      {children}
    </MovementWalletAdapterProvider>
  );
};
