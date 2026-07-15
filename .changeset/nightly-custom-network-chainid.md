---
"@moveindustries/wallet-adapter-core": patch
---

fix: recognize Movement networks by chain id in `getMovementConfig`

`getMovementConfig` previously resolved the network from only the reported network
`name` and RPC `url`. Wallets like Nightly report `name: "custom"` with a proxy RPC
URL (e.g. `https://rpc.movement.nightly.app`) while still reporting the correct
`chainId` (126 mainnet / 250 testnet), so both checks missed and the adapter threw
"Invalid network, network custom not supported...". This surfaced on any flow where
the adapter builds or submits the transaction itself (`submitTransaction`, and
`signTransaction`/`signAndSubmitTransaction` on pre-1.1.0 wallets).

`getMovementConfig` now checks the reported `chainId` against Movement's chain ids
before falling back to the URL allowlist. The check is additive — wallets that don't
report a recognized Movement chain id fall through to the existing name/url logic
unchanged, so there is no behavior change for currently-working wallets.
