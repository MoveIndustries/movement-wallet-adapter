import type {
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
  MovementSignTransactionFeatureV1_0,
  NetworkInfo,
  UserResponse,
} from '@moveindustries/wallet-standard'
import {
  AccountInfo,
  MOVEMENT_TESTNET_CHAIN,
  UserResponseStatus,
} from '@moveindustries/wallet-standard'
import type { StandardEventsFeature, StandardEventsListeners } from '@wallet-standard/core'
import type { AnyRawTransaction } from '@moveindustries/ts-sdk'
import {
  AccountAddress,
  AnyPublicKey,
  Deserializer,
  Ed25519PublicKey,
  Hex,
} from '@moveindustries/ts-sdk'
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

/**
 * Envelope the wallet returns for approvals other than connect.
 *
 * Plaintext, and treated as such: anyone can forge one into a return URL, so
 * nothing here may change what the page believes about its identity. The
 * account the wallet acted as travels inside the sealed `data`, where the
 * session key authenticates it — see `followAccount`.
 */
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
}

/**
 * The active account in the wallet app never approved this dApp.
 *
 * An app has no channel back into a browser tab, so a wallet switch cannot be
 * pushed here the way the extension pushes `disconnect`. It arrives instead on
 * the next request, as this code. A switch to an account that DID approve this
 * dApp never produces it: that request is served silently as the new account,
 * disclosed inside the sealed result (extension parity).
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

  /**
   * The response consumed on this page load, kept for the host app.
   *
   * Consumption is destructive (the URL parameters and the pending record are
   * spent), and registration consumes before any app code runs, so without
   * this the result of an approved sign was decrypted once and lost. The
   * promise that made the request settled in a page that no longer exists;
   * this is where its answer lands instead.
   */
  lastConsumedResponse: { method: Method; result: unknown } | null = null

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

  /**
   * A real `AccountInfo`, not a shaped literal: wallet-adapter-core stores this
   * object as-is and `signMessageAndVerify` calls `verifySignature` on its
   * `publicKey`, which raw bytes do not have. The connect payload's key is hex,
   * either a bare 32-byte Ed25519 key or a BCS `AnyPublicKey` (the canonical
   * encoding non-Ed25519 accounts use).
   *
   * Null rather than a throw on a malformed stored key: this runs from
   * registration-time paths, where a throw would stop every adapter from
   * registering.
   */
  private accountInfo(): AccountInfo | null {
    const account = this.account
    if (!account) return null
    try {
      const bytes = Hex.fromHexString(account.publicKey).toUint8Array()
      const publicKey =
        bytes.length === 32
          ? new Ed25519PublicKey(bytes)
          : AnyPublicKey.deserialize(new Deserializer(bytes))
      return new AccountInfo({
        address: AccountAddress.fromString(account.address),
        publicKey,
      })
    } catch (error) {
      console.warn(`[deeplink] stored account is unreadable: ${messageOf(error)}`)
      return null
    }
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
    // Addressed by wallet id inside the take, before anything is consumed: a
    // response for another registered wallet must survive for that adapter's
    // own consumeResponse call.
    const taken = takeResponseFromUrl(this.wallet.id)
    if (!taken) return null
    if (!taken.ok) {
      // Loud on purpose. A response that arrives but cannot be matched is
      // indistinguishable, on screen, from never having come back at all.
      console.warn(`[deeplink] ignoring wallet response: ${taken.reason}`)
      this.lastIgnoredResponse = taken.reason
      return null
    }

    // A response the wallet produced can still be unreadable here: truncated
    // in transit by a messaging app, or sealed for a session this page has
    // since replaced. That is a lost response, not a broken page, and it must
    // not throw out of registration and stop every adapter from registering.
    let consumed: { method: Method; result: unknown } | null
    try {
      consumed = this.applyResponse(taken.encoded, taken.pending)
    } catch (error) {
      const reason = `wallet response could not be read: ${messageOf(error)}`
      console.warn(`[deeplink] ${reason}`)
      this.lastIgnoredResponse = reason
      return null
    }
    if (consumed) this.lastConsumedResponse = consumed
    return consumed
  }

  private applyResponse(
    encoded: string,
    pending: { method: Method },
  ): { method: Method; result: unknown } | null {
    if (pending.method === 'connect') {
      const envelope = decodeResponse<ConnectResponseEnvelope>(encoded)
      if (!envelope.approved) return { method: 'connect', result: null }
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
    const result = open<{ address?: string; publicKey?: string }>(envelope.data, key)
    // Only after the AEAD open: identity read from the plaintext envelope
    // could be forged into a return URL by anyone holding the request id.
    this.followAccount(result)
    return { method: pending.method, result }
  }

  // MARK: events

  /**
   * Follow an account switch made in the wallet app.
   *
   * A switch to an account that also approved this dApp is served silently as
   * that account (extension parity), so a response can come back from a
   * different account than the one that connected. An app cannot reach into a
   * browser tab to announce that, so every sealed result states the account it
   * was produced as and the session is corrected here.
   *
   * Without this the page keeps displaying the address it saw at connect while
   * the wallet signs as another one, which is worse than showing nothing: the
   * user reads one account and transacts from a different one.
   *
   * The identity comes from inside the AEAD, never from the plaintext
   * envelope, so only the wallet can assert it. Address and key move together:
   * half an identity would fail verification in a way that reads as a bad
   * signature rather than a stale session.
   */
  private followAccount(result: { address?: string; publicKey?: string }): void {
    const { address, publicKey } = result
    if (!address || !publicKey) return
    const session = this.session
    if (!session?.account || session.account.address === address) return
    saveSession({ ...session, account: { ...session.account, address, publicKey } })
    this.emitChange()
  }

  /**
   * Forget a session the wallet has stopped honouring.
   *
   * ACCOUNT_CHANGED means the active account never approved this dApp, so
   * nothing will be signed under this session until the user reconnects. The
   * page keypair is kept: it is the identity the wallet's per-account grants
   * are keyed by, and reconnecting under it is what lets a later switch back
   * to a previously approved account be served silently instead of demanding
   * another reconnect. The `emitChange` is what actually updates the UI, since
   * the connect modal is driven by the standard change event rather than by
   * the response.
   */
  private dropDeadSession(): void {
    const session = this.session
    if (session) {
      saveSession({
        walletId: session.walletId,
        secretKeyHex: session.secretKeyHex,
        publicKeyHex: session.publicKeyHex,
      })
    } else {
      clearSession()
    }
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
        // Reuse the stored keypair when one exists: the page's key is its
        // identity to the wallet, and per-account grants are keyed by it. A
        // fresh key on every connect would make each reconnect a stranger, and
        // a switch back to a previously approved account could never be served
        // silently.
        const session = this.session ?? beginSession(this.wallet.id)
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
      // 1.0 deliberately. The 1.1 input shape hands the WALLET a payload to
      // build the transaction from, but this transport signs exactly the BCS
      // bytes it is given, so the caller has to build them: under 1.1,
      // wallet-adapter-core passed payload input here unbuilt and
      // `rawTransaction` was undefined. Under 1.0 the core builds the
      // transaction itself and passes it whole.
      version: '1.0.0',
      signTransaction: async (transaction: AnyRawTransaction, asFeePayer?: boolean) => {
        const { session, key } = this.requireSession()
        if (!this.supports('sign_transaction')) {
          // Discovery exists precisely so this fails here, in the page, rather
          // than after sending the user out to the wallet and back.
          throw new Error(
            'The installed wallet version cannot sign without submitting. Update it and try again.',
          )
        }
        if (asFeePayer) {
          // A fee payer signs a different message than the sender; the wire
          // carries raw-transaction bytes only, so signing them here would
          // produce a valid-looking authenticator for the wrong role.
          throw new Error('Fee-payer signing is not supported over the deeplink transport.')
        }
        const bytes = transaction.rawTransaction.bcsToBytes()
        return this.navigate('sign_transaction', {
          dappEncryptionPublicKey: session.publicKeyHex,
          payload: seal({ transaction: base64Encode(bytes) }, key),
        })
      },
    } as unknown as MovementSignTransactionFeatureV1_0['movement:signTransaction'],

    'movement:signAndSubmitTransaction': {
      version: '1.1.0',
      signAndSubmitTransaction: async (input: {
        payload: {
          function?: string
          typeArguments?: string[]
          functionArguments?: unknown[]
          multisigAddress?: unknown
          bytecode?: unknown
        }
      }) => {
        const { session, key } = this.requireSession()
        const { payload } = input
        // The wire's payload is an entry-function descriptor and nothing else.
        // Script and multisig payloads cannot be expressed on it, and sealing
        // a stripped version would submit a different transaction than the
        // dApp built; refuse in the page instead.
        if (payload.bytecode !== undefined || typeof payload.function !== 'string') {
          throw new Error('Script payloads are not supported over the deeplink transport.')
        }
        if (payload.multisigAddress !== undefined) {
          throw new Error(
            'Multisig payloads are not supported over the deeplink transport. Build the transaction and use signTransaction instead.',
          )
        }
        return this.navigate('sign_and_submit', {
          dappEncryptionPublicKey: session.publicKeyHex,
          payload: seal(
            {
              function: payload.function,
              typeArguments: payload.typeArguments ?? [],
              // The wallet's native dialect requires string-encoded numbers;
              // a bare JSON number is rejected there.
              arguments: (payload.functionArguments ?? []).map(stringifyArg),
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

/**
 * Numbers must reach the wallet as strings, nested vectors keep their shape,
 * and byte buffers become per-byte strings (a `vector<u8>` on the wire).
 *
 * Anything else object-shaped is refused here, in the page: JSON would turn an
 * SDK class instance or a typed buffer into index-keyed garbage the wallet
 * rejects only after the user was already sent out to the app.
 */
function stringifyArg(value: unknown): unknown {
  if (value instanceof Uint8Array) return Array.from(value, String)
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value), String)
  if (Array.isArray(value)) return value.map(stringifyArg)
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' || typeof value === 'boolean') return value
  throw new Error(
    'Unsupported transaction argument: pass plain values (strings, numbers, booleans, arrays, byte arrays), not SDK class instances.',
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function documentTitle(): string {
  if (typeof document === 'undefined') return 'dApp'
  return document.title || window.location.hostname
}

function originOf(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}
