import { MOTION_ICON_DATA_URI } from './icon'

/**
 * A mobile wallet reachable by deeplink.
 *
 * Wallets are data rather than code because the transport is not wallet
 * specific — the same request/response shape serves any wallet that speaks it.
 * Only `transport: 'motion'` is defined today; see the note on `signTransaction`
 * below for why a second entry needs a decision, not just a row.
 */
export interface DeeplinkWallet {
  /** Stable adapter id, in the style of `movement-keyless` / `movement-passkey`. */
  id: string
  name: string
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`
  url: string
  /**
   * Where requests are sent. Defaults to the https entry point, which the OS
   * routes to the app when installed and to a web page when it is not — the
   * whole reason the API is reachable over https rather than only a custom
   * scheme. Override with `movement://dapp/v1/` to test before the site's
   * `.well-known` files carry the path, or on a simulator.
   */
  baseUrl: string
  /**
   * The native protocol. A second dialect exists for cross-wallet
   * compatibility, but it has no sign-without-submit method, and
   * `movement:signTransaction` is required for a wallet to register at all —
   * so a wallet speaking only that dialect cannot be added as a row here
   * without also deciding what its `signTransaction` should do.
   */
  transport: 'motion'
}

export const MOTION_WALLET: DeeplinkWallet = {
  id: 'movement-mobile-deeplink',
  name: 'Motion Wallet',
  icon: MOTION_ICON_DATA_URI,
  url: 'https://motion.movementnetwork.xyz',
  baseUrl: 'https://motion.movementnetwork.xyz/dapp/v1/',
  transport: 'motion',
}

export const DEFAULT_WALLETS: DeeplinkWallet[] = [MOTION_WALLET]

/**
 * Whether a deeplink can go anywhere from here.
 *
 * This detects a phone, not a wallet: there is no way to tell from a web page
 * whether a native app is installed, and every timeout-based guess is wrong
 * often enough to be worse than useless. The install question is answered by
 * the OS at tap time — it either opens the app or loads the fallback page.
 */
export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPod/i.test(ua)) return true
  // iPadOS reports as a Mac; the touch points are what give it away.
  return /Macintosh/i.test(ua) && typeof document !== 'undefined' && navigator.maxTouchPoints > 1
}

/**
 * True inside the wallet's own in-app browser, where its injected provider has
 * already registered a wallet.
 *
 * Registering here too would put two entries with the same name in the connect
 * modal, and the modal's name-based dedupe would pick between them arbitrarily
 * — quite possibly ours, which would send the user out of the browser they are
 * already inside.
 */
export function isInjectedProviderPresent(): boolean {
  if (typeof window === 'undefined') return false
  return (window as { __motionWalletInjected?: boolean }).__motionWalletInjected === true
}
