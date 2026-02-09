// TODO: Re-enable when Movement supports social sign-in (Movement Connect)
// This is a stub component that just renders children - social sign-in education screens are disabled

import {
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
  SVGProps,
} from "react";
import { HeadlessComponentProps, createHeadlessComponent } from "./utils";

/** @deprecated Use AboutPetraWeb instead. Social sign-in disabled. */
export interface AboutMovementConnectEducationScreen {
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

/** @deprecated Use AboutPetraWebProps instead. Social sign-in disabled. */
export interface AboutMovementConnectProps {
  renderEducationScreen: (screen: AboutMovementConnectEducationScreen) => ReactNode;
  children?: ReactNode;
}

/**
 * @deprecated Social sign-in disabled - this component just renders children without any education screens
 */
const Root = ({ children }: AboutMovementConnectProps) => {
  return <>{children}</>;
};
Root.displayName = "AboutMovementConnect";

const Trigger = createHeadlessComponent(
  "AboutMovementConnect.Trigger",
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
export const AboutMovementConnect = Object.assign(Root, {
  Trigger,
});
