import {
  isMobile as isMobileWC,
  isAndroid,
  saveMobileLinkInfo,
} from "@walletconnect/browser-utils";
import { Component, createEffect, createMemo, on } from "solid-js";

import Modal, { ModalProps } from "./Modal";
import { useWindowSize } from "./window";

type Props = ModalProps & {
  uri: string;
};

const WalletConnectModal: Component<Props> = (props) => {
  // Below is used for styling for mobile device.
  // Check the size of window.
  const { isMobile } = useWindowSize({ maxMobileWidth: undefined });

  // Below is used for real mobile environment.
  // Check the user agent.
  const checkMobile = createMemo(() => isMobileWC());
  const checkAndroid = createMemo(() => isAndroid());

  const navigateToAppURL = createMemo(() => {
    if (!props.uri) {
      return;
    }

    if (checkMobile()) {
      if (checkAndroid()) {
        // Save the mobile link.
        saveMobileLinkInfo({
          //   name: "Keplr",
          name: "Cosmostation",
          //   href: "intent://wcV1#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;",
          href: "intent://wc#Intent;package=wannabit.io.cosmostaion;scheme=cosmostation;end;",
        });

        // return `intent://wcV1?${props.uri}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`;

        return `intent://wc?${props.uri}#Intent;package=wannabit.io.cosmostaion;scheme=cosmostation;end;`;
      } else {
        // Save the mobile link.
        saveMobileLinkInfo({
          name: "Cosmostation",
          href: "cosmostation://wc",
        });

        return `cosmostation://wc?${props.uri}`;
      }
    }
  });

  createEffect(
    on(navigateToAppURL, (appUrl) => {
      // Try opening the app without interaction.
      console.log("app url is: ", appUrl);
      if (appUrl) {
        window.location.href = appUrl;
      }
    })
  );

  return (
    <Modal isVisible={props.isVisible} onDismiss={props.onDismiss}>
      <button
        class="my-3 py-4"
        onClick={() => {
          if (navigateToAppURL()) {
            window.location.href = navigateToAppURL()!;
          }
        }}
      >
        Open App
      </button>
    </Modal>
  );
};

export default WalletConnectModal;
