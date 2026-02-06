"use client";

import { MovementWalletAdapterProvider } from "@moveindustries/wallet-adapter-react";
import { PropsWithChildren } from "react";

export const WalletProvider = ({ children }: PropsWithChildren) => {
  return (
    <MovementWalletAdapterProvider
      autoConnect={true}
      onError={(error) => {
        console.error("Wallet error:", error);
      }}
      optInWallets={[]}
    >
      {children}
    </MovementWalletAdapterProvider>
  );
};
