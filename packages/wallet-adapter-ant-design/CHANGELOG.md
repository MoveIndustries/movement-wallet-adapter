# @movement-labs/wallet-adapter-ant-design

## 5.4.2

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

## 5.4.1

### Patch Changes

- @moveindustries/wallet-adapter-react@7.3.1

## 5.3.3

### Patch Changes

- 2e524e0: Tailwind CSS v4 class fixes, add importable styles entrypoint, add README, and package metadata improvements

## 5.3.2

### Patch Changes

- @movement-labs/wallet-adapter-react@7.2.2

## 5.3.1

### Patch Changes

- 19e7e2a: Deprecate aptos connect functions and constants in favor of petra web
- Updated dependencies [19e7e2a]
  - @movement-labs/wallet-adapter-react@7.2.1

## 5.3.0

### Minor Changes

- d2d308c: Bump @aptos-connect/wallet-adapter-plugin to 2.7.0
- b3474b3: Update AC dns to web.petra.app
- 499e03e: Rename aptos connect to petra web

### Patch Changes

- Updated dependencies [d2d308c]
- Updated dependencies [b3474b3]
- Updated dependencies [499e03e]
  - @movement-labs/wallet-adapter-react@7.2.0

## 5.2.3

### Patch Changes

- @movement-labs/wallet-adapter-react@7.1.3

## 5.2.2

### Patch Changes

- @movement-labs/wallet-adapter-react@7.1.2

## 5.2.1

### Patch Changes

- @movement-labs/wallet-adapter-react@7.1.1

## 5.2.0

### Minor Changes

- e554d03: Upgrade underlying dependencies for the wallet adapter

### Patch Changes

- Updated dependencies [e554d03]
  - @movement-labs/wallet-adapter-react@7.1.0

## 5.1.6

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.7

## 5.1.5

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.6

## 5.1.4

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.5

## 5.1.3

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.4

## 5.1.2

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.3

## 5.1.1

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.2

## 5.1.0

### Minor Changes

- 4d0b4ec: Modify the wallet button to have a dropdown with two options: "Copy Address" and "Disconnect"

## 5.0.1

### Patch Changes

- @movement-labs/wallet-adapter-react@7.0.1

## 5.0.0

### Major Changes

- b80eff6: Add support for transactionSubmitter, bump minimum TS SDK version to 3.x.x

### Patch Changes

- Updated dependencies [b80eff6]
  - @movement-labs/wallet-adapter-react@7.0.0

## 4.1.1

### Patch Changes

- Updated dependencies [fae2bf0]
  - @movement-labs/wallet-adapter-react@6.2.0

## 4.1.0

### Minor Changes

- 858d764: Add React version ^19 as a peer dependency

## 4.0.22

### Patch Changes

- @movement-labs/wallet-adapter-react@6.1.2

## 4.0.21

### Patch Changes

- @movement-labs/wallet-adapter-react@6.1.1

## 4.0.20

### Patch Changes

- Updated dependencies [8675c83]
  - @movement-labs/wallet-adapter-react@6.1.0

## 4.0.19

### Patch Changes

- @movement-labs/wallet-adapter-react@6.0.4

## 4.0.18

### Patch Changes

- @movement-labs/wallet-adapter-react@6.0.3

## 4.0.17

### Patch Changes

- @movement-labs/wallet-adapter-react@6.0.2

## 4.0.16

### Patch Changes

- @movement-labs/wallet-adapter-react@6.0.1

## 4.0.15

### Patch Changes

- @movement-labs/wallet-adapter-react@6.0.0

## 4.0.14

### Patch Changes

- @movement-labs/wallet-adapter-react@5.0.5

## 4.0.13

### Patch Changes

- @movement-labs/wallet-adapter-react@5.0.4

## 4.0.12

### Patch Changes

- @movement-labs/wallet-adapter-react@5.0.3

## 4.0.11

### Patch Changes

- @movement-labs/wallet-adapter-react@5.0.2

