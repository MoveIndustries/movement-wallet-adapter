export type PasskeyMode = 'create' | 'signin'

/** Steps emitted via `onRecoveryStep` so apps can render progress UI. */
export type PasskeyRecoveryStep =
  /** First call to navigator.credentials.get() — OS picker about to show. */
  | 'authenticating-1'
  /** First sig captured; second call to navigator.credentials.get() about to fire. */
  | 'authenticating-2'
  /** Both signatures captured, public key recovered, address derived. */
  | 'complete'

export interface PasskeyAdapterConfig {
  /**
   * Controls which entry the adapter exposes in the connect modal:
   *   - `'create'`: registers a new passkey via `navigator.credentials.create()`.
   *   - `'signin'`: shows the OS picker for any existing passkey at this rpId
   *      and recovers the public key via dual-signature ECDSA point recovery.
   *
   * Both modes write to the same localStorage slot — once connected via
   * either, subsequent visits load the cached credential without prompting.
   */
  mode: PasskeyMode

  /**
   * WebAuthn relying party identifier. Must match the deploy domain
   * (or be a registrable suffix of it). Pass `undefined` to auto-detect
   * from `window.location.hostname` — recommended for dev where you
   * want `localhost` to match.
   *
   * The rpId is permanent for any passkey created with it — changing
   * it invalidates existing passkeys (they'll only show under the
   * domain they were created on).
   */
  rpId?: string

  /** Display name shown in the OS passkey picker during creation. */
  rpName?: string

  /**
   * Optional callback fired during the `'signin'` mode recovery flow so
   * the host app can show progress UI (toast, modal, etc.). Not invoked
   * for `'create'` mode (single biometric prompt — no recovery needed).
   *
   * The adapter doesn't depend on this — it's purely informational.
   */
  onRecoveryStep?: (step: PasskeyRecoveryStep) => void

  /** Currently 'testnet' only. */
  network: 'testnet'
}
