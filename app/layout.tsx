import type { Metadata } from "next";
import "./globals.css";

import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "All Together — drop 40 CRC, one human wins Sunday",
  description:
    "A weekly Circles ritual. Drop 40 CRC by Sunday 23:59 CET — one human takes the pot home.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-black text-white font-sans">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
