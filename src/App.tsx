import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
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
import WalletConnectModal from "./WalletConnectModal";
import { RequestAccountResponse } from "@cosmostation/extension-client/types/message";

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
  const [connector, setConnector] = createSignal<WalletConnect | undefined>(
    undefined
  );
  const [connected, setConnected] = createSignal<boolean>(false);
  const [wcUri, setWcUri] = createSignal<string>("");
  const [account, setAccount] = createSignal<
    RequestAccountResponse | undefined
  >();
  const [osmoAccount, setOsmoAccount] = createSignal();
  const [lastTxHash, setLastTxHash] = createSignal();
  const checkMobile = () => isMobile();

  onMount(() => {
    let event: any;
    void (async function async() {
      console.log("running on mount fn!");
      try {
        await extensionConnect();
        event = extensionConnector()?.onAccountChanged(() =>
          console.log("changed")
        );
      } catch (e) {
        if (e instanceof InstallError) {
          console.log("not installed");
        } else {
          console.log("failed");
        }
      }
    })();

    onCleanup(() => {
      void (async function async() {
        try {
          if (!extensionConnector()) return;
          extensionConnector()?.offAccountChanged(event);
        } catch (e) {
          if (e instanceof InstallError) {
            console.log("not installed");
          } else {
            console.log("failed");
          }
        }
      })();
    });
  });

  const connect = async () => {
    const connector = await cosmostationWalletConnect.connect(
      checkMobile(),
      setWcUri
    );
    connector.on("connect", (error, payload) => {
      if (error) {
        setConnected(false);
        throw error;
      }
      setConnected(true);
    });
    connector.on("disconnect", (error, payload) => {
      setConnected(false);
    });
    setConnector(connector);

    if (connector) {
      getAccounts();
    }
  };

  const disconnect = async () => {
    if (!connector()) {
      return;
    }

    await connector()
      ?.killSession()
      .catch((err) => console.error(err));
    setConnector(undefined);
    setConnected(false);
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

  const getAccounts = () => {
    if (!connector()) return;

    const request = cosmostationWalletConnect.getAccountsRequest([CHAIN_ID]);
    connector()
      ?.sendCustomRequest(request)
      .then((accounts) => {
        // const account = _.get(accounts, 0);
        alert("accounts: " + JSON.stringify(accounts));
        const account = accounts["0"];
        setAccount(account);
      })
      .catch((error) => {
        console.error(error);
        alert(error.message);
        setAccount();
      });
  };

  const [extensionConnector, setExtensionConnector] = createSignal<
    Tendermint | undefined
  >(undefined);
  const [extensionConnected, setExtensionConnected] = createSignal(false);
  const [extensionAddress, setExtensionAddress] = createSignal("");
  const [extensionLastTxHash, setExtensionLastTxHash] = createSignal();

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

      setExtensionAddress(accountInfo ? accountInfo.address : "");
      setExtensionConnected(true);
    } catch (e) {
      console.error(e);
    }
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
              when={!!connected()}
              fallback={
                <Card>
                  <Card.Header>Connect cosmostation wallet</Card.Header>
                  <Card.Body>
                    <Button
                      type="submit"
                      variant="primary"
                      // onClick={() => openWallet(junoChainInfo)
                      onClick={connect}
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
                    onClick={disconnect}
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
              {`${account()}`}
              <Button
                type="submit"
                variant="primary"
                onClick={() =>
                  alert(
                    `address for ${CHAIN_NAME} : ${
                      connected() ? account()?.address : extensionAddress()
                    }`
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
        isVisible={wcUri().length > 0 && checkMobile()}
        uri={wcUri()}
      />
    </>
  );
};

export default App;
