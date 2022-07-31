import { Component, JSX } from "solid-js";

import CrossIcon from "../CrossIcon";

export type ModalProps = {
  children?: JSX.Element | undefined;
  class?: string | undefined;
  cardClass?: string | undefined;
  isVisible: boolean;
  onDismiss?: ((...x: any) => any) | undefined;
  ignoreBgDismiss?: boolean | undefined;
  centered?: boolean | undefined;
};

const Modal: Component<ModalProps> = (props) => {
  const centered = props.centered ?? true;

  function onDismiss() {
    if (props.onDismiss) {
      props.onDismiss();
    }
  }

  return (
    <div
      onClick={() => {
        if (!props.ignoreBgDismiss) {
          onDismiss();
        }
      }}
      style={{ "z-index": 9999 }}
      class={`${props.class ?? ""} ${
        props.isVisible ? "" : "hidden"
      } fixed left-0 bottom-0 h-screen w-screen bg-black/50 backdrop-blur-sm flex justify-center ${
        centered ? "items-center" : "items-start"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        class={`relative rounded-lg bg-gray-850 ring-1 ring-gray-700 ${props.cardClass}`}
      >
        {props.children}
        <button
          onClick={onDismiss}
          class="absolute top-0 right-0 rounded-full -mr-4 -mt-4 text-gray-400 hover:text-gray-300"
        >
          <CrossIcon class="h-10 w-10" />
        </button>
      </div>
    </div>
  );
};

export default Modal;
