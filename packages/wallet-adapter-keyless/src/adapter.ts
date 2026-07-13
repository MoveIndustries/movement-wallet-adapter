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
  MovementSignInFeature,
  MovementSignInInput,
  MovementSignInOutput,
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
import type { KeylessAccount } from '@moveindustries/ts-sdk'
import { Movement, MovementConfig, Network } from '@moveindustries/ts-sdk'
import { MovementKeyless } from '@moveindustries/keyless'
import type { KeylessAdapterConfig } from './types'
import { GOOGLE_ICON_DATA_URI } from './icon'
import { saveReturnTo, takeJwt } from './session'

const TESTNET_INFO: NetworkInfo = {
  name: 'testnet' as unknown as NetworkInfo['name'],
  chainId: 177,
  url: 'https://testnet.movementnetwork.xyz/v1',
}

/**
 * Movement keyless wallet adapter — implements the Movement wallet standard
 * so keyless (Google sign-in) accounts plug into @moveindustries/wallet-adapter-react
 * the same way Petra / Motion / Nightly do.
 *
 * Wraps @moveindustries/keyless internally; users of this package never
 * import that SDK directly.
 */
export class KeylessWalletAdapter {
  readonly id = 'movement-keyless'
  readonly name = 'Sign in with Google'
  readonly icon = GOOGLE_ICON_DATA_URI as `data:image/svg+xml;${string}`
  readonly version = '1.0.0' as const
  readonly chains = [MOVEMENT_TESTNET_CHAIN] as const
  readonly url = 'https://github.com/moveindustries/wallet-adapter-keyless'

  private config: KeylessAdapterConfig
  private account: KeylessAccount | null = null
  private keyless: MovementKeyless
  private accountListeners: MovementOnAccountChangeInput[] = []
  private networkListeners: MovementOnNetworkChangeInput[] = []
  // Wallet-standard `standard:events` listeners. Wallet-adapter libraries
  // (wallet-adapter-react, both Movement and Aptos flavors) subscribe to
  // these to refresh their cached view of `wallet.accounts` after connect.
  // Without firing `change` here, the library keeps the empty pre-connect
  // accounts array and useWallet() never flips to `connected`.
  private standardChangeListeners: StandardEventsListeners['change'][] = []
  private _movement: Movement | null = null

  constructor(config: KeylessAdapterConfig) {
    this.config = config
    this.keyless = new MovementKeyless({
      proverUrl: config.proverUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
    })
  }

  get accounts(): readonly AccountInfo[] {
    return this.account ? [this.toAccountInfo(this.account)] : []
  }

  /**
   * Expose the underlying KeylessAccount so callers that need its OIDC pepper
   * (e.g. to derive a confidential-asset decryption key per Aptos Labs'
   * confidential-payments-example pattern) can read it without us shipping
   * that derivation here. Returns null when not connected.
   */
  getKeylessAccount(): KeylessAccount | null {
    return this.account
  }

