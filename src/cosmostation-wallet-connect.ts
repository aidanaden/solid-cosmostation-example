import CosmostationQRCodeModal from "@walletconnect/qrcode-modal";
import WalletConnect from "@walletconnect/client";
import { payloadId } from "@walletconnect/utils";
import { Setter } from "solid-js";

export async function connect(isMobile: boolean, setWCUri: Setter<string>) {
  const connector = new WalletConnect({
    bridge: "https://bridge.walletconnect.org",
    signingMethods: [
      "cosmostation_wc_accounts_v1",
      "cosmostation_wc_sign_tx_v1",
    ],
    qrcodeModal: {
      open: (uri: string, cb: any) => {
        if (isMobile) {
          CosmostationQRCodeModal.open(uri, cb);
        }
        setWCUri(uri);
      },
      close: () => {
        setWCUri("");
        CosmostationQRCodeModal.close();
      },
    },
  });

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
