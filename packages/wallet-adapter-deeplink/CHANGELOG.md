# @moveindustries/wallet-adapter-deeplink

## 0.1.1

### Patch Changes

- Keep stale wallet responses out of the redirect URL, and read the newest
  response instead of the oldest. The URL cleanup can be reverted by a host
  framework that restores its own URL after hydration; responses then
  compounded one per round trip and every reply after the first was matched
  against the oldest one and dropped.
- Carry the wallet's rejection reason on `lastConsumedResponse`, so a host app
  can show why a request was refused. The reason travels in plaintext and is
  forgeable by anyone holding the request id: display it, never branch on it.

## 0.1.0

### Minor Changes

- Initial release: wallet-standard registration for mobile wallets reached by
  deeplink (`registerDeeplinkWallets`), with connect, sign message, sign
  transaction, and sign-and-submit over an encrypted request/response channel
  (X25519 + HKDF + ChaCha20-Poly1305), session restore across the round trip
  out to the wallet app, and Motion Wallet as the built-in entry.
