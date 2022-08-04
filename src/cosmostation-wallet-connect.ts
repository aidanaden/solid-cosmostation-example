import { Setter } from "solid-js";
import CosmostationQRCodeModal from "@walletconnect/qrcode-modal";
import WalletConnect from "@walletconnect/client";
import { payloadId } from "@walletconnect/utils";

export async function connect(isMobile: boolean, setWCUri: Setter<string>) {
  const wcLogoURI = "/osmosis-logo-wc.png";
  const connector = new WalletConnect({
    bridge: "https://bridge.walletconnect.org",
    signingMethods: [
      "cosmostation_wc_accounts_v1",
      "cosmostation_wc_sign_tx_v1",
    ],
    qrcodeModal: {
      open: (uri: string, cb: any) => {
        if (!isMobile) {
          CosmostationQRCodeModal.open(uri, cb);
        }
        setWCUri(uri);
        // TODO: set cb as ref to be called when WC modal closes
      },
      close: () => {
        setWCUri("");
        CosmostationQRCodeModal.close();
      },
    },
  });

  // XXX: I don't know why they designed that the client meta options in the constructor should be always ingored...
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  connector._clientMeta = {
    name: "Coinhall",
    description:
      "Coinhall provides prices, charts, swap aggregations and analytics in realtime for Terra, Juno, and Cosmos chains.",
    url: "https://coinhall.org/",
    icons: wcLogoURI
      ? [
          // Keplr mobile app can't show svg image.
          window.location.origin + wcLogoURI,
        ]
      : [],
  };

  if (connector.connected) {
    await connector.killSession();
  }
  await connector.createSession();
  return connector;
}

export function getAccountsRequest(chainIds: string[]) {
  return {
    id: payloadId(),
    jsonrpc: "2.0",
    method: "cosmostation_wc_accounts_v1",
    params: chainIds,
  };
}

// export function getSignTxRequest(chainId: string, signer, signDoc) {
//   return {
//     id: payloadId(),
//     jsonrpc: "2.0",
//     method: "cosmostation_wc_sign_tx_v1",
//     params: [chainId, signer, signDoc],
//   };
// }

const cosmostationWalletConnect = {
  connect,
  getAccountsRequest,
  // getSignTxRequest,
};

export default cosmostationWalletConnect;
