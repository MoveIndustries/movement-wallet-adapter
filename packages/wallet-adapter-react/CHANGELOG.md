# @movement-labs/wallet-adapter-react

## 7.4.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [1eae1bf]
  - @moveindustries/wallet-adapter-core@7.10.0

## 7.3.1

### Patch Changes

- Updated dependencies
  - @moveindustries/wallet-adapter-core@7.9.1

## 7.2.2

### Patch Changes

- Updated dependencies [2695a5d]
  - @movement-labs/wallet-adapter-core@7.8.0

## 7.2.1

### Patch Changes

- 19e7e2a: Deprecate aptos connect functions and constants in favor of petra web
- Updated dependencies [19e7e2a]
  - @movement-labs/wallet-adapter-core@7.7.1

## 7.2.0

### Minor Changes

- d2d308c: Bump @aptos-connect/wallet-adapter-plugin to 2.7.0
- b3474b3: Update AC dns to web.petra.app
- 499e03e: Rename aptos connect to petra web

### Patch Changes

- Updated dependencies [d2d308c]
- Updated dependencies [b3474b3]
- Updated dependencies [499e03e]
  - @movement-labs/wallet-adapter-core@7.7.0

## 7.1.3

### Patch Changes

- Updated dependencies [1c631ee]
- Updated dependencies [7407a71]
  - @movement-labs/wallet-adapter-core@7.6.0

## 7.1.2

### Patch Changes

- Updated dependencies [8c935c8]
  - @movement-labs/wallet-adapter-core@7.5.1

## 7.1.1

### Patch Changes

- Updated dependencies [3d5d42b]
  - @movement-labs/wallet-adapter-core@7.5.0

## 7.1.0

### Minor Changes

- e554d03: Upgrade underlying dependencies for the wallet adapter

### Patch Changes

- Updated dependencies [02b3abc]
- Updated dependencies [911f353]
- Updated dependencies [e554d03]
- Updated dependencies [4ddaeaa]
  - @movement-labs/wallet-adapter-core@7.4.0

## 7.0.7

### Patch Changes

- Updated dependencies [c066004]
  - @movement-labs/wallet-adapter-core@7.3.0

## 7.0.6

### Patch Changes

- Updated dependencies [b6b9fc8]
  - @movement-labs/wallet-adapter-core@7.2.0

## 7.0.5

### Patch Changes

- Updated dependencies [545b26d]
  - @movement-labs/wallet-adapter-core@7.1.2

## 7.0.4

### Patch Changes

- Updated dependencies [8ca938e]
  - @movement-labs/wallet-adapter-core@7.1.1

## 7.0.3

### Patch Changes

- Updated dependencies [dfa6eb3]
  - @movement-labs/wallet-adapter-core@7.1.0

## 7.0.2

### Patch Changes

- Updated dependencies [6605dd6]
  - @movement-labs/wallet-adapter-core@7.0.0

## 7.0.1

### Patch Changes

- Updated dependencies [fd7f880]
  - @movement-labs/wallet-adapter-core@6.0.1

## 7.0.0

### Major Changes

- b80eff6: Add support for transactionSubmitter, bump minimum TS SDK version to 3.x.x

### Patch Changes

- Updated dependencies [b80eff6]
  - @movement-labs/wallet-adapter-core@6.0.0

## 6.2.0

### Minor Changes

- fae2bf0: Bump @movement-labs/wallet-standard to 0.5.0 which removes the `message` and `signingMessage` fields from the `AptosSignInInput` of the `signIn` request.

### Patch Changes

- Updated dependencies [fae2bf0]
  - @movement-labs/wallet-adapter-core@5.8.0

## 6.1.2

### Patch Changes

- Updated dependencies [aad3b8d]
  - @movement-labs/wallet-adapter-core@5.7.1

## 6.1.1

### Patch Changes

- Updated dependencies [1a4ed58]
  - @movement-labs/wallet-adapter-core@5.7.0

## 6.1.0

### Minor Changes

- 8675c83: Remove derived wallet packages peer dependecies

### Patch Changes

