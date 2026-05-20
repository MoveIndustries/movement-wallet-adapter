import type {
  AccountInfo,
  MovementChangeNetworkFeature,
  MovementConnectFeature,
  MovementConnectOutput,
  MovementDisconnectFeature,
  MovementFeatures,
  MovementGetAccountFeature,
  MovementGetNetworkFeature,
  MovementOnAccountChangeFeature,
  MovementOnAccountChangeInput,
  MovementOnNetworkChangeFeature,
  MovementOnNetworkChangeInput,
  MovementSignAndSubmitTransactionFeature,
  MovementSignMessageFeature,
  MovementSignTransactionFeatureV1_1,
  MovementSignTransactionInputV1_1,
  MovementSignTransactionOutputV1_1,
  NetworkInfo,
  UserResponse,
} from '@moveindustries/wallet-standard'
import { MOVEMENT_TESTNET_CHAIN, UserResponseStatus } from '@moveindustries/wallet-standard'
import type {
  StandardEventsFeature,
  StandardEventsListeners,
  StandardEventsNames,
} from '@wallet-standard/core'
import { Hex, Movement, MovementConfig, Network } from '@moveindustries/ts-sdk'
import {
  clearCredential,
  loadCredential,
  registerPasskey,
  signInWithExistingPasskey,
  signTransactionWithPasskey,
  type PasskeyCredential,
} from './core'
import { PASSKEY_ICON_DATA_URI } from './icon'
import type { PasskeyAdapterConfig } from './types'

const TESTNET_INFO: NetworkInfo = {
  name: 'testnet' as unknown as NetworkInfo['name'],
  chainId: 177,
  url: 'https://testnet.movementnetwork.xyz/v1',
}

/**
 * Auto-detect the WebAuthn relying-party id from the current page. Returns
 * 'localhost' for localhost / 127.0.0.1, otherwise the bare hostname.
 *
 * Browsers require rpId to be a registrable suffix of the page's eTLD+1, so
 * this is the safe default for production deployments. For dev with a custom
 * domain, pass `rpId` explicitly via `PasskeyAdapterConfig`.
 */
function autoDetectRpId(): string {
  if (typeof window === 'undefined') return 'localhost'
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' ? 'localhost' : h
}

/**
 * Movement passkey wallet adapter — implements the Movement wallet standard
 * so WebAuthn (platform-authenticator) accounts plug into
 * @moveindustries/wallet-adapter-react the same way Petra / Motion / Nightly do.
 *
 * The adapter signs Movement transactions with a P-256 platform passkey via
 * AIP-66 (`WebAuthnSignature` + `Secp256r1PublicKey` under `AnyPublicKey`).
 * Users of this package never call `navigator.credentials.*` directly.
 */
export class PasskeyWalletAdapter {
  readonly id: string
  readonly name: string
  readonly icon = PASSKEY_ICON_DATA_URI as `data:image/svg+xml;${string}`
  readonly version = '1.0.0' as const
  readonly chains = [MOVEMENT_TESTNET_CHAIN] as const
  readonly url = 'https://github.com/moveindustries/wallet-adapter-passkey'

  private config: PasskeyAdapterConfig
  private credential: PasskeyCredential | null = null
  private accountListeners: MovementOnAccountChangeInput[] = []
  private networkListeners: MovementOnNetworkChangeInput[] = []
  // Wallet-standard `standard:events` listeners. Wallet-adapter libraries
  // (wallet-adapter-react, both Movement and Aptos flavors) subscribe to
  // these to refresh their cached view of `wallet.accounts` after connect.
  // Without firing `change` here, the library keeps the empty pre-connect
  // accounts array and useWallet() never flips to `connected`.
  private standardChangeListeners: StandardEventsListeners['change'][] = []
  private _movement: Movement | null = null

  constructor(config: PasskeyAdapterConfig) {
    this.config = config
    // The two modes register as distinct wallet entries in the connect modal.
    // The id must be unique per registered wallet; the name is what users see.
    if (config.mode === 'signin') {
      this.id = 'movement-passkey-signin'
      this.name = 'Sign in with existing passkey'
    } else {
      this.id = 'movement-passkey-create'
      this.name = 'Create new passkey'
    }
  }

