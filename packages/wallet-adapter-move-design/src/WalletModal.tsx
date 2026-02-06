"use client";

import {
  type AdapterWallet,
  type AdapterNotDetectedWallet,
  WalletItem,
  type WalletSortingOptions,
  groupAndSortWallets,
  isInstallRequired,
  useWallet,
  WalletReadyState,
} from "@moveindustries/wallet-adapter-react";

import { useMemo, useState, useEffect } from "react";
import { OKXWallet } from "@okwallet/aptos-wallet-adapter";
import { MSafeWalletAdapter } from "@msafe/aptos-wallet-adapter";
import { useIsMobile } from "./useIsMobile";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "./Drawer";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { cn } from "./utils";
import { CloseIcon, CaretDownIcon, NightlyIcon, DownloadText } from "./icons";

const nightlyWallet: AdapterNotDetectedWallet = {
  name: "Nightly Wallet",
  url: "https://nightly.app/download",
  icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI5IiBoZWlnaHQ9IjEyOSIgdmlld0JveD0iMCAwIDEyOSAxMjkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xMTMuMzgxIDAuMjVDMTA0LjAwOCAxMy4zMjI1IDkyLjI4NzQgMjIuMzg0NyA3OC40MTcyIDI4LjQ1NTZDNzMuNjA5MiAyNy4xNDg0IDY4LjY2ODIgMjYuNDM5NCA2My44MTU5IDI2LjQ4MzdDNTguOTYzNSAyNi40Mzk0IDU0LjAyMjUgMjcuMTI2MiA0OS4yMTQ1IDI4LjQ1NTZDMzUuMzY2NSAyMi4zODQ3IDIzLjYyMzQgMTMuMzIyNSAxNC4yNTEgMC4yNUMxMS40MTUgNy4zNjIzNCAwLjUxMzc5NiAzMS45MzQzIDEzLjYwODUgNjYuMjU1MkMxMy42MDg1IDY2LjI1NTIgOS40MjA4NCA4NC4xODAxIDE3LjEwOTMgOTkuNTc5MUMxNy4xMDkzIDk5LjU3OTEgMjguMjU0MSA5NC41NDk1IDM3LjA3MjYgMTAxLjYxN0M0Ni4zMTIgMTA5LjEyOSA0My4zNjUxIDExNi4zMyA0OS44NzkyIDEyMi41MzRDNTUuNDYyNyAxMjguMjUgNjMuODE1OSAxMjguMjUgNjMuODE1OSAxMjguMjVDNjMuODE1OSAxMjguMjUgNzIuMTY5IDEyOC4yNSA3Ny43NTI1IDEyMi41MzRDODQuMjY2NiAxMTYuMzMgODEuMzQxOSAxMDkuMTI5IDkwLjU1OTIgMTAxLjYxN0M5OS4zNzc2IDk0LjUyNzMgMTEwLjUyMiA5OS41NzkxIDExMC41MjIgOTkuNTc5MUMxMTguMjExIDg0LjE4MDEgMTE0LjAyMyA2Ni4yNTUyIDExNC4wMjMgNjYuMjU1MkMxMjcuMTE4IDMxLjkzNDMgMTE2LjIxNyA3LjM2MjM0IDExMy4zODEgMC4yNVpNMjAuNTY1NyA2MS40OTE1QzEzLjQ1MzQgNDYuODkwMSAxMS40ODE0IDI2LjgzODIgMTYuMDAxNCAxMC45OTYxQzIxLjkzOTUgMjYuMDE4NCAzMC4wMDQ1IDMyLjc3NjIgMzkuNjIwNiAzOS44ODg2QzM1LjUyMTYgNDguMzUyNSAyNy44Nzc1IDU2LjMyODkgMjAuNTY1NyA2MS40OTE1Wk00MS4wMzg2IDg3LjIxNTZDMzUuNDU1MSA4NC43MzQgMzQuMjM2NSA3OS44MzczIDM0LjIzNjUgNzkuODM3M0M0MS44ODA2IDc1LjAyOTMgNTMuMTE0MSA3OC43MDczIDUzLjQ2ODYgOTAuMDk1OUM0Ny41NTI3IDg2LjUyODcgNDUuNjAyOSA4OS4yMzE4IDQxLjAzODYgODcuMjE1NlpNNjMuODE1OSAxMjcuNjA3QzU5LjgwNTUgMTI3LjYwNyA1Ni41NDg0IDEyNC43NDkgNTYuNTQ4NCAxMjEuMjA0QzU2LjU0ODQgMTE3LjY1OSA1OS44MDU1IDExNC44MDEgNjMuODE1OSAxMTQuODAxQzY3LjgyNjMgMTE0LjgwMSA3MS4wODMzIDExNy42NTkgNzEuMDgzMyAxMjEuMjA0QzcxLjA4MzMgMTI0Ljc0OSA2Ny44MjYzIDEyNy42MDcgNjMuODE1OSAxMjcuNjA3Wk04Ni41OTMxIDg3LjIxNTZDODIuMDI4OCA4OS4yMDk3IDgwLjA3OSA4Ni41MDY1IDc0LjE2MzEgOTAuMDk1OUM3NC41MTc2IDc4LjcwNzMgODUuNzUxMSA3NS4wMjkzIDkzLjM5NTIgNzkuODM3M0M5My4zOTUyIDc5Ljg1OTUgOTIuMTk4OCA4NC43NTYxIDg2LjU5MzEgODcuMjE1NlpNMTA3LjA2NiA2MS40OTE1Qzk5Ljc1NDIgNTYuMzI4OSA5Mi4xMTAxIDQ4LjM1MjUgODguMDMzMyAzOS44ODg2Qzk3LjY0OTQgMzIuNzc2MiAxMDUuNzE0IDI2LjAxODQgMTExLjY1MiAxMC45OTYxQzExNi4xNSAyNi44NjA0IDExNC4xNzggNDYuOTEyMyAxMDcuMDY2IDYxLjQ5MTVaIiBmaWxsPSIjNjA2N0Y5Ii8+Cjwvc3ZnPgo=",
  readyState: WalletReadyState.NotDetected,
};

