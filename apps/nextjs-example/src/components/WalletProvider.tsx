"use client";

import {
  MovementWalletAdapterProvider,
  DappConfig,
} from "@moveindustries/wallet-adapter-react";
import { setupAutomaticEthereumWalletDerivation } from "@moveindustries/derived-wallet-ethereum";
import { setupAutomaticSolanaWalletDerivation } from "@moveindustries/derived-wallet-solana";
import { PropsWithChildren } from "react";
import { Network } from "@moveindustries/ts-sdk";
// TODO: Re-enable when Movement supports social sign-in
// import { useClaimSecretKey } from "@/hooks/useClaimSecretKey";
import { useAutoConnect } from "./AutoConnectProvider";
import { useToast } from "./ui/use-toast";
import { myTransactionSubmitter } from "@/utils/transactionSubmitter";
import { useTransactionSubmitter } from "./TransactionSubmitterProvider";

const searchParams =
  typeof window !== "undefined"
    ? new URL(window.location.href).searchParams
    : undefined;
const deriveWalletsFrom = searchParams?.get("deriveWalletsFrom")?.split(",");
if (deriveWalletsFrom?.includes("ethereum")) {
  setupAutomaticEthereumWalletDerivation({ defaultNetwork: Network.TESTNET });
}
if (deriveWalletsFrom?.includes("solana")) {
  setupAutomaticSolanaWalletDerivation({ defaultNetwork: Network.TESTNET });
}

// TODO: Re-enable when Movement supports social sign-in
// let dappImageURI: string | undefined;
// if (typeof window !== "undefined") {
//   dappImageURI = `${window.location.origin}${window.location.pathname}favicon.ico`;
// }

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const { autoConnect } = useAutoConnect();
  const { toast } = useToast();
  const { useCustomSubmitter } = useTransactionSubmitter();

  const dappConfig: DappConfig = {
    network: Network.TESTNET,
    movementApiKeys: {
      testnet: process.env.NEXT_PUBLIC_MOVEMENT_API_KEY_TESNET,
      devnet: process.env.NEXT_PUBLIC_MOVEMENT_API_KEY_DEVNET,
    },
    // TODO: Re-enable when Movement supports social sign-in
    // movementConnect: {
    //   claimSecretKey,
    //   dappId: "57fa42a9-29c6-4f1e-939c-4eefa36d9ff5",
    //   dappImageURI,
    // },
    transactionSubmitter: useCustomSubmitter
      ? myTransactionSubmitter
      : undefined,
  };

  return (
    <MovementWalletAdapterProvider
      key={useCustomSubmitter ? "custom" : "default"}
      autoConnect={autoConnect}
      dappConfig={dappConfig}
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
