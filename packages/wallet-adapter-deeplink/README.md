# @moveindustries/wallet-adapter-deeplink

Connects a page in a **mobile browser** to a Movement wallet app installed on
the same device. Implements
[`@moveindustries/wallet-standard`](https://www.npmjs.com/package/@moveindustries/wallet-standard),
so a deeplink wallet appears in
[`@moveindustries/wallet-adapter-react`](https://www.npmjs.com/package/@moveindustries/wallet-adapter-react)
alongside every other wallet and consumers keep calling `useWallet()`.

This is the case an injected provider cannot serve: the dApp is open in Safari
or Chrome, and the wallet is a separate app. Requests leave as URLs the OS
routes to the wallet, and answers come back as a fresh load of the page that
asked.

## Install

```bash
pnpm add @moveindustries/wallet-adapter-deeplink \
         @moveindustries/wallet-adapter-react \
         @moveindustries/wallet-standard \
         @moveindustries/ts-sdk
```

## Usage

Register once at app start:

```ts
import { registerDeeplinkWallets } from '@moveindustries/wallet-adapter-deeplink'

registerDeeplinkWallets()
```

Registration is conditional, and neither guard tries to detect an installed
app, because nothing about one is visible from a web page:

- **Not a phone** — a deeplink has nowhere to go, and offering the wallet on
  desktop produces a dead end. Pass `{ force: true }` to override, which is
  only useful for tests and Storybook.
- **Already inside the wallet's in-app browser** — its injected provider has
  registered, and a second entry with the same name would leave the connect
  modal picking arbitrarily between them.

The install question is answered by the OS at tap time: it either opens the
app, or loads a web page saying the app is missing.

### Capability discovery

The connect response reports which methods the installed build answers.
Deeplink users run whatever version they have, and cannot be prompted to
upgrade mid-flow, so check before offering an action rather than sending the
user out to the wallet and back to discover an error:

```ts
if (adapter.supports('sign_transaction')) {
  // …offer sign-without-submit
}
```

A build from before discovery existed reports no list at all. That is read as
"the original four methods", never as "supports nothing", so an older wallet
looks old rather than broken.

## How a round trip works

1. The page generates an ephemeral X25519 key pair and stores the session.
2. The request travels as a URL the OS routes to the app: X25519 key agreement,
   HKDF-SHA256, then ChaCha20-Poly1305 over every payload after the connect
   handshake.
3. The wallet answers by opening the dApp's redirect URL with the sealed
   response in the query string.
4. The page reloads and consumes the response, which `registerDeeplinkWallets`
   does before any application code runs. Consumption is destructive, so the
   result of the round trip (the connect account, a signature, a transaction
   hash) is kept on the adapter's `lastConsumedResponse` for the host app to
   read after registration: the promise that made the request settled in a
   page that no longer exists, and this field is where its answer lands.

Each request carries an id. `takeResponseFromUrl` strips both parameters from
the URL whether or not they match the request in flight, so a spent response
cannot sit in the address bar and re-fire on the next load. Mismatches surface
a typed reason on `adapter.lastIgnoredResponse` rather than failing silently.

The session lives in `localStorage`, not `sessionStorage`: the wallet often
returns into a **new tab**, and a per-tab store would drop a valid response.

### Reconnecting after the round trip

The page that receives an approved connect is not connected in
wallet-adapter-core's eyes: core's connected state was in-memory only, and the
page that held it unloaded. The adapter bridges this by writing core's `MovementWalletName`
localStorage key when it consumes an approved connect, so a host using
`autoConnect` resumes the session with no user action — the adapter serves that
reconnect from its stored session without leaving the page. A host not using
`autoConnect` should call `connect()` again after seeing
`lastConsumedResponse?.method === 'connect'`; the same stored session serves it
instantly.

A hand-off that never happens cannot settle by page unload, so `connect()` (and
every signing call) also rejects on its own: after ~30 seconds if the page
never lost visibility (the user dismissed the "Open in …?" sheet), or shortly
after the page becomes visible again without a response arriving (the user came
back by switching apps). Core's `connecting`/`isLoading` state recovers instead
of staying set forever.

### Inputs the wire cannot carry

The wire format is fixed by the installed wallet app, so inputs it cannot
express are **refused in the page**, before the user is sent anywhere, rather
than silently narrowed:

- `signAndSubmitTransaction` with `gasUnitPrice`/`maxGasAmount` (the wallet
  estimates gas itself), or with script/multisig payloads.
- `signMessage` with the `address`/`application`/`chainId` binding flags — a
  signature produced without a requested binding would look valid while
  carrying none of the anti-replay the dApp asked for.
- `signTransaction` as a fee payer.

SDK argument classes (`AccountAddress`, `U64`, `Bool`, `MoveString`,
`MoveVector`, …) in `functionArguments` are unwrapped and sent, matching what
extension adapters accept.

## Two things to know before integrating

**Connect is trust on first use.** The dApp learns the wallet's X25519 public
key from the connect response itself, so nothing in this protocol proves that
response came from the real wallet — any app able to open the redirect URL
could return its own key and address. What backs the assumption is the OS:
App Links (Android) and Universal Links (iOS) verification is what makes
`https://motion.movementnetwork.xyz/dapp/v1/*` open the wallet and not
something else. That verification depends on the site serving
`.well-known/assetlinks.json` with a `handle_all_urls` relation and an
`apple-app-site-association` claiming the path. Everything after connect is
authenticated by the AEAD tag on each sealed payload, so the wallet's later
answers are unforgeable without the shared key.

**Requests reach web server logs when the app is not installed.** The request
rides in the query string of an https URL, which is what lets the wallet read
it and what lets the OS route it. When no app claims the URL, the browser makes
an ordinary web request instead, so the method, the dApp's ephemeral public
key, the sealed payload, and the timing land in that host's access logs.

The payload itself stays safe — whoever holds the logs has no private key. What
is exposed is metadata: which dApp asked for what, when, and how often,
retained for as long as that host keeps logs. A URL fragment would avoid it but
does not survive the App Links hand-off, so the query string is not optional.
Serving the fallback route with request logging disabled is the available
mitigation, and it belongs to the site rather than to this package.

## Testing before the site claims the path

`baseUrl` defaults to the https entry point. Override it with the custom scheme
to exercise the wallet before `.well-known` carries `/dapp/v1`, or on a
simulator:

```ts
registerDeeplinkWallets({
  wallets: [{ ...MOTION_WALLET, baseUrl: 'movement://dapp/v1/' }],
})
```

The two prove different things. The custom scheme shows only that the app
parses and answers; the https form also shows the OS routed it, which is what
verification buys. A browser that loads the fallback page instead of opening
the wallet is the symptom of verification not being in place.

## API

| Export | Purpose |
| --- | --- |
| `registerDeeplinkWallets(options?)` | Registers the wallets, when the environment can reach one. Returns the adapters, empty otherwise. |
| `DeeplinkWalletAdapter` | The wallet-standard adapter. `supports(method)`, `supportedMethods`, `lastConsumedResponse`, `lastIgnoredResponse`, `disconnectReason`. |
| `DEFAULT_WALLETS`, `MOTION_WALLET` | The built-in wallet table, and the single entry in it. |
| `isMobileBrowser()` | Whether a deeplink can go anywhere from here. Detects a phone, not a wallet. |
| `DeeplinkWallet`, `ConnectData`, `Method` | Types. |
