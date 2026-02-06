// TODO: Re-enable Aptos Connect / Social Sign-In when Movement has this functionality
// import {
//   AptosConnectAppleWallet,
//   AptosConnectGoogleWallet,
// } from "@aptos-connect/wallet-adapter-plugin";
import { DappConfig, AdapterWallet } from "./WalletCore";

export function getSDKWallets(dappConfig?: DappConfig) {
  const sdkWallets: AdapterWallet[] = [];

  // TODO: Re-enable social sign-in (Aptos Connect / Petra Web) when Movement supports it
  // Need to check window is defined for AptosConnect
  // Note: Type cast required because @aptos-connect uses Aptos types while we use Movement types.
  // The underlying structure is compatible.
  // if (typeof window !== "undefined") {
  //   sdkWallets.push(
  //     new AptosConnectGoogleWallet({
  //       network: dappConfig?.network,
  //       dappId: dappConfig?.movementConnectDappId,
  //       ...dappConfig?.movementConnect,
  //     }) as unknown as AdapterWallet,
  //     new AptosConnectAppleWallet({
  //       network: dappConfig?.network,
  //       dappId: dappConfig?.movementConnectDappId,
  //       ...dappConfig?.movementConnect,
  //     }) as unknown as AdapterWallet,
  //   );
  // }

  // Add new SDK wallet plugins (ones that should be installed as packages) here:
  // Ex. sdkWallets.push(new YourSDKWallet(dappConfig))

  return sdkWallets;
}
