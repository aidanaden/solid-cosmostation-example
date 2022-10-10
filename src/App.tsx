import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  on,
  Setter,
} from "solid-js";
import {
  Card,
  InputGroup,
  Button,
  Form,
  Stack,
  Container,
} from "solid-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import {
  tendermint,
  InstallError,
  Tendermint,
} from "@cosmostation/extension-client";
import { isMobile } from "@walletconnect/browser-utils";
import cosmostationWalletConnect from "./cosmostation-wallet-connect";
import WalletConnect from "@walletconnect/client";
import CosmostationQRCodeModal from "@walletconnect/qrcode-modal";
import WalletConnectModal from "./WalletConnectModal";
import {
  RequestAccountResponse,
  SignAminoDoc,
} from "@cosmostation/extension-client/types/message";
import junoChainInfo from "./juno";
import { AccountData, Coin, coin } from "@cosmjs/amino";
import {
  OsmosisApiClient,
  prettyPool,
  getPricesFromCoinGecko,
  makePoolsPretty,
  displayUnitsToDenomUnits,
  CoinValue,
  convertCoinToDisplayValues,
  getPrice,
  makePoolPairs,
  lookupRoutesForTrade,
  calculateAmountWithSlippage,
  messages,
  signAndBroadcast,
} from "@cosmology/core";
import { Long } from "@osmonauts/helpers";
import {
  BroadcastTxResponse,
  estimateOsmoFee,
  getSigningOsmosisClient,
} from "osmojs";
import osmoChainInfo from "./osmo";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";

export const printOsmoTransactionResponse = (res: BroadcastTxResponse) => {
  if (res.code === 0) {
    console.log(
      `TX: https://www.mintscan.io/osmosis/txs/${res.transactionHash}`
    );
  } else {
    console.log(res.rawLog);
    console.log(
      `TX: https://www.mintscan.io/osmosis/txs/${res.transactionHash}`
    );
  }
};

// const CHAIN_ID = "crescent-1";
// const LCD_ENDPOINT = "https://lcd-crescent.cosmostation.io";
// const TO_ADDRESS = "cre1x5wgh6vwye60wv3dtshs9dmqggwfx2ldhgluez";
// const DENOM = "ucre";
// const EXPLORER_LINK = "https://mintscan.io/crescent/txs";
// const CHAIN_NAME = "crescent";
// const DISPLAY_DENOM = "CRE";

const CHAIN_ID = "juno-1";
const LCD_ENDPOINT = "https://lcd-juno.keplr.app";
// const TO_ADDRESS = "cre1x5wgh6vwye60wv3dtshs9dmqggwfx2ldhgluez";
const DENOM = "ujuno";
const EXPLORER_LINK = "https://www.mintscan.io/juno/txs";
const CHAIN_NAME = "juno";
const DISPLAY_DENOM = "JUNO";

const OSMO_CHAIN_ID = "osmosis-1";
const OSMO_LCD_ENDPOINT = "https://lcd-osmosis-app.cosmostation.io";
const OSMO_RPC_ENDPOINT = "https://rpc.osmosis.zone";
const OSMO_TO_ADDRESS = "osmo1ze2ye5u5k3qdlexvt2e0nn0508p0409465lts4";
const OSMO_DENOM = "uosmo";
const OSMO_EXPLORER_LINK = "https://www.mintscan.io/osmo/txs";
const OSMO_CHAIN_NAME = "osmo";
const OSMO_DISPLAY_DENOM = "OSMO";

