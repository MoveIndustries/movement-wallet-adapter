// TODO: Re-enable when Movement supports social sign-in (Petra Web)
// This is a stub component that just renders children - social sign-in education screens are disabled

import {
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
  SVGProps,
} from "react";
import { HeadlessComponentProps, createHeadlessComponent } from "./utils";

/** @deprecated Social sign-in disabled */
export const EXPLORE_ECOSYSTEM_URL = "https://movementlabs.xyz/ecosystem";

/** @deprecated Social sign-in disabled */
export interface AboutPetraWebEducationScreen {
  Graphic: ForwardRefExoticComponent<
    Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
  >;
  Title: ForwardRefExoticComponent<
    HeadlessComponentProps & RefAttributes<HTMLHeadingElement>
  >;
  Description: ForwardRefExoticComponent<
    HeadlessComponentProps & RefAttributes<HTMLParagraphElement>
  >;
  screenIndex: number;
  totalScreens: number;
  screenIndicators: ForwardRefExoticComponent<HeadlessComponentProps & RefAttributes<HTMLButtonElement>>[];
  back: () => void;
  next: () => void;
  cancel: () => void;
}

/** @deprecated Social sign-in disabled */
export interface AboutPetraWebProps {
  renderEducationScreen: (screen: AboutPetraWebEducationScreen) => ReactNode;
  children?: ReactNode;
}

/**
 * @deprecated Social sign-in disabled - this component just renders children without any education screens
 */
const Root = ({ children }: AboutPetraWebProps) => {
  return <>{children}</>;
};
Root.displayName = "AboutPetraWeb";

const Trigger = createHeadlessComponent(
  "AboutPetraWeb.Trigger",
  "button",
  () => ({
    // No-op since social sign-in is disabled
    onClick: () => {},
    style: { display: "none" },
  }),
);

/**
 * @deprecated Social sign-in disabled - this component just renders children
 */
export const AboutPetraWeb = Object.assign(Root, {
  Trigger,
});
