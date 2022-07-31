import {
  createEffect,
  createSignal,
  on,
  createMemo,
  mergeProps,
} from "solid-js";

// https://tailwindcss.com/docs/responsive-design
export const enum Breakpoint {
  SM = 640,
  MD = 768,
  LG = 1024,
  XL = 1280,
  XXL = 1536,
}

export interface WindowSize {
  width: number;
  height: number;
  isMobile: boolean;
}

type Props = {
  maxMobileWidth?: Breakpoint | undefined;
};

const defaultProp = {
  maxMobileWidth: Breakpoint.MD,
};

/**
 * Hook into window size, with added check for mobile screen sizes.
 *
 * @param maxMobileWidth Min width to be considered mobile screen. Default: 768.
 * @returns [isMobile, windowSize]
 */
export function useWindowSize(_props: Props): WindowSize {
  const props = mergeProps(defaultProp, _props);
  const maxMobileWidth = createMemo(() => props.maxMobileWidth);
  const [windowSize, setWindowSize] = createSignal<WindowSize>({
    width: 0,
    height: 0,
    isMobile: false,
  });
  createEffect(
    on(maxMobileWidth, (maxMobileWidth) => {
      function handleResize() {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
          isMobile: window.innerWidth <= maxMobileWidth,
        });
      }

      window.addEventListener("resize", handleResize);
      handleResize();
      return () => window.removeEventListener("resize", handleResize);
    })
  );

  return windowSize();
}