- Updated dependencies [1a5571b]
- Updated dependencies [17d3f27]
- Updated dependencies [e097767]
  - @movement-labs/wallet-adapter-core@5.6.0

## 6.0.4

### Patch Changes

- Updated dependencies [e2d66c4]
  - @movement-labs/wallet-adapter-core@5.5.1

## 6.0.3

### Patch Changes

- Updated dependencies [63f5cf7]
  - @movement-labs/derived-wallet-ethereum@0.2.2

## 6.0.2

### Patch Changes

- Updated dependencies [69f2846]
- Updated dependencies [69f2846]
  - @movement-labs/wallet-adapter-core@5.5.0

## 6.0.1

### Patch Changes

- Updated dependencies [33d0055]
- Updated dependencies [a64a658]
  - @movement-labs/derived-wallet-ethereum@0.2.1
  - @movement-labs/derived-wallet-solana@0.2.5
  - @movement-labs/wallet-adapter-core@5.4.2

## 6.0.0

### Patch Changes

- Updated dependencies [476003f]
- Updated dependencies [1b67719]
- Updated dependencies [476003f]
  - @movement-labs/derived-wallet-solana@0.2.4
  - @movement-labs/derived-wallet-ethereum@0.2.0

## 5.0.5

### Patch Changes

- Updated dependencies [cdcec83]
  - @movement-labs/wallet-adapter-core@5.4.1

## 5.0.4

### Patch Changes

- Updated dependencies [c62ccb7]
- Updated dependencies [3effbab]
  - @movement-labs/derived-wallet-ethereum@0.1.3
  - @movement-labs/derived-wallet-solana@0.2.3

## 5.0.3

### Patch Changes

- Updated dependencies [255400a]
  - @movement-labs/derived-wallet-solana@0.2.2

## 5.0.2

### Patch Changes

- Updated dependencies [613e592]
- Updated dependencies [1779749]
  - @movement-labs/wallet-adapter-core@5.4.0
  - @movement-labs/derived-wallet-solana@0.2.1

## 5.0.1

### Patch Changes

- Updated dependencies [2ab3a0c]
- Updated dependencies [f4a423b]
- Updated dependencies [6d7b28c]
  - @movement-labs/wallet-adapter-core@5.3.0

## 5.0.0

### Minor Changes

- ad3b6bb: Introduce x chain wallets logic in the react adapter provider

### Patch Changes

- Updated dependencies [8a2b3b6]
- Updated dependencies [ad3b6bb]
  - @movement-labs/derived-wallet-ethereum@0.1.2
  - @movement-labs/derived-wallet-solana@0.2.0
  - @movement-labs/wallet-adapter-core@5.2.0

## 4.1.5

### Patch Changes

- 8fea651: Add React version 19 to the wallet-adapter-react peer dependencies list
- Updated dependencies [6bfd2fb]
  - @movement-labs/wallet-adapter-core@5.1.4

## 4.1.4

### Patch Changes

- 25ab2ef: Allow users to perform connections when the wallet is `_connected` but `_account` is `null`
- Updated dependencies [25ab2ef]
  - @movement-labs/wallet-adapter-core@5.1.3

## 4.1.3

### Patch Changes

- Updated dependencies [6a5737a]
  - @movement-labs/wallet-adapter-core@5.1.2

## 4.1.2

### Patch Changes

- Updated dependencies [3b5f4cf]
  - @movement-labs/wallet-adapter-core@5.1.1

## 4.1.1

### Patch Changes

- 6520e32: Fix WalletProvider setting `isLoading` to `false` prematurely when `autoConnect` is enabled

## 4.1.0

### Minor Changes

- f11ea12: Add support for aptos:signIn feature

### Patch Changes

- e0107ac: Add support for async functions in `WalletProvider`'s `autoConnect` prop
- Updated dependencies [f11ea12]
  - @movement-labs/wallet-adapter-core@5.1.0

## 4.0.2

### Patch Changes

- Updated dependencies [62d860d]
  - @movement-labs/wallet-adapter-core@5.0.2

