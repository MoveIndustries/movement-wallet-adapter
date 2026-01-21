import { forwardRef } from "react";
import { SmallMovementLogo } from "../graphics/SmallMovementLogo";
import { HeadlessComponentProps, createHeadlessComponent } from "./utils";

export const MOVEMENT_PRIVACY_POLICY_URL = "https://movementlabs.xyz/privacy";

const Root = createHeadlessComponent("MovementPrivacyPolicy.Root", "div");

const Disclaimer = createHeadlessComponent(
  "MovementPrivacyPolicy.Disclaimer",
  "span",
  { children: "By continuing, you agree to Movement Labs'" },
);

const Link = createHeadlessComponent("MovementPrivacyPolicy.Disclaimer", "a", {
  href: MOVEMENT_PRIVACY_POLICY_URL,
  target: "_blank",
  rel: "noopener noreferrer",
  children: "Privacy Policy",
});

const PoweredBy = forwardRef<
  HTMLDivElement,
  Pick<HeadlessComponentProps, "className">
>(({ className }, ref) => {
  return (
    <div ref={ref} className={className}>
      <span>Powered by</span>
      <SmallMovementLogo />
      <span>Movement Labs</span>
    </div>
  );
});
PoweredBy.displayName = "MovementPrivacyPolicy.PoweredBy";

/**
 * A headless component for rendering the Movement Labs privacy policy disclaimer
 * that should be placed under the Petra Web login options.
 */
export const MovementPrivacyPolicy = Object.assign(Root, {
  Disclaimer,
  Link,
  PoweredBy,
});
