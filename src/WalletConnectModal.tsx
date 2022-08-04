import {
  isMobile as isMobileWC,
  isAndroid,
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
        return `intent://wc?${props.uri}#Intent;package=wannabit.io.cosmostaion;scheme=cosmostation;end;`;
      } else {
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