## 4.0.1

### Patch Changes

- Updated dependencies [792dadf]
  - @movement-labs/wallet-adapter-core@5.0.1

## 4.0.0

### Major Changes

- ce53a2b: Major upgrade to only support AIP-62 standard compatible wallets

### Patch Changes

- Updated dependencies [ce53a2b]
  - @movement-labs/wallet-adapter-core@5.0.0

## 3.8.0

### Minor Changes

- 99dc712: Bump package versions

### Patch Changes

- Updated dependencies [c2de332]
- Updated dependencies [99dc712]
  - @movement-labs/wallet-adapter-core@4.25.0

## 3.7.11

### Patch Changes

- Updated dependencies [b8cae2d]
  - @movement-labs/wallet-adapter-core@4.24.0

## 3.7.10

### Patch Changes

- Updated dependencies [31fe032]
  - @movement-labs/wallet-adapter-core@4.23.1

## 3.7.9

### Patch Changes

- Updated dependencies [80a3c8a]
  - @movement-labs/wallet-adapter-core@4.23.0

## 3.7.8

### Patch Changes

- Updated dependencies [af7c080]
  - @movement-labs/wallet-adapter-core@4.22.2

## 3.7.7

### Patch Changes

- ca1dc8e: Bump all packages version to fix broken previous version
- Updated dependencies [ca1dc8e]
  - @movement-labs/wallet-adapter-core@4.22.1

## 3.7.6

### Patch Changes

- Updated dependencies
  - @movement-labs/wallet-adapter-core@4.22.0

## 3.7.5

### Patch Changes

- Updated dependencies [6915184]
- Updated dependencies
  - @movement-labs/wallet-adapter-core@4.21.0

## 3.7.4

### Patch Changes

- Updated dependencies [f5ba2f2]
  - @movement-labs/wallet-adapter-core@4.20.0

## 3.7.3

### Patch Changes

- Updated dependencies [66ad437]
  - @movement-labs/wallet-adapter-core@4.19.0

## 3.7.2

### Patch Changes

- Updated dependencies [737bd2b]
- Updated dependencies [f9ecf18]
  - @movement-labs/wallet-adapter-core@4.18.1

## 3.7.1

### Patch Changes

- Updated dependencies [67440bf]
- Updated dependencies [bde8112]
  - @movement-labs/wallet-adapter-core@4.18.0

## 3.7.0

### Minor Changes

- e252fce: Add support for a dapp generated api key

### Patch Changes

- Updated dependencies [d348384]
- Updated dependencies [e252fce]
- Updated dependencies [bd54d77]
  - @movement-labs/wallet-adapter-core@4.17.0

## 3.6.2

### Patch Changes

- Updated dependencies [3795c56]
  - @movement-labs/wallet-adapter-core@4.16.0

## 3.6.1

### Patch Changes

- Updated dependencies [3419043]
- Updated dependencies [ee95b8b]
  - @movement-labs/wallet-adapter-core@4.15.1

## 3.6.0

### Minor Changes

- a2391db: Support a boolean flag to disable the adapter telemetry tool

### Patch Changes

- Updated dependencies [a2391db]
- Updated dependencies [92f7187]
  - @movement-labs/wallet-adapter-core@4.15.0

## 3.5.10

### Patch Changes

- Updated dependencies [0e37588]
- Updated dependencies [4240f8b]
  - @movement-labs/wallet-adapter-core@4.14.0

## 3.5.9

### Patch Changes

- Updated dependencies [754f6e1]
- Updated dependencies [754f6e1]
  - @movement-labs/wallet-adapter-core@4.13.2

## 3.5.8

### Patch Changes

- Updated dependencies [ae2351b]
  - @movement-labs/wallet-adapter-core@4.13.1

## 3.5.7

### Patch Changes

- Updated dependencies [74f99d2]
- Updated dependencies [3d9ae51]
  - @movement-labs/wallet-adapter-core@4.13.0

## 3.5.6

### Patch Changes

- Updated dependencies [4fd4527]
  - @movement-labs/wallet-adapter-core@4.12.1

