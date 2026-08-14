import { registerWallet } from '@moveindustries/wallet-standard'
import { DeeplinkWalletAdapter } from './adapter'
import {
  DEFAULT_WALLETS,
  isInjectedProviderPresent,
  isMobileBrowser,
  MOTION_WALLET,
  type DeeplinkWallet,
} from './wallets'

export { DeeplinkWalletAdapter } from './adapter'
export { DEFAULT_WALLETS, MOTION_WALLET, isMobileBrowser } from './wallets'
export type { DeeplinkWallet } from './wallets'
export type { ConnectData, Method } from './protocol'

let registered: DeeplinkWalletAdapter[] | null = null

export interface RegisterOptions {
  /** Defaults to the built-in table. */
  wallets?: DeeplinkWallet[]
  /**
   * Register even on desktop. Only useful for tests and Storybook: on a desktop
   * browser the deeplink has nowhere to go, and offering the wallet there just
   * produces a dead end.
   */
  force?: boolean
}

/**
 * Registers the mobile wallets, if this environment can reach one.
 *
 * Two guards, and neither is an attempt to detect a wallet — nothing about an
 * installed app is visible from a web page.
 *
 * The first is whether this is a phone at all. The second is whether we are
 * inside the wallet's own in-app browser, where its injected provider has
 * already registered: adding a second entry with the same name would leave the
 * connect modal picking between them arbitrarily, and picking ours would send
 * the user out of the browser they are already in.
 *
 * Returns the adapters that were registered, empty when the environment is not
 * one where deeplinks work.
 */
export function registerDeeplinkWallets(options: RegisterOptions = {}): DeeplinkWalletAdapter[] {
  if (registered) return registered
  if (!options.force && (!isMobileBrowser() || isInjectedProviderPresent())) return []

  const adapters = (options.wallets ?? DEFAULT_WALLETS).map((w) => new DeeplinkWalletAdapter(w))
  for (const adapter of adapters) {
    registerWallet(adapter as never)
    // The page receiving a wallet's answer is a fresh load of the page that
    // asked, so the response is sitting in the URL right now, before any app
    // code has had a chance to ask for it.
    adapter.consumeResponse()
  }

  registered = adapters
  return adapters
}
