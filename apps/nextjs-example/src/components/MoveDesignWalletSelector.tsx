"use client";

import { WalletModal } from "@moveindustries/wallet-adapter-move-design";
import { useWallet } from "@moveindustries/wallet-adapter-react";
import { useState } from "react";

export function MoveDesignWalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { connected, disconnect, account } = useWallet();

  if (connected) {
    return (
      <button
        onClick={disconnect}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
      >
        Disconnect
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        Connect Wallet
      </button>
      {isOpen && <WalletModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
