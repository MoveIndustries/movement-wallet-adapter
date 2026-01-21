import {
  MovementConnectAppleWallet,
  MovementConnectGoogleWallet,
} from "@movement-connect/wallet-adapter-plugin";
import { DappConfig, AdapterWallet } from "./WalletCore";

export function getSDKWallets(dappConfig?: DappConfig) {
  const sdkWallets: AdapterWallet[] = [];

  // Need to check window is defined for MovementConnect
  if (typeof window !== "undefined") {
    sdkWallets.push(
      new MovementConnectGoogleWallet({
        network: dappConfig?.network,
        dappId: dappConfig?.movementConnectDappId,
        ...dappConfig?.movementConnect,
      }),
      new MovementConnectAppleWallet({
        network: dappConfig?.network,
        dappId: dappConfig?.movementConnectDappId,
        ...dappConfig?.movementConnect,
      }),
    );
  }

  // Add new SDK wallet plugins (ones that should be installed as packages) here:
  // Ex. sdkWallets.push(new YourSDKWallet(dappConfig))

  return sdkWallets;
}