const cleanWalletName = (name: string) => name.replace(/ Wallet$/i, "");

export interface ConnectWalletDialogProps extends WalletSortingOptions {
  onClose: () => void;
}

function cleanWalletList(
  wallets: (AdapterWallet | AdapterNotDetectedWallet)[],
) {
  const unsupportedWallets = [
    "Dev T wallet",
    "Pontem Wallet",
    "Trust",
    "Tokenpocket",
    "Martian",
    "Rise",
    "Petra",
  ];
  return wallets
    .filter(
      (wallet, index, self) =>
        self.findIndex((w) => w.name === wallet.name) === index,
    )
    .filter((wallet) => {
      if (!wallet) return false;
      if (unsupportedWallets.includes(wallet.name)) return false;
      return wallet;
    });
}

interface ConnectWalletContentProps extends WalletSortingOptions {
  onClose: () => void;
  showCloseButton?: boolean;
}

function ConnectWalletContent({
  onClose,
  showCloseButton = true,
  ...walletSortingOptions
}: ConnectWalletContentProps) {
  const { wallets } = useWallet();
  const [isMoreWalletsOpen, setIsMoreWalletsOpen] = useState(false);
  const isMobile = useIsMobile();
  const { availableWallets, installableWallets } = useMemo(() => {
    const grouped = groupAndSortWallets(wallets, walletSortingOptions);

    const additionalInstallableWallets: (
      | AdapterWallet
      | AdapterNotDetectedWallet
    )[] = [];

    const hasNightly = [
      ...(grouped?.availableWallets ?? []),
      ...(grouped?.installableWallets ?? []),
    ].some((w) => w.name.toLowerCase().includes("nightly"));
    if (!hasNightly) {
      additionalInstallableWallets.push(nightlyWallet);
    }

    const hasOKX = [
      ...(grouped?.availableWallets ?? []),
      ...(grouped?.installableWallets ?? []),
    ].some((w) => w.name.toLowerCase().includes("okx"));
    if (!hasOKX) {
      additionalInstallableWallets.push(
        new OKXWallet() as AdapterNotDetectedWallet,
      );
    }

    const hasMSafe = [
      ...(grouped?.availableWallets ?? []),
      ...(grouped?.installableWallets ?? []),
    ].some((w) => w.name.toLowerCase().includes("msafe"));
    if (!hasMSafe) {
      additionalInstallableWallets.push(
        new MSafeWalletAdapter(
          undefined,
          "MOVEMENT",
        ) as unknown as AdapterNotDetectedWallet,
      );
    }
    return {
      availableWallets: grouped?.availableWallets ?? [],
      installableWallets: [
        ...(grouped?.installableWallets ?? []),
        ...additionalInstallableWallets,
      ],
    };
  }, [wallets, walletSortingOptions]);

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-6 px-6 pt-12 pb-6 md:max-w-114",
        "z-9999 mx-auto max-h-full overflow-y-auto md:max-h-[80vh]",
        "bg-[linear-gradient(0deg,rgba(4,5,27,0.2),rgba(4,5,27,0.2)),linear-gradient(152.97deg,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0)_100%),radial-gradient(100%_100%_at_120.34%_112.85%,rgba(129,255,186,0.4)_0%,rgba(0,27,133,0.4)_100%)]",
        "backdrop-blur-[1.3125rem]",
      )}
    >
      {showCloseButton && !isMobile && (
        <button
          onClick={onClose}
          className={cn(
            "absolute top-6 right-6 z-9999 rounded-sm opacity-70",
            "cursor-pointer border border-white/20 bg-white/10 p-2 text-white",
            "transition-opacity hover:bg-white/20 hover:opacity-100",
            "focus:outline-none",
          )}
        >
          <CloseIcon size={16} />
        </button>
      )}

      <div className="flex w-full max-w-102 flex-col items-center gap-4 p-0">
        <div className="w-full max-w-76 text-center font-['TWK_Everett_Mono',monospace] text-[32px] leading-[120%] font-medium tracking-[-1.28px] text-white">
          Connect Wallet
        </div>
        <div className="w-full max-w-sm text-center font-['Neue_Haas_Unica_Pro',sans-serif] text-lg leading-[140%] font-normal text-white/48">
          Securely connect your{" "}
          <a
            className="cursor-pointer text-white/48 underline decoration-dotted hover:text-white"
            href="https://docs.movementnetwork.xyz/general/usingmovement/connect_to_movement"
            target="_blank"
            rel="noopener noreferrer"
          >
            wallet
          </a>{" "}
          to transfer digital assets to and from the Movement network.
        </div>
      </div>

      <div className="flex max-h-168 w-full max-w-102 flex-row flex-wrap content-center items-start justify-center gap-4 overflow-y-auto p-4 py-4">
        {availableWallets.length > 0 ? (
          cleanWalletList(availableWallets).map((wallet) => (
            <div key={wallet.name} className="w-28 shrink-0">
              <IconWalletCard wallet={wallet} onConnect={onClose} />
            </div>
          ))
        ) : (
          <>
            <div className="h-px w-92 bg-[rgba(255,255,255,0.48)]" />
            <span className="font-['TWK_Everett_Mono',monospace] text-lg leading-[21.60px] font-medium text-primary">
              Don&apos;t have a wallet?
            </span>
            <button
              className={cn(
                "h-10 w-full rounded-full bg-accent px-4 py-1 [&_path]:fill-white",
                "inline-flex cursor-pointer items-center justify-center gap-2 border-none",
                "transition-all duration-200 ease-[ease]",
                "hover:bg-background hover:text-foreground [&:hover_path]:fill-foreground",
              )}
              onClick={() => window.open(nightlyWallet.url, "_blank")}
            >
              <DownloadText />
              <NightlyIcon size={30} fill="white" />
            </button>
          </>
        )}

        {!!installableWallets.length && (
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => setIsMoreWalletsOpen(!isMoreWalletsOpen)}
              className={cn(
                "inline-flex items-center justify-center gap-2 self-center text-white",
                "rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200",
                "cursor-pointer border-none bg-transparent",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                "h-9 px-3 hover:bg-white/20",
              )}
            >
              Other wallets
              <CaretDownIcon
                size={16}
                className={cn(
                  "transition-transform duration-200",
                  isMoreWalletsOpen ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
            {isMoreWalletsOpen && (
              <div className="animate-in fade-in duration-200">
                <div className="flex w-full flex-wrap items-start justify-center gap-4 pt-2">
                  {cleanWalletList(installableWallets).map((wallet) => (
                    <div
                      onClick={() => window.open(wallet.url, "_blank")}
                      key={wallet.name}
                      className="w-28 shrink-0 cursor-pointer"
                    >
                      <IconWalletCard wallet={wallet} onConnect={onClose} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function WalletModal({
  onClose,
  ...walletSortingOptions
}: ConnectWalletDialogProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof window === "undefined") {
    return null;
  }

  const contentProps = {
    onClose,
    ...walletSortingOptions,
  };

  return isMobile ? (
    <Drawer
      open={true}
      onOpenChange={(open: any) => !open && onClose()}
    >
      <DrawerContent className="z-9999">
        <DrawerTitle className="sr-only">Connect Wallet</DrawerTitle>
        <DrawerDescription className="sr-only">
          Securely connect your wallet to transfer digital assets to and from
          the Movement network.
        </DrawerDescription>
        <ConnectWalletContent {...contentProps} showCloseButton={false} />
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog
      open={true}
      onOpenChange={(open: any) => !open && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        className="border-0 bg-transparent p-0"
      >
        <DialogTitle className="sr-only">Connect Wallet</DialogTitle>
        <DialogDescription className="sr-only">
          Securely connect your wallet to transfer digital assets to and from
          the Movement network.
        </DialogDescription>
        <ConnectWalletContent {...contentProps} />
      </DialogContent>
    </Dialog>
  );
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect?: () => void;
}

const gridCard = (child: React.ReactNode) => (
  <div className="group/wallet relative h-28 w-28 cursor-pointer rounded-lg backdrop-blur-[1.3125rem] transition-shadow duration-200 ease-in-out hover:shadow-[0.25rem_0.25rem_0_hsl(var(--primary))]">
    <div className="absolute inset-0 rounded-lg bg-linear-to-br from-white/[0.096] to-transparent backdrop-blur-[1.3125rem] group-hover/wallet:from-white/40" />
    <div className="absolute top-1/2 left-1/2 flex h-20.5 w-20.5 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 p-0">
      {child}
    </div>
  </div>
);

function IconWalletCard({ wallet, onConnect }: WalletRowProps) {
  const installRequired = isInstallRequired(wallet);

  if (installRequired) {
    return (
      <WalletItem wallet={wallet} onConnect={onConnect}>
        <div className="cursor-default border-none bg-transparent p-0">
          {gridCard(
            <>
              <div className="h-14 w-14">
                <WalletItem.Icon className="h-full w-full" />
              </div>
              <div className="flex h-4.5 w-20.5 items-center justify-center text-center font-['TWK_Everett_Mono',monospace] text-lg leading-[100%] font-normal tracking-[-0.06em] text-white">
                {cleanWalletName(wallet.name)}
              </div>
              <div className="absolute top-[-1rem] left-1/2 z-9999 hidden h-5 w-28 -translate-x-1/2 items-center justify-center overflow-hidden rounded-t-lg bg-primary/80 group-hover/wallet:inline-flex">
                <span className="font-['TWK_Everett_Mono',monospace] text-xs leading-[14px] font-bold tracking-[0.40px] text-secondary uppercase">
                  INSTALL
                </span>
              </div>
            </>,
          )}
        </div>
      </WalletItem>
    );
  }

  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton asChild>
        <button className="relative cursor-pointer border-none bg-transparent p-0">
          {gridCard(
            <>
              <div className="h-14 w-14">
                <WalletItem.Icon className="h-full w-full" />
              </div>
              <div className="flex h-4.5 w-20.5 items-center justify-center text-center font-['TWK_Everett_Mono',monospace] text-lg leading-[100%] font-normal tracking-[-0.06em] text-white">
                {cleanWalletName(wallet.name)}
              </div>
            </>,
          )}
          <span className="pointer-events-none absolute bottom-[-0.5rem] left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-white/60 opacity-0 transition-opacity duration-200 ease-in-out hover:opacity-100">
            Click to connect
          </span>
        </button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}

function AptosConnectWalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton asChild>
        <button
          className={cn(
            "inline-flex w-full items-center justify-center gap-4 whitespace-nowrap",
            "rounded-md text-sm font-medium transition-colors",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
            "border-input bg-background hover:bg-accent hover:text-accent-foreground border",
            "h-11 px-2",
          )}
        >
          <WalletItem.Icon className="h-5 w-5" />
          <WalletItem.Name className="text-sm font-normal md:text-base" />
        </button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}
