import "./globals.css";

import { ThemeProvider } from "@/components/ThemeProvider";
import { WalletProvider } from "@/components/WalletProvider";
import { ClientProviders } from "@/components/ClientProviders";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { PropsWithChildren } from "react";
import { ReactQueryClientProvider } from "@/components/ReactQueryClientProvider";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Movement Wallet Adapter Example",
  description:
    "An example of how to use Movement Wallet Adapter with React and Next.js.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "flex justify-center min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryClientProvider>
            <WalletProvider>
              <ClientProviders>{children}</ClientProviders>
            </WalletProvider>
          </ReactQueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
