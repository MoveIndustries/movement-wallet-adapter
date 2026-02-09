# @moveindustries/wallet-adapter-move-design

Movement Design System wallet modal for the Movement Wallet Adapter. Provides a styled `WalletModal` component for connecting wallets in Movement dApps.

## Installation

```bash
npm install @moveindustries/wallet-adapter-move-design
# or
pnpm add @moveindustries/wallet-adapter-move-design
```

### Prerequisites

- `@moveindustries/wallet-adapter-react` must be set up with `WalletProvider` wrapping your app
- **Tailwind CSS v4** is required — this package uses Tailwind v4 utility classes

## Tailwind CSS Setup

This package uses Tailwind CSS classes internally. For Tailwind to generate the necessary styles, it must scan this package's source files.

Add the following import to your main CSS file (e.g., `globals.css`), **after** the `@import "tailwindcss"` directive:

```css
@import "tailwindcss";
@import "@moveindustries/wallet-adapter-move-design/styles";
```

This `@source` directive tells Tailwind to scan the package's source files for class names. Without it, the modal will render without styles.

### Fonts

The wallet modal uses the following fonts. Host them in your `public/fonts/` directory and add the corresponding `@font-face` declarations to your CSS:

- **TWK Everett Mono** (Regular 400, Medium 500, Bold 700)
- **Neue Haas Unica Pro** (Regular 400)

```css
@font-face {
  font-family: "TWK Everett Mono";
  src: url("/fonts/TWKEverettMono-Regular.otf") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "TWK Everett Mono";
  src: url("/fonts/TWKEverettMono-Medium.otf") format("opentype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "TWK Everett Mono";
  src: url("/fonts/TWKEverettMono-Bold.otf") format("opentype");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Neue Haas Unica Pro";
  src: url("/fonts/NeueHaasUnicaPro-Regular.otf") format("opentype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

## Usage

```tsx
import { WalletModal } from "@moveindustries/wallet-adapter-move-design";
import { useState } from "react";

function WalletConnectButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>Connect Wallet</button>
      {isModalOpen && (
        <WalletModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `onClose` | `() => void` | Callback when the modal is closed |

The modal automatically detects mobile devices and renders as a bottom drawer on mobile or a centered dialog on desktop.

## Compatibility

- React 18 or 19
- Tailwind CSS v4+
