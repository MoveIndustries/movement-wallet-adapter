import {
  GasStationClient,
  GasStationTransactionSubmitter,
} from "@movement-labs/gas-station-client";
import { Network } from "@movement-labs/ts-sdk";

const network = Network.TESTNET;
const gasStationClient = new GasStationTransactionSubmitter(
  new GasStationClient({
    network,
    apiKey: process.env.NEXT_PUBLIC_GAS_STATION_API_KEY,
  }),
);

export const getTransactionSubmitter = (): GasStationTransactionSubmitter => {
  return gasStationClient;
};