  /**
   * Update the adapter config at runtime. If the prover URL or client_id
   * changes while connected, auto-disconnects first because a different
   * prover means a different pepper means a different on-chain address.
   */
  setConfig(patch: Partial<KeylessAdapterConfig>): void {
    const proverChanged = patch.proverUrl !== undefined && patch.proverUrl !== this.config.proverUrl
    const clientChanged = patch.clientId !== undefined && patch.clientId !== this.config.clientId

    if ((proverChanged || clientChanged) && this.account) {
      this.keyless.logout()
      this.account = null
      this.notifyAccountChange()
    }

    this.config = { ...this.config, ...patch }
    this.keyless = new MovementKeyless({
      proverUrl: this.config.proverUrl,
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
    })
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
        if (!this.account) throw new Error('Keyless adapter is not connected')
        return this.toAccountInfo(this.account)
      },
    } satisfies MovementGetAccountFeature['movement:account'] as MovementGetAccountFeature['movement:account'],
    'movement:network': {
      version: '1.0.0',
      network: async () => TESTNET_INFO,
    } satisfies MovementGetNetworkFeature['movement:network'] as MovementGetNetworkFeature['movement:network'],
    'movement:connect': {
      version: '1.0.0',
      connect: async (): Promise<UserResponse<MovementConnectOutput>> => {
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        const hasIdToken = hash.includes('id_token=')

        if (hasIdToken) {
          // Completion path — runs on /callback after Google redirect.
          // The prove request flows through `fetch` so it's visible in the
          // app's debug panel Network tab; the post-connect change event
          // shows up in the Wallet tab.
          // @moveindustries/keyless is published against @aptos-labs/ts-sdk, so
          // completeLogin() returns that SDK's KeylessAccount. It's structurally
          // identical to @moveindustries/ts-sdk's (the latter is an Aptos fork),
          // so bridge the nominally-distinct types at this boundary.
          const account = (await this.keyless.completeLogin()) as unknown as KeylessAccount
          this.account = account
          this.notifyAccountChange()
          const info = this.toAccountInfo(account)
          return { status: UserResponseStatus.APPROVED, args: info }
        }

        // Initiate path — save where the user was, kick off OAuth redirect.
        saveReturnTo(window.location.pathname + window.location.search)
        this.keyless.beginLogin()
        // beginLogin redirects the page; this Promise will never resolve.
        return new Promise(() => {})
      },
    } satisfies MovementConnectFeature['movement:connect'] as MovementConnectFeature['movement:connect'],
    'movement:disconnect': {
      version: '1.0.0',
      disconnect: async () => {
        this.keyless.logout()
        this.account = null
        takeJwt()
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
      signMessage: async (input) => {
        if (!this.account) throw new Error('Keyless adapter is not connected')
        const lines: string[] = []
        if (input.address) lines.push(`address: ${this.account.accountAddress.toString()}`)
        if (input.application && typeof window !== 'undefined') lines.push(`application: ${window.location.origin}`)
        if (input.chainId) lines.push(`chainId: 177`)
        lines.push(`nonce: ${input.nonce}`)
        lines.push(`message: ${input.message}`)
        const fullMessage = `MOVEMENT\n${lines.join('\n')}`

        const sigObj = (this.account as unknown as { sign: (m: Uint8Array) => unknown }).sign(
          new TextEncoder().encode(fullMessage),
        )
        const args = {
          message: input.message,
          nonce: input.nonce,
          prefix: 'MOVEMENT' as const,
          fullMessage,
          signature: sigObj as never,
          ...(input.address ? { address: this.account.accountAddress.toString() } : {}),
          ...(input.application && typeof window !== 'undefined'
            ? { application: window.location.origin }
            : {}),
          ...(input.chainId ? { chainId: 177 } : {}),
        }
        return { status: UserResponseStatus.APPROVED, args }
      },
    } satisfies MovementSignMessageFeature['movement:signMessage'] as MovementSignMessageFeature['movement:signMessage'],
    'movement:signIn': {
      version: '1.0.0',
      signIn: async (input: MovementSignInInput) => {
        if (!this.account) throw new Error('Keyless adapter is not connected')
        const address = this.account.accountAddress.toString()
        const uri = input.uri ?? (typeof window !== 'undefined' ? window.location.origin : '')
        const version = input.version ?? '1'
        const chainId = input.chainId ?? 'movement:testnet'
        const issuedAt = input.issuedAt ?? new Date().toISOString()

        const fullInput = {
          ...input,
          address: input.address ?? address,
          uri,
          version,
          chainId,
          issuedAt,
        }

        const message = buildSignInMessage(fullInput, address, 'Movement')
        const acc = this.account as unknown as { sign(bytes: Uint8Array): unknown }
        const signature = acc.sign(new TextEncoder().encode(message))

        const args: MovementSignInOutput = {
          account: this.toAccountInfo(this.account),
          input: fullInput as MovementSignInInput & {
            domain: string; address: string; uri: string; version: string; chainId: string
          },
          signature: signature as never,
          type: 'ed25519',
        }
        return { status: UserResponseStatus.APPROVED, args }
      },
    } satisfies MovementSignInFeature['movement:signIn'] as MovementSignInFeature['movement:signIn'],
    'movement:signTransaction': {
      version: '1.1.0',
      signTransaction: (async (...args: unknown[]) => {
        if (!this.account) throw new Error('Keyless adapter is not connected')

        const acc = this.account as unknown as {
          signTransactionWithAuthenticator(tx: unknown): unknown
          signWithFeePayerAuthenticator(tx: unknown): unknown
        }

        // v1.1: single input object with `payload`
        const first = args[0] as Record<string, unknown> | undefined
        if (first && typeof first === 'object' && 'payload' in first) {
          const input = first as unknown as MovementSignTransactionInputV1_1
          const client = this.getMovementClient()
          const transaction = await client.transaction.build.simple({
            sender: (input.sender?.address ?? this.account.accountAddress) as never,
            data: input.payload as never,
            ...(input.gasUnitPrice !== undefined ||
                input.maxGasAmount !== undefined ||
                input.expirationSecondsFromNow !== undefined
              ? {
                  options: {
                    ...(input.gasUnitPrice !== undefined ? { gasUnitPrice: input.gasUnitPrice } : {}),
                    ...(input.maxGasAmount !== undefined ? { maxGasAmount: input.maxGasAmount } : {}),
                    ...(input.expirationSecondsFromNow !== undefined
                      ? { expireTimestamp: Math.floor(Date.now() / 1000) + input.expirationSecondsFromNow }
                      : {}),
                  },
                }
              : {}),
            ...(input.feePayer !== undefined ? { withFeePayer: true } : {}),
          } as never)
          const isFeePayer = input.feePayer !== undefined && input.feePayer.address.toString() === this.account.accountAddress.toString()
          const authenticator = isFeePayer
            ? acc.signWithFeePayerAuthenticator(transaction)
            : acc.signTransactionWithAuthenticator(transaction)
          const args11: MovementSignTransactionOutputV1_1 = {
            authenticator: authenticator as never,
            rawTransaction: transaction as never,
          }
          return { status: UserResponseStatus.APPROVED, args: args11 }
        }

        // v1.0: positional (transaction, asFeePayer?)
        const [transaction, asFeePayer] = args as [unknown, boolean | undefined]
        const auth = asFeePayer
          ? acc.signWithFeePayerAuthenticator(transaction)
          : acc.signTransactionWithAuthenticator(transaction)
        return { status: UserResponseStatus.APPROVED, args: auth as never }
      }) as never,
    } satisfies MovementSignTransactionFeatureV1_1['movement:signTransaction'] as MovementSignTransactionFeatureV1_1['movement:signTransaction'],
    'movement:signAndSubmitTransaction': {
      version: '1.1.0',
      signAndSubmitTransaction: async (input) => {
        if (!this.account) throw new Error('Keyless adapter is not connected')
        const client = this.getMovementClient()
        const transaction = await client.transaction.build.simple({
          sender: this.account.accountAddress as never,
          data: input.payload,
          ...(input.gasUnitPrice || input.maxGasAmount
            ? {
                options: {
                  ...(input.gasUnitPrice ? { gasUnitPrice: input.gasUnitPrice } : {}),
                  ...(input.maxGasAmount ? { maxGasAmount: input.maxGasAmount } : {}),
                },
              }
            : {}),
        })
        const submitted = await client.signAndSubmitTransaction({
          signer: this.account as never,
          transaction,
        })
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

  private toAccountInfo(acc: KeylessAccount): AccountInfo {
    return {
      address: acc.accountAddress.toString(),
      publicKey: acc.publicKey.toString(),
      ansName: undefined,
    } as unknown as AccountInfo
  }

  private notifyAccountChange(): void {
    const info = this.account ? this.toAccountInfo(this.account) : undefined
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

function buildSignInMessage(
  input: { domain: string; statement?: string; uri: string; version: string; chainId: string; nonce: string; issuedAt: string; expirationTime?: string; notBefore?: string; requestId?: string; resources?: string[] },
  address: string,
  chainName: 'Movement' | 'Aptos',
): string {
  const origin = input.domain.includes('://') ? input.domain : `https://${input.domain}`
  const lines: string[] = [
    `${origin} wants you to sign in with your ${chainName} account:`,
    address,
  ]
  if (input.statement) {
    lines.push('', input.statement)
  }
  const fields: Array<[string, string | undefined]> = [
    ['URI', input.uri],
    ['Version', input.version],
    ['Chain ID', input.chainId],
    ['Nonce', input.nonce],
    ['Issued At', input.issuedAt],
    ['Expiration Time', input.expirationTime],
    ['Not Before', input.notBefore],
    ['Request ID', input.requestId],
  ]
  if (fields.some(([_, v]) => v !== undefined)) {
    lines.push('')
    for (const [label, value] of fields) {
      if (value !== undefined) lines.push(`${label}: ${value}`)
    }
  }
  if (input.resources && input.resources.length > 0) {
    lines.push('Resources:')
    for (const r of input.resources) lines.push(`- ${r}`)
  }
  return lines.join('\n')
}
