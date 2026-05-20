import { registerWallet } from '@wallet-standard/core'
import { PasskeyWalletAdapter } from './adapter'
import type { PasskeyAdapterConfig } from './types'

export { PasskeyWalletAdapter }
export type { PasskeyAdapterConfig, PasskeyMode, PasskeyRecoveryStep } from './types'
export type { PasskeyCredential } from './core'

interface RegisteredAdapters {
  create: PasskeyWalletAdapter
  signin: PasskeyWalletAdapter
}

let registered: RegisteredAdapters | null = null

/**
 * Register both passkey wallet entries with the global @wallet-standard
 * registry so they appear as two distinct entries in the connect modal:
 *
 *   - "Create new passkey"        → registers a fresh passkey on first connect
 *   - "Sign in with existing passkey" → recovers an existing passkey via
 *      dual-signature ECDSA point recovery
 *
 * Both write to the same localStorage slot — once connected via either,
 * subsequent visits skip both prompts and load the cached credential.
 *
 * Idempotent: calling more than once returns the existing pair unchanged.
 * `rpId` is baked into existing passkeys at creation time, so we don't
 * try to apply config changes after the first call.
 */
export function registerPasskeyWallets(
  shared: Omit<PasskeyAdapterConfig, 'mode'> = { network: 'testnet' },
): RegisteredAdapters {
  if (registered) return registered

  const create = new PasskeyWalletAdapter({ ...shared, mode: 'create' })
  const signin = new PasskeyWalletAdapter({ ...shared, mode: 'signin' })

  registerWallet(create as never)
  registerWallet(signin as never)

  registered = { create, signin }
  return registered
}

/**
 * @deprecated Use `registerPasskeyWallets()` which registers both the
 * "Create new passkey" and "Sign in with existing passkey" entries. This
 * single-mode helper defaults to `'create'` for backwards compatibility.
 */
export function registerPasskeyWallet(
  config: Partial<PasskeyAdapterConfig> & { network: 'testnet' } = { network: 'testnet' },
): PasskeyWalletAdapter {
  const both = registerPasskeyWallets({ ...config })
  return config.mode === 'signin' ? both.signin : both.create
}
