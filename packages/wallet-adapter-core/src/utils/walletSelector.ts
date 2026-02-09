import { WalletInfo } from "./types";
import { AdapterNotDetectedWallet, AdapterWallet } from "../WalletCore";
import {
  // TODO: Re-enable when Movement supports social sign-in
  // MOVEMENT_CONNECT_BASE_URL,
  // PETRA_WEB_BASE_URL,
  WalletReadyState,
} from "../constants";
import { isRedirectable } from "./helpers";

/**
 * A function that will partition the provided wallets into two list — `defaultWallets` and `moreWallets`.
 * By default, the wallets will be partitioned by whether or not they are installed or loadable.
 * You can pass your own partition function if you wish to customize this behavior.
 */
export function partitionWallets(
  wallets: ReadonlyArray<AdapterWallet | AdapterNotDetectedWallet>,
  partitionFunction: (
    wallet: AdapterWallet | AdapterNotDetectedWallet,
  ) => boolean = isInstalledOrLoadable,
) {
  const defaultWallets: Array<AdapterWallet> = [];
  const moreWallets: Array<AdapterNotDetectedWallet> = [];

  for (const wallet of wallets) {
    if (partitionFunction(wallet)) defaultWallets.push(wallet as AdapterWallet);
    else moreWallets.push(wallet as AdapterNotDetectedWallet);
  }

  return { defaultWallets, moreWallets };
}

/** Returns true if the wallet is installed or loadable. */
export function isInstalledOrLoadable(
  wallet: AdapterWallet | AdapterNotDetectedWallet,
) {
  return wallet.readyState === WalletReadyState.Installed;
}

/**
 * Returns true if the user is on desktop and the provided wallet requires installation of a browser extension.
 * This can be used to decide whether to show a "Connect" button or "Install" link in the UI.
 */
export function isInstallRequired(
  wallet: AdapterWallet | AdapterNotDetectedWallet,
) {
  const isWalletReady = isInstalledOrLoadable(wallet);
  const isMobile = !isWalletReady && isRedirectable();

  return !isMobile && !isWalletReady;
}

/** Truncates the provided wallet address at the middle with an ellipsis. */
export function truncateAddress(address: string | undefined) {
  if (!address) return;
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

// TODO: Re-enable when Movement supports social sign-in (Petra Web / Movement Connect)
// These stub functions are kept for backwards compatibility with UI packages
/**
 * @deprecated Social sign-in disabled - always returns false
 */
export function isMovementConnectWallet(wallet: WalletInfo | AdapterWallet) {
  return false;
}

/**
 * @deprecated Social sign-in disabled - always returns false
 */
export function isPetraWebWallet(wallet: WalletInfo | AdapterWallet) {
  return false;
}

// /**
//  * Partitions the `wallets` array so that Movement Connect wallets are grouped separately from the rest.
//  * Petra Web is a web wallet that uses social login to create accounts on the blockchain.
//  *
//  * @deprecated Use {@link getPetraWebWallets} instead.
//  */
// export function getMovementConnectWallets(
//   wallets: ReadonlyArray<AdapterWallet | AdapterNotDetectedWallet>,
// ) {
//   const { defaultWallets, moreWallets } = partitionWallets(
//     wallets,
//     isMovementConnectWallet,
//   );
//   return { movementConnectWallets: defaultWallets, otherWallets: moreWallets };
// }

// /**
//  * Partitions the `wallets` array so that Petra Web wallets are grouped separately from the rest.
//  * Petra Web is a web wallet that uses social login to create accounts on the blockchain.
//  */
// export function getPetraWebWallets(
//   wallets: ReadonlyArray<AdapterWallet | AdapterNotDetectedWallet>,
// ) {
//   const { defaultWallets, moreWallets } = partitionWallets(
//     wallets,
//     isPetraWebWallet,
//   );
//   return { petraWebWallets: defaultWallets, otherWallets: moreWallets };
// }

export interface WalletSortingOptions {
  // TODO: Re-enable when Movement supports social sign-in
  // /**
  //  * An optional function for sorting Movement Connect wallets.
  //  *
  //  * @deprecated Use {@link sortPetraWebWallets} instead.
  //  */
  // sortMovementConnectWallets?: (a: AdapterWallet, b: AdapterWallet) => number;
  // /** An optional function for sorting Petra Web wallets. */
  // sortPetraWebWallets?: (a: AdapterWallet, b: AdapterWallet) => number;
  /** An optional function for sorting wallets that are currently installed or loadable. */
  sortAvailableWallets?: (
    a: AdapterWallet | AdapterNotDetectedWallet,
    b: AdapterWallet | AdapterNotDetectedWallet,
  ) => number;
  /** An optional function for sorting wallets that are NOT currently installed or loadable. */
  sortInstallableWallets?: (
    a: AdapterWallet | AdapterNotDetectedWallet,
    b: AdapterWallet | AdapterNotDetectedWallet,
  ) => number;
}

/**
 * Partitions the `wallets` array into groups:
 *
 * `availableWallets` - Wallets that are currently installed or loadable by the client.
 *
 * `installableWallets` - Wallets that are NOT current installed or loadable and
 * require the client to install a browser extension first.
 *
 * Additionally, these wallet groups can be sorted by passing sort functions via the `options` argument.
 */
export function groupAndSortWallets(
  wallets: ReadonlyArray<AdapterWallet | AdapterNotDetectedWallet>,
  options?: WalletSortingOptions,
) {
  const { defaultWallets, moreWallets } = partitionWallets(wallets);

  if (options?.sortAvailableWallets) {
    defaultWallets.sort(options.sortAvailableWallets);
  }
  if (options?.sortInstallableWallets) {
    moreWallets.sort(options.sortInstallableWallets);
  }

  return {
    // TODO: Re-enable when Movement supports social sign-in
    // These are kept as empty arrays for backwards compatibility with UI packages
    /** @deprecated Social sign-in disabled - always returns empty array */
    movementConnectWallets: [] as AdapterWallet[],
    /** @deprecated Social sign-in disabled - always returns empty array */
    petraWebWallets: [] as AdapterWallet[],
    /** Wallets that are currently installed or loadable. */
    availableWallets: defaultWallets,
    /** Wallets that are NOT currently installed or loadable. */
    installableWallets: moreWallets,
  };
}