const App: Component = () => {
  // wc state values
  const [connector, setConnector] = createSignal<WalletConnect | undefined>(
    undefined
  );
  const [mobileConnected, setMobileConnected] = createSignal<boolean>(false);
  const [wcUri, setWcUri] = createSignal<string | undefined>(undefined);
  // const [account, setAccount] = createSignal<
  //   RequestAccountResponse | undefined
  // >();
  const [account, setAccount] = createSignal<AccountData | undefined>();

  // extension state values
  const [extensionConnector, setExtensionConnector] = createSignal<
    Tendermint | undefined
  >(undefined);
  const [extensionConnected, setExtensionConnected] = createSignal(false);

  const [walletAddress, setWalletAddress] = createSignal<string>("");
  const [walletBalance, setWalletBalance] = createSignal<string>("");
  const [offlineSigner, setOfflineSigner] = createSignal<OfflineSigner>();
  const [client, setClient] = createSignal<SigningStargateClient>();
  const [connectionType, setConnectionType] = createSignal<
    "extension" | "wallet-connect" | undefined
  >();
  const checkMobile = () => isMobile();

  let callbackClosed: (() => void) | undefined;

  async function connect(
    isMobile: boolean,
    setWCUri: Setter<string | undefined>,
    callbackClosed: (() => void) | undefined
  ) {
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
          callbackClosed = cb;
        },
        close: () => {
          setWCUri(undefined);
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
      icons: [],
    };

    return connector;
  }

  const mobileConnect = async () => {
    const wcConnector = await connect(checkMobile(), setWcUri, callbackClosed);

    if (wcConnector.connected) {
      await wcConnector.killSession();
    }
    await wcConnector.createSession();

    wcConnector.on("disconnect", async (error, payload) => {
      if (error) {
        console.error("error occurred on disconnect: ", error);
        return;
      }
      await mobileDisconnect();
    });

    wcConnector.on("connect", async (error, payload) => {
      if (error) {
        console.error("error occurred on disconnect: ", error);
        setMobileConnected(false);
        return;
      }
      await getAccounts(connector());
      setConnector(wcConnector);
      setConnectionType("wallet-connect");
      setMobileConnected(true);
    });
  };

  const mobileDisconnect = async () => {
    if (!connector()) {
      return;
    }

    if (callbackClosed) {
      callbackClosed();
    }

    await connector()
      ?.killSession()
      .catch((err) => console.error(err));

    setConnector(undefined);
    setMobileConnected(false);
  };

  // const debugConnect = async () => {
  //   const connector = await cosmostationWalletConnect.connect(true);
  //   setConnector(connector);
  //   connector.on("connect", (error, payload) => {
  //     if (error) {
  //       setConnected(false);
  //       throw error;
  //     }
  //     setConnected(true);
  //   });
  //   connector.on("disconnect", (error, payload) => {
  //     setConnected(false);
  //   });
  // };

  const getAccounts = async (connector: WalletConnect | undefined) => {
    // if wallet account already set, return
    if (account()) {
      return;
    }

    if (!connector || connector === undefined) {
      return;
    }

    const request = cosmostationWalletConnect.getAccountsRequest([
      osmoChainInfo.chainId,
    ]);

    try {
      // window.location.href = `cosmostation://wc`;
      const accounts = await connector.sendCustomRequest(request);
      const account = accounts[0];
      setAccount(account);
      setWalletAddress(account["bech32Address"]);
    } catch (err) {
      console.error(err);
      setAccount(undefined);
    }
  };

  const getExtensionSigner = (
    accountInfo: RequestAccountResponse,
    connector: Tendermint,
    chainName: string
  ) => {
    const signer: OfflineSigner = {
      getAccounts: async () => {
        return [
          {
            address: accountInfo.address,
            pubkey: accountInfo.publicKey,
            algo: "secp256k1",
          },
        ];
      },
      signAmino: async (_, signDoc) => {
        const response = await connector.signAmino(
          chainName,
          signDoc as unknown as SignAminoDoc
        );

        return {
          signed: response.signed_doc,
          signature: {
            pub_key: response.pub_key,
            signature: response.signature,
          },
        };
      },
      signDirect: async (_, signDoc) => {
        const response = await connector.signDirect(chainName, {
          account_number: String(signDoc.accountNumber),
          auth_info_bytes: signDoc.authInfoBytes,
          body_bytes: signDoc.bodyBytes,
          chain_id: signDoc.chainId,
        });
        return {
          signed: {
            accountNumber: response.signed_doc
              .account_number as unknown as Long,
            chainId: response.signed_doc.chain_id,
            authInfoBytes: response.signed_doc.auth_info_bytes,
            bodyBytes: response.signed_doc.body_bytes,
          },
          signature: {
            pub_key: response.pub_key,
            signature: response.signature,
          },
        };
      },
    };
    return signer;
  };

  const extensionConnect = async () => {
    try {
      console.log("trying to connect via tendermint()");
      const connector = await tendermint();
      setExtensionConnector(connector);
      const junoAccountInfo = await connector.requestAccount("juno-1");
      const osmoAccountInfo = await connector.requestAccount("osmosis");
      const osmoOfflineSigner = await getExtensionSigner(
        osmoAccountInfo,
        connector,
        "osmosis"
      );
      const walletInfo = {
        name: osmoAccountInfo.name,
        pubKey: osmoAccountInfo.publicKey,
      };
      const osmoClient = await getSigningOsmosisClient({
        rpcEndpoint: OSMO_RPC_ENDPOINT,
        signer: osmoOfflineSigner,
      });
      await getExtensionAccountSigner(osmoClient, osmoOfflineSigner);
      setOfflineSigner(osmoOfflineSigner);
      setClient(osmoClient);
      await getExtensionAccounts();
    } catch (err) {
      console.error(err);
      setExtensionConnected(false);
    }
  };

  const extensionDisconnect = () => {
    setExtensionConnector(undefined);
    setExtensionConnected(false);
  };

  async function getExtensionAccountSigner(
    client: SigningCosmWasmClient | SigningStargateClient | undefined,
    signer: OfflineSigner
  ) {
    if (client === undefined) {
      return;
    }

    const accounts = await signer.getAccounts();
    console.log("accounts: ", accounts);
    if (!accounts) {
      return;
    }
    const account = accounts[0];
    setAccount(account);
    const { address } = account;
    const balance = await client?.getBalance(address, osmoChainInfo.baseDenom);
    const formattedBalance: number =
      parseInt(balance?.amount as string) / 1000000;

    console.log({ address, formattedBalance });

    setWalletAddress(address);
    setWalletBalance(formattedBalance.toString());
    setExtensionConnected(true);
  }

  const getExtensionAccounts = async () => {
    try {
      const supportedChains = await extensionConnector()?.getSupportedChains();
      console.log("supportedchains: ", supportedChains);

      if (
        ![
          ...supportedChains!.official,
          ...supportedChains!.unofficial,
        ].includes(OSMO_CHAIN_NAME)
      ) {
        await extensionConnector()?.addChain({
          chainId: OSMO_CHAIN_ID,
          chainName: OSMO_CHAIN_NAME,
          addressPrefix: "osmo",
          baseDenom: OSMO_DENOM,
          displayDenom: OSMO_DISPLAY_DENOM,
          restURL: OSMO_LCD_ENDPOINT,
        });
      }

      const accountInfo = await extensionConnector()?.requestAccount(
        OSMO_CHAIN_NAME
      );

      setWalletAddress(accountInfo ? accountInfo.address : "");
      setExtensionConnected(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Init Osmosis account w/ desired connection type (wallet connect, extension)
  // if prev connected Keplr in this browser.
  onMount(async () => {
    let event: any;

    if (typeof localStorage === "undefined") {
      return;
    }

    if (typeof window === "undefined") {
      console.log("window is undefined, returning undefined...");
      return;
    }

    const value = localStorage.getItem("account_auto_connect_cosmostation");
    if (!value) {
      return;
    }

    if (value === "wallet-connect") {
      // if account auto connect method set to wallet-connect,
      // connect using wallet-connect
      const wcConnector = await connect(
        checkMobile(),
        setWcUri,
        callbackClosed
      );
      if (wcConnector.connected) {
        await getAccounts(wcConnector);
        setConnector(wcConnector);
        setConnectionType("wallet-connect");
        setMobileConnected(true);
      }
      return;
    } else {
      // otherwise, auto connect method is set to extension,
      // connect using extension
      event = await extensionConnect();
    }

    // if (isMobileDevice()) {
    //   // Force emit "select_wallet_connect" event if on mobile browser environment.
    //   await mobileConnect();
    // }

    onCleanup(() => {
      void (async () => {
        try {
          if (extensionConnected()) {
            extensionConnector()?.offAccountChanged(event);
          }

          if (mobileConnected()) {
            await connector()
              ?.killSession()
              .catch((e) => console.error(e));
          }
        } catch (e) {
          if (e instanceof InstallError) {
            // setIsExtensionNotInstalled(true);
            console.error("extension not installed");
          } else {
            console.error("failed to disconnect from extension: ", e);
          }
        }
      })();
    });
  });

  // React to changes in keplr account state; store desired connection type in browser
  // clear Keplr sessions, disconnect account.
  createEffect(
    on(
      [extensionConnected, mobileConnected],
      async ([extensionConnected, mobileConnected]) => {
        if (typeof localStorage === undefined) {
          return;
        }
        if (extensionConnected) {
          localStorage.setItem(
            "account_auto_connect_cosmostation",
            "extension"
          );
          return;
        }
        if (mobileConnected) {
          localStorage.setItem(
            "account_auto_connect_cosmostation",
            "wallet-connect"
          );
          return;
        }
      }
    )
  );

  const makeOsmoSwap = async () => {
    const api = new OsmosisApiClient({
      // url: osmoRpcEndpoint,
      url: "https://lcd-osmosis.blockapsis.com",
    });
    const lcdPools = await api.getPools();
    const pools = lcdPools.pools.map((pool) => prettyPool(pool));
    const prices = await getPricesFromCoinGecko();
    const prettyPools = makePoolsPretty(prices, lcdPools.pools);

    const tokenInDenomUnits = displayUnitsToDenomUnits(
      osmoChainInfo.displayDenom,
      "0.1"
    );
    const tokenInBase: Coin = {
      denom: osmoChainInfo.baseDenom,
      amount: tokenInDenomUnits,
    };
    const convertedCoinInValue: CoinValue = convertCoinToDisplayValues({
      prices,
      coin: tokenInBase,
    });

    const tokenOutDenomUnits = displayUnitsToDenomUnits("ATOM", "0.01");
    const tokenOutBase: Coin = {
      denom:
        "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      amount: tokenOutDenomUnits,
    };
    const convertedCoinOutValue: CoinValue = convertCoinToDisplayValues({
      prices,
      coin: tokenOutBase,
    });

    console.log({ convertedCoinInValue, convertedCoinOutValue });

    const tokenInPrice = getPrice(prices, convertedCoinInValue.symbol);
    const tokenOutPrice = getPrice(prices, convertedCoinOutValue.symbol);

    console.log({ tokenInPrice, tokenOutPrice });

    const pairs = makePoolPairs(prettyPools);
    const routes = lookupRoutesForTrade({
      // pools,
      trade: {
        sell: convertedCoinInValue,
        buy: convertedCoinOutValue,
        beliefValue: "",
      },
      pairs,
    }).map((tradeRoute) => {
      const { poolId, tokenOutDenom } = tradeRoute;
      return {
        poolId: poolId as unknown as Long,
        tokenOutDenom,
      };
    });

    const slippage = 0.5;
    const tokenOutMinAmount = parseInt(
      calculateAmountWithSlippage(convertedCoinOutValue.amount, slippage)
    ).toString();

    console.log({ routes });

    if (!walletAddress()) {
      console.log("account address is null");
      return;
    }

    console.log(
      `token in: ${convertedCoinInValue.amount} token out: ${convertedCoinOutValue.amount} token out min: ${tokenOutMinAmount}`
    );

    const msg = messages.swapExactAmountIn({
      sender: walletAddress(), // osmo address
      routes: routes, // TradeRoute
      tokenIn: coin(
        parseInt(convertedCoinInValue.amount),
        convertedCoinInValue.denom
      ), // Coin
      tokenOutMinAmount, // number as string with no decimals
    });

    if (!client() || client() === undefined) {
      console.log("osmo client is null");
      return;
    }

    const fee = await estimateOsmoFee(client()!, walletAddress(), [msg], "");
    console.log({ msg, fee });

    const res = await signAndBroadcast({
      client: client()!,
      chainId: OSMO_CHAIN_ID,
      address: walletAddress(),
      msg,
      fee,
      memo: "",
    });

    console.log({ res });
    printOsmoTransactionResponse(res);
  };

  return (
    <>
      <Container>
        <div class="row">
          <div class="col p-5">
            <img
              src="keplr-logo.png"
              alt=""
              style={{ maxWidth: "200px", margin: "auto", display: "block" }}
            />
          </div>
        </div>
        <Stack gap={5}>
          <Show
            when={checkMobile()}
            fallback={
              <Show
                when={!!extensionConnected()}
                fallback={
                  <Card>
                    <Card.Header>Connect cosmostation wallet</Card.Header>
                    <Card.Body>
                      <Button
                        type="submit"
                        variant="primary"
                        // onClick={() => openWallet(junoChainInfo)
                        onClick={extensionConnect}
                      >
                        Connect cosmostation via extension
                      </Button>
                    </Card.Body>
                  </Card>
                }
              >
                <Card>
                  <Card.Header>
                    Disconnect cosmostation via extension
                  </Card.Header>
                  <Card.Body>
                    <Button
                      type="submit"
                      variant="primary"
                      // onClick={() => openWallet(junoChainInfo)}
                      onClick={extensionDisconnect}
                    >
                      Disconnect
                    </Button>
                  </Card.Body>
                </Card>
              </Show>
            }
          >
            <Show
              when={!!mobileConnected()}
              fallback={
                <Card>
                  <Card.Header>Connect cosmostation wallet</Card.Header>
                  <Card.Body>
                    <Button
                      type="submit"
                      variant="primary"
                      // onClick={() => openWallet(junoChainInfo)
                      onClick={extensionConnect}
                    >
                      Connect cosmostation via walletconnect
                    </Button>
                  </Card.Body>
                </Card>
              }
            >
              <Card>
                <Card.Header>
                  Disconnect cosmostation via walletconnect
                </Card.Header>
                <Card.Body>
                  <Button
                    type="submit"
                    variant="primary"
                    // onClick={() => openWallet(junoChainInfo)}
                    onClick={mobileDisconnect}
                  >
                    Disconnect
                  </Button>
                </Card.Body>
              </Card>
            </Show>
          </Show>
          <Card>
            <Card.Header>Get cosmostation wallet address</Card.Header>
            <Card.Body>
              <Button
                type="submit"
                variant="primary"
                onClick={() =>
                  alert(
                    `wallet address: ${walletAddress()} balance: ${walletBalance()}`
                  )
                }
              >
                Get address
              </Button>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header>Sign something on Juno</Card.Header>
            <Card.Body>
              <Button type="submit" variant="primary" onClick={makeOsmoSwap}>
                swap osmo for atom
              </Button>
            </Card.Body>
          </Card>
        </Stack>
      </Container>
      <WalletConnectModal
        isVisible={!!wcUri() && checkMobile()}
        uri={wcUri() ?? ""}
      />
    </>
  );
};

export default App;
