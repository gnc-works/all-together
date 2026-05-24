import type { Metadata } from "next";
import "./globals.css";

import { WalletProvider } from "@/components/wallet/WalletProvider";

const SITE_URL = "https://all-together-gamma.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "All Together — drop 40 CRC, one human wins Sunday",
  description:
    "A weekly Circles ritual. Drop 40 CRC by Sunday 23:59 CET — one human takes the pot home.",
  openGraph: {
    title: "All Together",
    description:
      "Weekly Circles pool. Drop 40 CRC by Sunday 23:59 CET — one human takes the pot home.",
    url: SITE_URL,
    siteName: "All Together",
    images: [{ url: "/og", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "All Together",
    description:
      "Weekly Circles pool. Drop 40 CRC by Sunday 23:59 CET — one human takes the pot home.",
    images: ["/og"],
  },
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
