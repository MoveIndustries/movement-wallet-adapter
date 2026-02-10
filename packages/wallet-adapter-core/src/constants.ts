export enum WalletReadyState {
  /**
   * Wallet can only be in one of two states - installed or not installed
   * Installed: wallets are detected by the browser event listeners and means they are installed on the user's browser.
   * NotDetected: wallets are not detected by the browser event listeners and means they are not installed on the user's browser.
   */
  Installed = "Installed",
  NotDetected = "NotDetected",
}

export enum NetworkName {
  Mainnet = "mainnet",
  Testnet = "testnet",
  Devnet = "devnet",
}

export const ChainIdToMnsSupportedNetworkMap: Record<string, string> = {
  "126": "mainnet", // Movement mainnet
  "250": "testnet", // Movement testnet
};

// TODO: Re-enable when Movement supports social sign-in (Petra Web / Movement Connect)
// These stub constants are kept for backwards compatibility - they point to disabled/placeholder URLs
/** @deprecated Social sign-in disabled */
export const MOVEMENT_CONNECT_BASE_URL = "";
/** @deprecated Social sign-in disabled */
export const PETRA_WEB_BASE_URL = "";
/** @deprecated Social sign-in disabled */
export const MOVEMENT_CONNECT_ACCOUNT_URL = "";
/** @deprecated Social sign-in disabled */
export const PETRA_WEB_ACCOUNT_URL = "";