## 4.0.10

### Patch Changes

- @movement-labs/wallet-adapter-react@5.0.1

## 4.0.9

### Patch Changes

- Updated dependencies [ad3b6bb]
  - @movement-labs/wallet-adapter-react@5.0.0

## 4.0.8

### Patch Changes

- Updated dependencies [8fea651]
  - @movement-labs/wallet-adapter-react@4.1.5

## 4.0.7

### Patch Changes

- 25ab2ef: Allow users to perform connections when the wallet is `_connected` but `_account` is `null`
- Updated dependencies [25ab2ef]
  - @movement-labs/wallet-adapter-react@4.1.4

## 4.0.6

### Patch Changes

- @movement-labs/wallet-adapter-react@4.1.3

## 4.0.5

### Patch Changes

- @movement-labs/wallet-adapter-react@4.1.2

## 4.0.4

### Patch Changes

- Updated dependencies [6520e32]
  - @movement-labs/wallet-adapter-react@4.1.1

## 4.0.3

### Patch Changes

- Updated dependencies [f11ea12]
- Updated dependencies [e0107ac]
  - @movement-labs/wallet-adapter-react@4.1.0

## 4.0.2

### Patch Changes

- @movement-labs/wallet-adapter-react@4.0.2

## 4.0.1

### Patch Changes

- @movement-labs/wallet-adapter-react@4.0.1

## 4.0.0

### Major Changes

- ce53a2b: Major upgrade to only support AIP-62 standard compatible wallets

### Patch Changes

- Updated dependencies [ce53a2b]
  - @movement-labs/wallet-adapter-react@4.0.0

## 3.1.0

### Minor Changes

- 99dc712: Bump package versions

### Patch Changes

- Updated dependencies [99dc712]
  - @movement-labs/wallet-adapter-react@3.8.0

## 3.0.25

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.11

## 3.0.24

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.10

## 3.0.23

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.9

## 3.0.22

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.8

## 3.0.21

### Patch Changes

- ca1dc8e: Bump all packages version to fix broken previous version
- Updated dependencies [ca1dc8e]
  - @movement-labs/wallet-adapter-react@3.7.7

## 3.0.20

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.6

## 3.0.19

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.5

## 3.0.18

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.4

## 3.0.17

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.3

## 3.0.16

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.2

## 3.0.15

### Patch Changes

- @movement-labs/wallet-adapter-react@3.7.1

## 3.0.14

### Patch Changes

- Updated dependencies [e252fce]
  - @movement-labs/wallet-adapter-react@3.7.0

## 3.0.13

### Patch Changes

- @movement-labs/wallet-adapter-react@3.6.2

## 3.0.12

### Patch Changes

- @movement-labs/wallet-adapter-react@3.6.1

## 3.0.11

### Patch Changes

- Updated dependencies [a2391db]
  - @movement-labs/wallet-adapter-react@3.6.0

## 3.0.10

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.10

## 3.0.9

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.9

## 3.0.8

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.8

## 3.0.7

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.7

## 3.0.6

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.6

## 3.0.5

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.5

## 3.0.4

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.4

## 3.0.3

### Patch Changes

- Updated dependencies [91fe52c]
  - @movement-labs/wallet-adapter-react@3.5.3

## 3.0.2

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.2

## 3.0.1

### Patch Changes

- @movement-labs/wallet-adapter-react@3.5.1

## 3.0.0

### Major Changes

- 96df1f7: Renamed `sortDefaultWallets` prop to `sortAvailableWallets` and `sortMoreWallets` prop to `sortInstallableWallets`. Also added `sortMovementConnectWallets` prop.

### Minor Changes

- 96df1f7: Added Movement Connect education screens to the wallet selector modal.

### Patch Changes

- Updated dependencies [96df1f7]
- Updated dependencies [f23cf43]
  - @movement-labs/wallet-adapter-react@3.5.0

## 2.6.3

### Patch Changes

