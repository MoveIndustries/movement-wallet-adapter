"use client";

import { useWallet } from "@moveindustries/wallet-adapter-react";
import { WalletModal } from "@moveindustries/wallet-adapter-move-design";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Copy, LogOut, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function truncateAddress(address: string | undefined) {
  if (!address) return;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletSelector() {
  const { account, connected, disconnect } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const copyAddress = useCallback(async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address.toString());
      toast({
        title: "Copied",
        description: "Wallet address copied to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy wallet address",
      });
    }
  }, [account?.address, toast]);

  if (connected && account) {
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-mono">
            {truncateAddress(account?.address?.toString())}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </Button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50">
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground mb-1">
                Connected Address
              </p>
              <p className="text-sm font-mono text-foreground break-all">
                {account?.address?.toString()}
              </p>
            </div>

            <div className="p-1">
              <button
                onClick={() => {
                  copyAddress();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-muted-foreground" />
                Copy Address
              </button>

              <button
                onClick={() => {
                  disconnect();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>Connect Wallet</Button>

      {mounted && isModalOpen && (
        <WalletModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