## 3.5.5

### Patch Changes

- Updated dependencies [d9ce63d]
  - @movement-labs/wallet-adapter-core@4.12.0

## 3.5.4

### Patch Changes

- Updated dependencies [0b7d07f]
  - @movement-labs/wallet-adapter-core@4.11.1

## 3.5.3

### Patch Changes

- 91fe52c: Corrected a typo in the last education screen of the `AboutMovementConnect` component.

## 3.5.2

### Patch Changes

- Updated dependencies [f1fb4a5]
  - @movement-labs/wallet-adapter-core@4.11.0

## 3.5.1

### Patch Changes

- Updated dependencies [249331f]
- Updated dependencies [6bfeb14]
- Updated dependencies [ed4f483]
  - @movement-labs/wallet-adapter-core@4.10.0

## 3.5.0

### Minor Changes

- 96df1f7: Added `AboutMovementConnect` headless component for building Movement Connect education screens.
- f23cf43: Fix adapter event communication

### Patch Changes

- Updated dependencies [96df1f7]
- Updated dependencies [f23cf43]
  - @movement-labs/wallet-adapter-core@4.9.0

## 3.4.3

### Patch Changes

- Updated dependencies [79a0212]
  - @movement-labs/wallet-adapter-core@4.8.2

## 3.4.2

### Patch Changes

- cbbbe23: Added Dapp id to dappConfig
- Updated dependencies [1644cfc]
- Updated dependencies [cbbbe23]
  - @movement-labs/wallet-adapter-core@4.8.1

## 3.4.1

### Patch Changes

- 0bdbb0d: Fixed the SVG attributes for the graphic of the Aptos logo.

## 3.4.0

### Minor Changes

- 6bec234: Added `AptosPrivacyPolicy` headless component for building the privacy policy disclaimer that should be displayed below Movement Connect login options.

## 3.3.1

### Patch Changes

- Updated dependencies [e3df2db]
- Updated dependencies [1580df8]
  - @movement-labs/wallet-adapter-core@4.8.0

## 3.3.0

### Minor Changes

- 07ee265: Support dappConfig user prop to set SDK wallets configuration

### Patch Changes

- Updated dependencies [07ee265]
  - @movement-labs/wallet-adapter-core@4.7.0

## 3.2.0

### Minor Changes

- 2e9b7df: Added `getMovementConnectWallets` utility function

### Patch Changes

- Updated dependencies [0672ff4]
  - @movement-labs/wallet-adapter-core@4.6.0

## 3.1.1

### Patch Changes

- Updated dependencies [c1a9f41]
  - @movement-labs/wallet-adapter-core@4.5.0

## 3.1.0

### Minor Changes

- 2e9c156: Added `partitionWallets`, `isInstalledOrLoadable`, `isInstallRequired`, and `truncateAddress` utility functions to make it easier to implement custom wallet selectors.
- 2e9c156: Added `WalletItem` headless component for implementing custom wallet selectors.

### Patch Changes

- 2e9c156: Fixed a bug where `WalletProvider` would not automatically attempt to reconnect the wallet when the `autoConnect` is set to true after the initial render.
- Updated dependencies [2e9c156]
  - @movement-labs/wallet-adapter-core@4.4.0

## 3.0.7

### Patch Changes

- Updated dependencies [79b1bf8]
- Updated dependencies [9566c50]
  - @movement-labs/wallet-adapter-core@4.3.0

## 3.0.6

### Patch Changes

- Updated dependencies [4db7a8d]
  - @movement-labs/wallet-adapter-core@4.2.1

## 3.0.5

### Patch Changes

- Updated dependencies [9f94e4d]
  - @movement-labs/wallet-adapter-core@4.2.0

## 3.0.4

### Patch Changes

- Updated dependencies [cc4021b]
- Updated dependencies [ec6cb0c]
  - @movement-labs/wallet-adapter-core@4.1.3

## 3.0.3

### Patch Changes

- Updated dependencies [1ff5230]
  - @movement-labs/wallet-adapter-core@4.1.2

