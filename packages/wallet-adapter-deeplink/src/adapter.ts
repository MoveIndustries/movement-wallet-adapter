import type {
  AccountInfo,
  MovementConnectFeature,
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
  NetworkInfo,
  UserResponse,
} from '@moveindustries/wallet-standard'
import { MOVEMENT_TESTNET_CHAIN, UserResponseStatus } from '@moveindustries/wallet-standard'
import type { StandardEventsFeature, StandardEventsListeners } from '@wallet-standard/core'
import { AccountAddress, Hex } from '@moveindustries/ts-sdk'
import {
  decodeResponse,
  open,
  seal,
  sharedKey,
  encodeRequest,
  base64Encode,
  type ConnectData,
  type Method,
} from './protocol.js'
import {
  beginSession,
  clearSession,
  loadSession,
  newRequestId,
  saveSession,
  savePending,
  secretKeyOf,
  takeResponseFromUrl,
  hostWindow,
  REQUEST_ID_PARAM,
  type StoredSession,
} from './session.js'
import type { DeeplinkWallet } from './wallets.js'

/**
 * Methods every build of the wallet has answered. Used when the connect
 * response carries no `methods` list, which means an older build rather than a
 * build that supports nothing.
 */
const LEGACY_METHODS: Method[] = ['connect', 'disconnect', 'sign_and_submit', 'sign_message']

/** Envelope the wallet returns for approvals other than connect. */
interface ApprovedPayload {
  approved: boolean
  data?: string
  error?: string
  code?: string
}

interface ConnectResponseEnvelope {
  approved: boolean
  walletEncryptionPublicKey: string
  data?: string
  error?: string
  code?: string
}

/**
 * The grant belongs to a wallet that is no longer active in the app.
 *
 * An app has no channel back into a browser tab, so a wallet switch cannot be
 * pushed here the way the extension pushes `disconnect`. It arrives instead on
 * the next request, as this code. The session it names is dead: keeping it
 * would leave the page showing a connected address the wallet will not sign
 * for.
 *
 * Older wallet builds send prose with no code. Nothing can be done about those
 * beyond what already happens, so they keep falling through as a plain failure.
 */
const ACCOUNT_CHANGED = 'ACCOUNT_CHANGED'

/**
 * A mobile wallet reachable only by leaving the page.
 *
 * Every signing call here is a full-page navigation: the browser hands off to
 * the wallet app, the user approves there, and the app navigates back with the
 * answer in the URL. That shape drives the two things that look unusual for a
 * wallet adapter.
 *
 * First, a call cannot resolve in the same page it was made from, so the
 * returned promises settle only after the round trip completes and the adapter
 * finds the response on load. A caller that keeps state purely in memory will
 * lose it across the departure — consuming apps have to be resumable from a
 * cold page load.
 *
 * Second, nothing can be detected. There is no injected provider and no
 * reliable way to ask whether an app is installed, so the adapter always
 * reports itself installed and lets the OS decide at tap time: it opens the
 * app, or it loads the wallet's web page saying the app is missing.
 */
export class DeeplinkWalletAdapter {
  readonly id: string
  readonly name: string
  readonly icon: DeeplinkWallet['icon']
  readonly version = '1.0.0' as const
  readonly chains = [MOVEMENT_TESTNET_CHAIN] as const
  readonly url: string

  private readonly wallet: DeeplinkWallet
  private accountListeners: MovementOnAccountChangeInput[] = []
  private networkListeners: MovementOnNetworkChangeInput[] = []
  private standardChangeListeners: StandardEventsListeners['change'][] = []

  /** Why the last response was dropped, if one was. Diagnostics only. */
  lastIgnoredResponse: string | null = null

  constructor(wallet: DeeplinkWallet) {
    this.wallet = wallet
    this.id = wallet.id
    this.name = wallet.name
    this.icon = wallet.icon
    this.url = wallet.url
  }

  // MARK: session

  private get session(): StoredSession | null {
    const s = loadSession()
    return s && s.walletId === this.wallet.id ? s : null
  }

  private get account(): ConnectData | null {
    return this.session?.account ?? null
  }

  /**
   * Methods the connected build answers. A missing list means a build from
   * before discovery existed, not a build with nothing.
   */
  get supportedMethods(): Method[] {
    return (this.account?.methods as Method[] | undefined) ?? LEGACY_METHODS
  }

  supports(method: Method): boolean {
    return this.supportedMethods.includes(method)
  }

  private accountInfo(): AccountInfo | null {
    const account = this.account
    if (!account) return null
    return {
      address: AccountAddress.fromString(account.address),
      publicKey: Hex.fromHexString(account.publicKey).toUint8Array(),
    } as unknown as AccountInfo
  }

  get accounts(): AccountInfo[] {
    const info = this.accountInfo()
    return info ? [info] : []
  }

  // MARK: transport

