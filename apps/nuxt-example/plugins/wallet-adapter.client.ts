import { Network } from "@moveindustries/ts-sdk";

export default defineNuxtPlugin({
  name: "walletAdapter",
  async setup(_NuxtApp) {
    const dappConfig = {
      network: Network.TESTNET,
    };

    return {
      provide: {
        dappConfig,
      },
    };
  },
});
