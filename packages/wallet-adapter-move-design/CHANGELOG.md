# @moveindustries/wallet-adapter-move-design

## 1.2.2

### Patch Changes

- 1eae1bf: feat: add `refetchMnsName()` to programmatically refresh MNS name

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

- Updated dependencies [1eae1bf]
  - @moveindustries/wallet-adapter-react@7.4.0

## 1.2.1

### Patch Changes

- @moveindustries/wallet-adapter-react@7.3.1

## 1.1.0

### Minor Changes

- Add WalletSelector component - a drop-in wallet button with connect/disconnect flow, address display, and dropdown menu

## 1.0.1

### Patch Changes

- 2e524e0: Tailwind CSS v4 class fixes, add importable styles entrypoint, add README, and package metadata improvements
