import { registerWallet } from '@wallet-standard/core'
import { KeylessWalletAdapter } from './adapter'
import type { KeylessAdapterConfig } from './types'

export { KeylessWalletAdapter }
export type { KeylessAdapterConfig }

let registered: KeylessWalletAdapter | null = null

/**
 * Register the keyless wallet with the global @wallet-standard registry so
 * @moveindustries/wallet-adapter-react picks it up via getMovementWallets().
 *
 * Idempotent — calling more than once returns the existing adapter and
 * applies the new config via setConfig() (which auto-disconnects if the
 * prover URL changed).
 */
export function registerKeylessWallet(config: KeylessAdapterConfig): KeylessWalletAdapter {
  if (registered) {
    registered.setConfig(config)
    return registered
  }
  registered = new KeylessWalletAdapter(config)
  registerWallet(registered as never)
  return registered
}