  /**
   * Sends a request and hands the page to the wallet app.
   *
   * The returned promise is deliberately never resolved in this page: the
   * navigation ends it. It exists so a caller awaiting the wallet-standard API
   * does not proceed as though the call had returned. The real answer arrives
   * in a later page load, through `consumeResponse`.
   */
  private navigate(method: Method, payload: Record<string, unknown>): Promise<never> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Deeplink wallets require a browser'))
    }
    // Framed hosts hand off from the top document: a subframe's custom-scheme
    // navigation is ignored, and the redirect has to name the page the user
    // will be returned to, not the frame inside it.
    const host = hostWindow()
    if (!host) {
      return Promise.reject(
        new Error(
          'Cannot reach the wallet from a cross-origin frame: the browser will not let this page navigate its parent.',
        ),
      )
    }
    const requestId = newRequestId()
    const redirect = new URL(host.location.href)
    redirect.searchParams.set(REQUEST_ID_PARAM, requestId)

    savePending({
      id: requestId,
      walletId: this.wallet.id,
      method,
      returnTo: host.location.href,
    })

    const data = encodeRequest({ ...payload, redirect: redirect.toString() })
    const target = `${this.wallet.baseUrl}${method}?data=${encodeURIComponent(data)}`

    return new Promise<never>((_resolve, reject) => {
      // Assigning `location` synchronously inside the click handler matters:
      // iOS drops universal links from navigations it cannot attribute to a
      // user gesture, and an await before this point loses that attribution.
      try {
        host.location.href = target
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  /**
   * Applies a wallet response found on the current URL.
   *
   * Called on registration, because the page that receives the answer is a
   * fresh load of the page that asked. Returns what it handled so a host app
   * can react; returns null when there is nothing for this wallet.
   */
  consumeResponse(): { method: Method; result: unknown } | null {
    const taken = takeResponseFromUrl()
    if (!taken) return null
    if (!taken.ok) {
      // Loud on purpose. A response that arrives but cannot be matched is
      // indistinguishable, on screen, from never having come back at all.
      console.warn(`[deeplink] ignoring wallet response: ${taken.reason}`)
      this.lastIgnoredResponse = taken.reason
      return null
    }
    if (taken.pending.walletId !== this.wallet.id) return null

    const { encoded, pending } = taken
    if (pending.method === 'connect') {
      const envelope = decodeResponse<ConnectResponseEnvelope>(encoded)
      if (!envelope.approved) {
        if (envelope.code === ACCOUNT_CHANGED) this.dropDeadSession()
        return { method: 'connect', result: null }
      }
      const session = this.session
      if (!session) return null

      const key = sharedKey(secretKeyOf(session), envelope.walletEncryptionPublicKey)
      const account = envelope.data ? open<ConnectData>(envelope.data, key) : null
      if (!account) return { method: 'connect', result: null }

      saveSession({
        ...session,
        walletPublicKeyHex: envelope.walletEncryptionPublicKey,
        account,
      })
      this.emitChange()
      return { method: 'connect', result: account }
    }

    const envelope = decodeResponse<ApprovedPayload>(encoded)
    if (!envelope.approved || !envelope.data) {
      if (envelope.code === ACCOUNT_CHANGED) this.dropDeadSession()
      return { method: pending.method, result: null }
    }
    const session = this.session
    if (!session?.walletPublicKeyHex) return null
    const key = sharedKey(secretKeyOf(session), session.walletPublicKeyHex)
    return { method: pending.method, result: open(envelope.data, key) }
  }

  // MARK: events

  /**
   * Forget a session the wallet no longer honours.
   *
   * The same teardown as an explicit disconnect, for the same reason: the
   * session key is useless once the wallet has stopped answering to it, and a
   * page left holding one shows an address it cannot transact with. The
   * `emitChange` is what actually updates the UI, since the connect modal is
   * driven by the standard change event rather than by the response.
   */
  private dropDeadSession(): void {
    clearSession()
    this.emitChange()
  }

  private emitChange(): void {
    const info = this.accountInfo()
    for (const listener of this.accountListeners) {
      ;(listener as unknown as (a: AccountInfo | undefined) => void)(info ?? undefined)
    }
    for (const listener of this.standardChangeListeners) {
      listener({ accounts: this.accounts as never })
    }
  }

  readonly features: Partial<MovementFeatures> & StandardEventsFeature = {
    'standard:events': {
      version: '1.0.0',
      on: (event, listener) => {
        if (event !== 'change') return () => undefined
        this.standardChangeListeners.push(listener as StandardEventsListeners['change'])
        return () => {
          this.standardChangeListeners = this.standardChangeListeners.filter(
            (l) => l !== listener,
          )
        }
      },
    },

    'movement:account': {
      version: '1.0.0',
      account: async () => {
        const info = this.accountInfo()
        if (!info) throw new Error('Wallet not connected')
        return info
      },
    } as MovementGetAccountFeature['movement:account'],

    'movement:network': {
      version: '1.0.0',
      network: async () => this.networkInfo(),
    } as MovementGetNetworkFeature['movement:network'],

    'movement:connect': {
      version: '1.0.0',
      connect: async () => {
        // An already-live session skips the round trip: re-connecting would
        // rotate our keypair and orphan the wallet's stored session.
        const existing = this.account
        if (existing) {
          return {
            status: UserResponseStatus.APPROVED,
            args: this.accountInfo(),
          } as unknown as UserResponse<never>
        }
        const session = beginSession(this.wallet.id)
        return this.navigate('connect', {
          appName: documentTitle(),
          appUrl: originOf(),
          dappEncryptionPublicKey: session.publicKeyHex,
        })
      },
    } as unknown as MovementConnectFeature['movement:connect'],

    'movement:disconnect': {
      version: '1.0.0',
      disconnect: async () => {
        // Local only, deliberately. The wire has a `disconnect` method, but
        // reaching it means navigating to the wallet app, and the wallet sends
        // nothing back for it — so telling the wallet would dump the user into
        // another app with no way home, every time they disconnect. Leaving
        // quietly is the better trade.
        //
        // The cost is that the wallet keeps listing this dApp until the user
        // revokes it there. That is a stale entry in a list, not a live
        // permission: a request from us would need our session key, which is
        // gone.
        clearSession()
        this.emitChange()
      },
    } as unknown as MovementDisconnectFeature['movement:disconnect'],

    'movement:onAccountChange': {
      version: '1.0.0',
      onAccountChange: async (input: MovementOnAccountChangeInput) => {
        // Registered but never fired: an app on the same phone has no channel
        // back into this tab, so an account switch there is invisible until the
        // next request returns.
        this.accountListeners.push(input)
      },
    } as MovementOnAccountChangeFeature['movement:onAccountChange'],

    'movement:onNetworkChange': {
      version: '1.0.0',
      onNetworkChange: async (input: MovementOnNetworkChangeInput) => {
        this.networkListeners.push(input)
      },
    } as MovementOnNetworkChangeFeature['movement:onNetworkChange'],

    'movement:signMessage': {
      version: '1.0.0',
      signMessage: async (input: { message: string; nonce: string }) => {
        const { session, key } = this.requireSession()
        return this.navigate('sign_message', {
          dappEncryptionPublicKey: session.publicKeyHex,
          payload: seal({ message: input.message, nonce: input.nonce }, key),
        })
      },
    } as unknown as MovementSignMessageFeature['movement:signMessage'],

    'movement:signTransaction': {
      version: '1.1.0',
      signTransaction: async (input: { rawTransaction: { bcsToBytes(): Uint8Array } }) => {
        const { session, key } = this.requireSession()
        if (!this.supports('sign_transaction')) {
          // Discovery exists precisely so this fails here, in the page, rather
          // than after sending the user out to the wallet and back.
          throw new Error(
            'The installed wallet version cannot sign without submitting. Update it and try again.',
          )
        }
        const bytes = input.rawTransaction.bcsToBytes()
        return this.navigate('sign_transaction', {
          dappEncryptionPublicKey: session.publicKeyHex,
          payload: seal({ transaction: base64Encode(bytes) }, key),
        })
      },
    } as unknown as MovementSignTransactionFeatureV1_1['movement:signTransaction'],

    'movement:signAndSubmitTransaction': {
      version: '1.1.0',
      signAndSubmitTransaction: async (input: {
        payload: { function: string; typeArguments?: string[]; functionArguments?: unknown[] }
      }) => {
        const { session, key } = this.requireSession()
        return this.navigate('sign_and_submit', {
          dappEncryptionPublicKey: session.publicKeyHex,
          payload: seal(
            {
              function: input.payload.function,
              typeArguments: input.payload.typeArguments ?? [],
              // The wallet's native dialect requires string-encoded numbers;
              // a bare JSON number is rejected there.
              arguments: (input.payload.functionArguments ?? []).map(stringifyArg),
            },
            key,
          ),
        })
      },
    } as unknown as MovementSignAndSubmitTransactionFeature['movement:signAndSubmitTransaction'],
  }

  private networkInfo(): NetworkInfo {
    const name = this.account?.network ?? 'testnet'
    return {
      name: name as unknown as NetworkInfo['name'],
      chainId: name === 'mainnet' ? 126 : 250,
      url:
        name === 'mainnet'
          ? 'https://mainnet.movementnetwork.xyz/v1'
          : 'https://testnet.movementnetwork.xyz/v1',
    }
  }

  private requireSession(): { session: StoredSession; key: Uint8Array } {
    const session = this.session
    if (!session?.walletPublicKeyHex) throw new Error('Wallet not connected')
    return { session, key: sharedKey(secretKeyOf(session), session.walletPublicKeyHex) }
  }
}

/** Numbers must reach the wallet as strings; nested vectors keep their shape. */
function stringifyArg(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stringifyArg)
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString()
  return value
}

function documentTitle(): string {
  if (typeof document === 'undefined') return 'dApp'
  return document.title || window.location.hostname
}

function originOf(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}
