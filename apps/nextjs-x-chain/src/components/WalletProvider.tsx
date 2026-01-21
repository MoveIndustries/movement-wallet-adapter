"use client";

import { MovementWalletAdapterProvider } from "@movement-labs/wallet-adapter-react";
import { setupAutomaticEthereumWalletDerivation } from "@movement-labs/derived-wallet-ethereum";
import { setupAutomaticSolanaWalletDerivation } from "@movement-labs/derived-wallet-solana";
import { PropsWithChildren } from "react";
import { Network } from "@movement-labs/ts-sdk";
import { useClaimSecretKey } from "@/hooks/useClaimSecretKey";
import { useAutoConnect } from "./AutoConnectProvider";
import { useToast } from "./ui/use-toast";

setupAutomaticEthereumWalletDerivation({ defaultNetwork: Network.TESTNET });
setupAutomaticSolanaWalletDerivation({ defaultNetwork: Network.TESTNET });

let dappImageURI: string | undefined;
if (typeof window !== "undefined") {
  dappImageURI = `${window.location.origin}${window.location.pathname}favicon.ico`;
}

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const { autoConnect } = useAutoConnect();
  const { toast } = useToast();

  // Enables claim flow when the `claim` query param is detected
  const claimSecretKey = useClaimSecretKey();

  return (
    <MovementWalletAdapterProvider
      autoConnect={autoConnect}
      dappConfig={{
        network: Network.TESTNET,
        movementApiKeys: {
          testnet: process.env.NEXT_PUBLIC_MOVEMENT_API_KEY_TESNET,
          devnet: process.env.NEXT_PUBLIC_MOVEMENT_API_KEY_DEVNET,
        },
        movementConnect: {
          claimSecretKey,
          dappId: "57fa42a9-29c6-4f1e-939c-4eefa36d9ff5",
          dappImageURI,
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