- @movement-labs/wallet-adapter-react@3.4.3

## 2.6.2

### Patch Changes

- Updated dependencies [cbbbe23]
  - @movement-labs/wallet-adapter-react@3.4.2

## 2.6.1

### Patch Changes

- Updated dependencies [0bdbb0d]
  - @movement-labs/wallet-adapter-react@3.4.1

## 2.6.0

### Minor Changes

- 6bec234: Added privacy policy disclaimer below Movement Connect login options.

### Patch Changes

- Updated dependencies [6bec234]
  - @movement-labs/wallet-adapter-react@3.4.0

## 2.5.0

### Minor Changes

- 9f0d3de: Updated wallet selector modal to new design for Movement Connect.
- 9f0d3de: Added `sortDefaultWallets` and `sortMoreWallets` props for controlling the order of wallets in the modal.

### Patch Changes

- @movement-labs/wallet-adapter-react@3.3.1

## 2.4.11

### Patch Changes

- Updated dependencies [07ee265]
  - @movement-labs/wallet-adapter-react@3.3.0

## 2.4.10

### Patch Changes

- Updated dependencies [2e9b7df]
  - @movement-labs/wallet-adapter-react@3.2.0

## 2.4.9

### Patch Changes

- @movement-labs/wallet-adapter-react@3.1.1

## 2.4.8

### Patch Changes

- Updated dependencies [2e9c156]
- Updated dependencies [2e9c156]
- Updated dependencies [2e9c156]
  - @movement-labs/wallet-adapter-react@3.1.0

## 2.4.7

### Patch Changes

- @movement-labs/wallet-adapter-react@3.0.7

## 2.4.6

### Patch Changes

- @movement-labs/wallet-adapter-react@3.0.6

## 2.4.5

### Patch Changes

- @movement-labs/wallet-adapter-react@3.0.5

## 2.4.4

### Patch Changes

- @movement-labs/wallet-adapter-react@3.0.4

## 2.4.3

### Patch Changes

- @movement-labs/wallet-adapter-react@3.0.3

## 2.4.2

### Patch Changes

- 6e152e4: Revert Support account prop to be of AIP-62 AccountInfo type
- Updated dependencies [6e152e4]
  - @movement-labs/wallet-adapter-react@3.0.2

## 2.4.1

### Patch Changes

- @movement-labs/wallet-adapter-react@3.0.1

## 2.4.0

### Minor Changes

- 2c826a4: Support account prop to be of AIP-62 AccountInfo type

### Patch Changes

- Updated dependencies [2c826a4]
  - @movement-labs/wallet-adapter-react@3.0.0

## 2.3.2

### Patch Changes

- @movement-labs/wallet-adapter-react@2.5.1

## 2.3.1

### Patch Changes

- Updated dependencies [4832532]
  - @movement-labs/wallet-adapter-react@2.5.0

## 2.3.0

### Minor Changes

- ef53f38: AIP-62 standard compatible wallet registry list

### Patch Changes

- Updated dependencies [ef53f38]
  - @movement-labs/wallet-adapter-react@2.4.0

## 2.2.6

### Patch Changes

- @movement-labs/wallet-adapter-react@2.3.7

## 2.2.5

### Patch Changes

- Updated dependencies [92a1801]
- Updated dependencies [106d55c]
  - @movement-labs/wallet-adapter-react@2.3.6

## 2.2.4

### Patch Changes

- @movement-labs/wallet-adapter-react@2.3.5

## 2.2.3

### Patch Changes

- @movement-labs/wallet-adapter-react@2.3.4

## 2.2.2

### Patch Changes

- @movement-labs/wallet-adapter-react@2.3.3

## 2.2.1

### Patch Changes

- @movement-labs/wallet-adapter-react@2.3.2

## 2.2.0

### Minor Changes

- 41f9485: Implement GA4

### Patch Changes

- @movement-labs/wallet-adapter-react@2.3.1

## 2.1.0

### Minor Changes