## 3.0.2

### Patch Changes

- 6e152e4: Revert Support account prop to be of AIP-62 AccountInfo type
- Updated dependencies [6e152e4]
  - @movement-labs/wallet-adapter-core@4.1.1

## 3.0.1

### Patch Changes

- Updated dependencies [3ed84cd]
  - @movement-labs/wallet-adapter-core@4.1.0

## 3.0.0

### Major Changes

- 2c826a4: Support account prop to be of AIP-62 AccountInfo type

### Patch Changes

- Updated dependencies [2c826a4]
  - @movement-labs/wallet-adapter-core@4.0.0

## 2.5.1

### Patch Changes

- Updated dependencies [6a58c61]
  - @movement-labs/wallet-adapter-core@3.16.0

## 2.5.0

### Minor Changes

- 4832532: Wallets opt-in support

### Patch Changes

- Updated dependencies [4832532]
  - @movement-labs/wallet-adapter-core@3.15.0

## 2.4.0

### Minor Changes

- ef53f38: AIP-62 standard compatible wallet registry list

### Patch Changes

- Updated dependencies [69b6101]
- Updated dependencies [870ee0c]
- Updated dependencies [ef53f38]
  - @movement-labs/wallet-adapter-core@3.14.0

## 2.3.7

### Patch Changes

- Updated dependencies [19f4fdd]
  - @movement-labs/wallet-adapter-core@3.13.0

## 2.3.6

### Patch Changes

- 92a1801: Fixed the `useEffect` dependency array for auto-connecting to be `[wallets]` instead of `wallets`
- 106d55c: Export all Interfaces and types
- Updated dependencies [106d55c]
  - @movement-labs/wallet-adapter-core@3.12.1

## 2.3.5

### Patch Changes

- Updated dependencies [740e909]
- Updated dependencies [2cc2eb5]
- Updated dependencies [e46b930]
  - @movement-labs/wallet-adapter-core@3.12.0

## 2.3.4

### Patch Changes

- Updated dependencies [ec02b10]
  - @movement-labs/wallet-adapter-core@3.11.2

## 2.3.3

### Patch Changes

- Updated dependencies [55f9970]
  - @movement-labs/wallet-adapter-core@3.11.1

## 2.3.2

### Patch Changes

- Updated dependencies [245ce8d]
  - @movement-labs/wallet-adapter-core@3.11.0

## 2.3.1

### Patch Changes

- Updated dependencies [41f9485]
  - @movement-labs/wallet-adapter-core@3.10.0

## 2.3.0

### Minor Changes

- 444c708: Fix wallet detection

### Patch Changes

- Updated dependencies [6be2a06]
  - @movement-labs/wallet-adapter-core@3.9.0

## 2.2.1

### Patch Changes

- Updated dependencies [4127cfb]
  - @movement-labs/wallet-adapter-core@3.8.0

## 2.2.0

### Minor Changes

- 4d6e2f6: Add AIP-62 wallet standard support

### Patch Changes

- Updated dependencies [4d6e2f6]
  - @movement-labs/wallet-adapter-core@3.7.0

## 2.1.8

### Patch Changes

- Updated dependencies [8ebd4c7]
  - @movement-labs/wallet-adapter-core@3.6.0

## 2.1.7

### Patch Changes

- Updated dependencies [4ca4201]
  - @movement-labs/wallet-adapter-core@3.5.0

## 2.1.6

### Patch Changes

- Updated dependencies [e1e9eb2]
  - @movement-labs/wallet-adapter-core@3.4.0

## 2.1.5

### Patch Changes

- Updated dependencies [570cbda]
  - @movement-labs/wallet-adapter-core@3.3.0

## 2.1.4

### Patch Changes

- Updated dependencies [3f38c51]
  - @movement-labs/wallet-adapter-core@3.2.1

## 2.1.3

### Patch Changes

- Updated dependencies [12163ca]
- Updated dependencies [a6f0e46]
  - @movement-labs/wallet-adapter-core@3.2.0

## 2.1.2

### Patch Changes

