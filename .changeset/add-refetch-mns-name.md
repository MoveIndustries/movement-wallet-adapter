---
"@moveindustries/wallet-adapter-core": minor
"@moveindustries/wallet-adapter-react": minor
"@moveindustries/wallet-adapter-ant-design": patch
"@moveindustries/wallet-adapter-mui-design": patch
"@moveindustries/wallet-adapter-move-design": patch
"@moveindustries/cross-chain-core": patch
---

feat: add `refetchMnsName()` to programmatically refresh MNS name

Adds a new `refetchMnsName()` method exposed via `useWallet()` that allows dapps to
programmatically trigger a re-fetch of the connected account's MNS primary name.

This is useful for name service dapps where a user sets or changes their primary MNS name
on-chain and the adapter should reflect the update without requiring a wallet reconnect.

Usage:
```tsx
const { refetchMnsName } = useWallet();

// After the user sets their primary name on-chain:
await signAndSubmitTransaction(setPrimaryNameTx);
await refetchMnsName();
// The WalletSelector and account.mnsName will update automatically
```