- 4d6e2f6: Add AIP-62 wallet standard support

### Patch Changes

- Updated dependencies [4d6e2f6]
  - @movement-labs/wallet-adapter-react@2.2.0

## 2.0.0

### Major Changes

- 31e0084: Support TypeScript SDK V2. Fully compatible with existing SDK V1 and Wallet Adapter V1
  but with a full SDK V2 support for the dapp.
  - Add support for SDK V2 input types
  - `signAndSubmitTransaction()` accept only SDK V2 transaction input type
  - Implement a `submitTransaction()` function for multi signers transactions
  - `signTransaction()` to support both SDK V1 and V2 versions
  - Convert wallet `SignedTransaction` response from `signTransaction()` to TS SDK V2 `AccountAuthenticator`
  - Demo app to demonstrate different trnsaction flows - single signer, sponsor and multi agent transactions
  - Reject promise on core and/or provider errors instead of just returning `false`
  - Use `@movement-labs/ts-sdk@experimental` version `0.0.7`

### Patch Changes

- Updated dependencies [31e0084]
  - @movement-labs/wallet-adapter-react@2.0.0

## 1.2.7

### Patch Changes

- dd6e1ed: Moves dependencies to peer dependencies as needed
- Updated dependencies [7acfa69]
- Updated dependencies [dd6e1ed]
  - @movement-labs/wallet-adapter-react@1.4.0

## 1.2.5

### Patch Changes

- 7e314e5: Update aptos dependency
- Updated dependencies [7e314e5]
  - @movement-labs/wallet-adapter-react@1.3.2

## 1.2.4

### Patch Changes

- @movement-labs/wallet-adapter-react@1.3.1

## 1.2.3

### Patch Changes

- Updated dependencies [3834890]
  - @movement-labs/wallet-adapter-react@1.3.0

## 1.2.2

### Patch Changes

- a42a197: add action to control modal open or not

## 1.2.1

### Patch Changes

- ae47ccd: give wallet adapter ant design modal higher zindex to make sure it always shows up on screen

## 1.2.0

### Minor Changes

- 927cfc6: Add an optional prop for WalletSelector to handle modal open

## 1.1.3

### Patch Changes

- Updated dependencies [dc98bf4]
  - @movement-labs/wallet-adapter-react@1.2.3

## 1.1.2

### Patch Changes

- Updated dependencies [22ecf6a]
- Updated dependencies [e4b06de]
  - @movement-labs/wallet-adapter-react@1.2.2

## 1.1.1

### Patch Changes

- @movement-labs/wallet-adapter-react@1.2.1

## 1.1.0

### Minor Changes

- 1672a0e: Add mobile wallet support on Ant Design wallet selector modal

## 1.0.6

### Patch Changes

- Updated dependencies [1605d28]
  - @movement-labs/wallet-adapter-react@1.2.0

## 1.0.5

### Patch Changes

- Updated dependencies [d8d5a8a]
  - @movement-labs/wallet-adapter-react@1.1.0

## 1.0.4

### Patch Changes

- @movement-labs/wallet-adapter-react@1.0.6

## 1.0.3

### Patch Changes

- Updated dependencies [56a3f9f]
  - @movement-labs/wallet-adapter-react@1.0.5

## 1.0.2

### Patch Changes

- Updated dependencies [8dea640]
  - @movement-labs/wallet-adapter-react@1.0.4

## 1.0.1

### Patch Changes

- 03eb0f5: Define core package version to use
- Updated dependencies [03eb0f5]
  - @movement-labs/wallet-adapter-react@1.0.3

## 1.0.0

### Major Changes

- e10ea7b: Add ANS support

## 0.1.1

### Patch Changes

- 7498973: Support Loadable wallet for ant-design and export NetworkName
- Updated dependencies [7498973]
  - @movement-labs/wallet-adapter-react@0.2.3

## 0.1.0

### Minor Changes

- 8124d54: Create wallet selector modal with ant design
