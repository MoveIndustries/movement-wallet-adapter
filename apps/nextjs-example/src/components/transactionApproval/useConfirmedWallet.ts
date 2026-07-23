"use client";

import { createElement, useCallback } from "react";
import { Fingerprint } from "lucide-react";
import { useWallet } from "@moveindustries/wallet-adapter-react";
import { movementClient } from "@/utils";
import { useTransactionApproval } from "./TransactionApprovalProvider";
import { runSimulation } from "./simulate";
import type { TransactionApprovalKind } from "./TransactionApprovalModal";

const REJECTED = "User rejected the transaction";

/**
 * Whether the connected wallet is a Movement passkey wallet. Passkey signing
 * produces a single biometric prompt with no transaction detail, so it's the
 * one adapter that needs an app-rendered approval screen — extension wallets
 * (Petra/Nightly/…) show their own confirmation popup. Match on the adapter's
 * stable id, falling back to the display name.
 */
function isPasskeyWallet(wallet: { name?: string; id?: string } | null): boolean {
  if (!wallet) return false;
  const id = (wallet as { id?: string }).id;
  if (id?.startsWith("movement-passkey")) return true;
  return /passkey/i.test(wallet.name ?? "");
}

/**
 * Drop-in replacement for `useWallet()` that shows a transaction-approval modal
 * before signing — but only for passkey wallets. Every other field is passed
 * through unchanged, so callers just swap the import.
 */
export function useConfirmedWallet() {
  const wallet = useWallet();
  const { request } = useTransactionApproval();

  const passkey = isPasskeyWallet(wallet.wallet);
  const walletName = wallet.wallet?.name;
  const account = wallet.account;
  const network = wallet.network;
  const address = account?.address?.toString();

  const buildMeta = useCallback(
    (kind: TransactionApprovalKind, input: unknown) => ({
      walletName,
      address,
      icon: createElement(Fingerprint, { size: 28, strokeWidth: 2 }),
      simulate: account
        ? () =>
            runSimulation({
              client: movementClient(network),
              sender: address!,
              kind,
              input,
            })
        : undefined,
    }),
    [walletName, address, account, network],
  );

  const signAndSubmitTransaction = useCallback(
    async (...args: Parameters<typeof wallet.signAndSubmitTransaction>) => {
      if (passkey) {
        const approved = await request(
          "sign-and-submit",
          args[0],
          buildMeta("sign-and-submit", args[0]),
        );
        if (!approved) throw new Error(REJECTED);
      }
      return wallet.signAndSubmitTransaction(...args);
    },
    [wallet, passkey, request, buildMeta],
  ) as typeof wallet.signAndSubmitTransaction;

  const signTransaction = useCallback(
    async (...args: Parameters<typeof wallet.signTransaction>) => {
      if (passkey) {
        const approved = await request(
          "sign",
          args[0],
          buildMeta("sign", args[0]),
        );
        if (!approved) throw new Error(REJECTED);
      }
      return wallet.signTransaction(...args);
    },
    [wallet, passkey, request, buildMeta],
  ) as typeof wallet.signTransaction;

  return { ...wallet, signAndSubmitTransaction, signTransaction };
}