  /**
   * Resolve the active credential for `connect()`. Cached credential always
   * wins — it skips the biometric prompt entirely. If nothing's cached the
   * mode determines whether we register a new passkey or recover an
   * existing one via dual-signature ECDSA point recovery.
   */
  private async performConnect(): Promise<PasskeyCredential> {
    const existing = loadCredential()
    if (existing) return existing

    if (this.config.mode === 'signin') {
      return signInWithExistingPasskey({
        rpId: this.config.rpId ?? autoDetectRpId(),
        onRecoveryStep: this.config.onRecoveryStep,
      })
    }
    return registerPasskey({
      rpId: this.config.rpId ?? autoDetectRpId(),
      rpName: this.config.rpName ?? 'Movement Wallet',
    })
  }

  get accounts(): readonly AccountInfo[] {
    return this.credential ? [this.toAccountInfo(this.credential)] : []
  }

  readonly features: Partial<MovementFeatures> & StandardEventsFeature = {
    // Cross-chain wallet-standard event emitter. Required for wallet-adapter
    // libraries to notice connect/disconnect — they cache `wallet.accounts`
    // and only re-read it when this fires `change`.
    'standard:events': {
      version: '1.0.0',
      on: <E extends StandardEventsNames>(
        event: E,
        listener: StandardEventsListeners[E],
      ): (() => void) => {
        if (event === 'change') {
          this.standardChangeListeners.push(listener as StandardEventsListeners['change'])
          return () => {
            this.standardChangeListeners = this.standardChangeListeners.filter(
              (l) => l !== (listener as StandardEventsListeners['change']),
            )
          }
        }
        // Unknown event — return a no-op unsubscribe.
        return () => {}
      },
    },
    'movement:account': {
      version: '1.0.0',
      account: async () => {
        if (!this.credential) throw new Error('Passkey adapter is not connected')
        return this.toAccountInfo(this.credential)
      },
    } satisfies MovementGetAccountFeature['movement:account'] as MovementGetAccountFeature['movement:account'],
    'movement:network': {
      version: '1.0.0',
      network: async () => TESTNET_INFO,
    } satisfies MovementGetNetworkFeature['movement:network'] as MovementGetNetworkFeature['movement:network'],
    'movement:connect': {
      version: '1.0.0',
      connect: async (): Promise<UserResponse<MovementConnectOutput>> => {
        const cred = await this.performConnect()
        this.credential = cred
        this.notifyAccountChange()
        return { status: UserResponseStatus.APPROVED, args: this.toAccountInfo(cred) }
      },
    } satisfies MovementConnectFeature['movement:connect'] as MovementConnectFeature['movement:connect'],
    'movement:disconnect': {
      version: '1.0.0',
      disconnect: async () => {
        clearCredential()
        this.credential = null
        this.notifyAccountChange()
      },
    } satisfies MovementDisconnectFeature['movement:disconnect'] as MovementDisconnectFeature['movement:disconnect'],
    'movement:onAccountChange': {
      version: '1.0.0',
      onAccountChange: async (cb) => {
        this.accountListeners.push(cb)
      },
    } satisfies MovementOnAccountChangeFeature['movement:onAccountChange'] as MovementOnAccountChangeFeature['movement:onAccountChange'],
    'movement:onNetworkChange': {
      version: '1.0.0',
      onNetworkChange: async (cb) => {
        this.networkListeners.push(cb)
      },
    } satisfies MovementOnNetworkChangeFeature['movement:onNetworkChange'] as MovementOnNetworkChangeFeature['movement:onNetworkChange'],
    'movement:signMessage': {
      version: '1.0.0',
      signMessage: async () => {
        // Generic signMessage support for passkey is fiddly: dApps verifying
        // off-chain typically expect Ed25519, while WebAuthn signs over a
        // clientDataJSON envelope around our challenge with a P-256 key.
        // We don't yet ship a clean abstraction — point users at signTx.
        throw new Error(
          'Passkey wallet does not yet support generic signMessage. ' +
            'Use signTransaction or signAndSubmitTransaction for on-chain operations.',
        )
      },
    } satisfies MovementSignMessageFeature['movement:signMessage'] as MovementSignMessageFeature['movement:signMessage'],
    'movement:signTransaction': {
      version: '1.1.0',
      signTransaction: (async (...args: unknown[]) => {
        if (!this.credential) throw new Error('Passkey adapter is not connected')
        const rpId = this.config.rpId ?? autoDetectRpId()

        // v1.1: single input object with `payload`
        const first = args[0] as Record<string, unknown> | undefined
        if (first && typeof first === 'object' && 'payload' in first) {
          const input = first as unknown as MovementSignTransactionInputV1_1
          if (input.feePayer !== undefined) {
            throw new Error('Passkey adapter does not yet support fee-payer signing')
          }
          const client = this.getMovementClient()
          const transaction = await client.transaction.build.simple({
            sender: (input.sender?.address ?? this.credential.address) as never,
            data: input.payload as never,
            ...(input.gasUnitPrice !== undefined ||
            input.maxGasAmount !== undefined ||
            input.expirationSecondsFromNow !== undefined
              ? {
                  options: {
                    ...(input.gasUnitPrice !== undefined
                      ? { gasUnitPrice: input.gasUnitPrice }
                      : {}),
                    ...(input.maxGasAmount !== undefined
                      ? { maxGasAmount: input.maxGasAmount }
                      : {}),
                    ...(input.expirationSecondsFromNow !== undefined
                      ? {
                          expireTimestamp:
                            Math.floor(Date.now() / 1000) + input.expirationSecondsFromNow,
                        }
                      : {}),
                  },
                }
              : {}),
          } as never)
          const authenticator = await signTransactionWithPasskey(
            this.credential,
            transaction as never,
            { rpId },
          )
          const args11: MovementSignTransactionOutputV1_1 = {
            authenticator: authenticator as never,
            rawTransaction: transaction as never,
          }
          return { status: UserResponseStatus.APPROVED, args: args11 }
        }

        // v1.0: positional (transaction, asFeePayer?)
        const [transaction, asFeePayer] = args as [unknown, boolean | undefined]
        if (asFeePayer) {
          throw new Error('Passkey adapter does not yet support fee-payer signing')
        }
        const auth = await signTransactionWithPasskey(
          this.credential,
          transaction as never,
          { rpId },
        )
        return { status: UserResponseStatus.APPROVED, args: auth as never }
      }) as never,
    } satisfies MovementSignTransactionFeatureV1_1['movement:signTransaction'] as MovementSignTransactionFeatureV1_1['movement:signTransaction'],
    'movement:signAndSubmitTransaction': {
      version: '1.1.0',
      signAndSubmitTransaction: async (input) => {
        if (!this.credential) throw new Error('Passkey adapter is not connected')
        const client = this.getMovementClient()
        const transaction = await client.transaction.build.simple({
          sender: this.credential.address as never,
          data: input.payload as never,
          ...(input.gasUnitPrice || input.maxGasAmount
            ? {
                options: {
                  ...(input.gasUnitPrice ? { gasUnitPrice: input.gasUnitPrice } : {}),
                  ...(input.maxGasAmount ? { maxGasAmount: input.maxGasAmount } : {}),
                },
              }
            : {}),
        } as never)
        const senderAuthenticator = await signTransactionWithPasskey(
          this.credential,
          transaction as never,
          { rpId: this.config.rpId ?? autoDetectRpId() },
        )
        const submitted = await client.transaction.submit.simple({
          transaction,
          senderAuthenticator,
        } as never)
        return { status: UserResponseStatus.APPROVED, args: { hash: submitted.hash } }
      },
    } satisfies MovementSignAndSubmitTransactionFeature['movement:signAndSubmitTransaction'] as MovementSignAndSubmitTransactionFeature['movement:signAndSubmitTransaction'],
    'movement:changeNetwork': {
      version: '1.0.0',
      changeNetwork: async () => {
        return { status: UserResponseStatus.REJECTED }
      },
    } satisfies MovementChangeNetworkFeature['movement:changeNetwork'] as MovementChangeNetworkFeature['movement:changeNetwork'],
  }

  private toAccountInfo(cred: PasskeyCredential): AccountInfo {
    return {
      address: cred.address,
      publicKey: Hex.fromHexInput(cred.publicKey).toString(),
      ansName: undefined,
    } as unknown as AccountInfo
  }

  private notifyAccountChange(): void {
    const info = this.credential ? this.toAccountInfo(this.credential) : undefined
    // Chain-specific listeners (registered via movement:onAccountChange).
    for (const cb of this.accountListeners) cb(info as never)
    // Wallet-standard `change` event — what wallet-adapter-react actually
    // listens to. Pass the new `accounts` array so the library re-reads it.
    for (const cb of this.standardChangeListeners) {
      cb({ accounts: this.accounts as never })
    }
  }

  private getMovementClient(): Movement {
    if (!this._movement) {
      this._movement = new Movement(
        new MovementConfig({
          network: Network.CUSTOM,
          fullnode: 'https://testnet.movementnetwork.xyz/v1',
          indexer: 'https://indexer.testnet.movementnetwork.xyz/v1/graphql',
        }),
      )
    }
    return this._movement
  }
}
