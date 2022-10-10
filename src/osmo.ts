import { AddChainParams } from "@cosmostation/extension-client/types/message";

const osmoChainInfo: AddChainParams = {
  chainId: "osmosis-1",
  chainName: "osmo",
  restURL: "https://lcd-osmosis.blockapsis.com",
  baseDenom: "uosmo",
  displayDenom: "OSMO",
  decimals: 6,
  addressPrefix: "osmo",
  coinGeckoId: "osmosis",
};

export default osmoChainInfo;