- a1c08cc: Export missing InputTransactionData type

## 2.1.1

### Patch Changes

- 6266a29: Consolidate options argument on signAndSubmitTransaction
- Updated dependencies [6266a29]
  - @movement-labs/wallet-adapter-core@3.1.1

## 2.1.0

### Minor Changes

- aa3d15a: Make sender optional when sign and submit single signer transaction

### Patch Changes

- Updated dependencies [6257015]
- Updated dependencies [aa3d15a]
  - @movement-labs/wallet-adapter-core@3.1.0

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
  - @movement-labs/wallet-adapter-core@3.0.0

## 1.4.0

### Minor Changes

- 7acfa69: Adding support for the new Typescript SDK in the package `@movement-labs/ts-sdk`. The wallet adapter now supports submitting a basic transaction with the new SDK types.

### Patch Changes

- dd6e1ed: Moves dependencies to peer dependencies as needed
- Updated dependencies [7acfa69]
- Updated dependencies [dd6e1ed]
  - @movement-labs/wallet-adapter-core@2.6.0

## 1.3.2

### Patch Changes

- 7e314e5: Update aptos dependency
- Updated dependencies [7e314e5]
  - @movement-labs/wallet-adapter-core@2.5.1

## 1.3.1

### Patch Changes

- Updated dependencies [c95933a]
  - @movement-labs/wallet-adapter-core@2.5.0

## 1.3.0

### Minor Changes

- 3834890: Add an optional `onError` prop to error handle wallet callbacks

### Patch Changes

- Updated dependencies [d2a0bbd]
- Updated dependencies [b0586e8]
  - @movement-labs/wallet-adapter-core@2.4.0

## 1.2.3

### Patch Changes

- dc98bf4: fix sendAndSubmitTransaction params
- Updated dependencies [dc98bf4]
  - @movement-labs/wallet-adapter-core@2.3.3

## 1.2.2

### Patch Changes

- 22ecf6a: Throw `wallet already connected` error when trying to connect to an already connected wallet
- e4b06de: Await for wallet connect request before setting isLoading state
- Updated dependencies [22ecf6a]
  - @movement-labs/wallet-adapter-core@2.3.2

## 1.2.1

### Patch Changes

- Updated dependencies [06f334f]
  - @movement-labs/wallet-adapter-core@2.3.1

## 1.2.0

### Minor Changes

- 1605d28: Support ReadonlyArray of Wallets in MovementWalletAdapterProvider and WalletCore

### Patch Changes

- Updated dependencies [bb1595e]
- Updated dependencies [1605d28]
  - @movement-labs/wallet-adapter-core@2.3.0

## 1.1.0

### Minor Changes

- d8d5a8a: Support deeplink on React Provider and Nextjs demo app

## 1.0.6

### Patch Changes

- Updated dependencies [814939c]
  - @movement-labs/wallet-adapter-core@2.2.0

## 1.0.5

### Patch Changes

- 56a3f9f: BCS transaction support in react provider package

## 1.0.4

### Patch Changes

- 8dea640: Fix wallet adapter auto reconnect on page refresh
- Updated dependencies [50968c4]
- Updated dependencies [8dea640]
  - @movement-labs/wallet-adapter-core@2.1.0

## 1.0.3

### Patch Changes

- 03eb0f5: Define core package version to use

## 0.2.4

### Patch Changes

- e03f79c: Update Blocto and Martian package version and fix a minor autoConnect bug

## 0.2.3

### Patch Changes

- 7498973: Support Loadable wallet for ant-design and export NetworkName

## 0.2.2

### Patch Changes

- 552d255: Add react package as a dependency

## 0.2.1

### Patch Changes

- c3eb031: Export WalletReadyState enum from react package

## 0.2.0

### Minor Changes

- 6e53116: Add support to verify a signed message

### Patch Changes

- Updated dependencies [18a0429]
- Updated dependencies [42e29f6]
- Updated dependencies [576bb57]
- Updated dependencies [6e53116]
  - @movement-labs/wallet-adapter-core@0.2.0
