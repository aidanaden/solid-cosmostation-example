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
import { RequestAccountResponse } from "@cosmostation/extension-client/types/message";
import junoChainInfo from "./juno";

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
const OSMO_TO_ADDRESS = "osmo1ze2ye5u5k3qdlexvt2e0nn0508p0409465lts4";

const App: Component = () => {
  // wc state values
  const [connector, setConnector] = createSignal<WalletConnect | undefined>(
    undefined
  );
  const [mobileConnected, setMobileConnected] = createSignal<boolean>(false);
  const [wcUri, setWcUri] = createSignal<string | undefined>(undefined);
  const [account, setAccount] = createSignal<
    RequestAccountResponse | undefined
  >();

  // extension state values
  const [extensionConnector, setExtensionConnector] = createSignal<
    Tendermint | undefined
  >(undefined);
  const [extensionConnected, setExtensionConnected] = createSignal(false);

  const [walletAddress, setWalletAddress] = createSignal<string>("");
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
    setConnector(wcConnector);

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

    if (!connector) {
      return;
    }

    const request = cosmostationWalletConnect.getAccountsRequest([
      junoChainInfo.chainId,
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

  const extensionConnect = async () => {
    try {
      setExtensionConnector(await tendermint());
      await getExtensionAccounts();
    } catch {
      setExtensionConnected(false);
    }
  };

  const extensionDisconnect = () => {
    setExtensionConnector(undefined);
    setExtensionConnected(false);
  };

  const getExtensionAccounts = async () => {
    try {
      const supportedChains = await extensionConnector()?.getSupportedChains();
      console.log("supportedchains: ", supportedChains);

      if (
        ![
          ...supportedChains!.official,
          ...supportedChains!.unofficial,
        ].includes(CHAIN_NAME)
      ) {
        await extensionConnector()?.addChain({
          chainId: CHAIN_ID,
          chainName: CHAIN_NAME,
          addressPrefix: "juno",
          baseDenom: DENOM,
          displayDenom: DISPLAY_DENOM,
          restURL: LCD_ENDPOINT,
        });
      }

      const accountInfo = await extensionConnector()?.requestAccount(
        CHAIN_NAME
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
                      onClick={mobileConnect}
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
                onClick={() => alert(`wallet address: ${walletAddress()}`)}
              >
                Get address
              </Button>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header>Sign something on Juno</Card.Header>
            <Card.Body>
              <Button
                type="submit"
                variant="primary"
                // onClick={() => signSomething(junoChainInfo)}
              >
                Sign
              </Button>
            </Card.Body>
          </Card>
          {/* <Card>
          <Card.Header>Send coin(s) on Juno</Card.Header>
          <Card.Body>
            <b>Address:</b>
            <div id="address"></div>
            <Form name="sendForm" onSubmit={(e) => onSubmit(e, junoChainInfo)}>
              <Stack gap={3}>
                <Form.Group>
                  <label for="recipient">Recipient</label>
                  <Form.Control id="recipient" name="recipient" />
                </Form.Group>
                <Form.Group>
                  <label for="amount">Amount</label>
                  <InputGroup>
                    <Form.Control id="amount" name="amount" />
                    <InputGroup.Text>JUNO</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
                <Button type="submit" variant="primary">
                  Submit
                </Button>
              </Stack>
            </Form>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>Connect Osmosis wallet</Card.Header>
          <Card.Body>
            <Button
              type="submit"
              variant="primary"
              onClick={() => openWallet(osmoChainInfo)}
            >
              Connect kepler
            </Button>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>Get Osmosis wallet address</Card.Header>
          <Card.Body>
            <Button
              type="submit"
              variant="primary"
              onClick={() => getAddress(osmoChainInfo)}
            >
              Get address
            </Button>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>Sign Something on Osmosis</Card.Header>
          <Card.Body>
            <Button
              type="submit"
              variant="primary"
              onClick={() => signSomething(osmoChainInfo)}
            >
              Sign
            </Button>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>Send Coin on Osmosis</Card.Header>
          <Card.Body>
            <b>Address:</b>
            <div id="address"></div>
            <Form name="sendForm" onSubmit={(e) => onSubmit(e, osmoChainInfo)}>
              <Stack gap={3}>
                <Form.Group>
                  <label for="recipient">Recipient</label>
                  <Form.Control id="recipient" name="recipient" />
                </Form.Group>
                <Form.Group>
                  <label for="amount">Amount</label>
                  <InputGroup>
                    <Form.Control id="amount" name="amount" />
                    <InputGroup.Text>OSMO</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
                <Button type="submit" variant="primary">
                  Submit
                </Button>
              </Stack>
            </Form>
          </Card.Body>
        </Card> */}
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
