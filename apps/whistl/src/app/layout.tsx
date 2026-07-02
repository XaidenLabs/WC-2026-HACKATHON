import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WHISTL — World Cup prop bets, settled by proof",
  description:
    "Bet on a World Cup stat. Funds lock in a Solana escrow. When the match ends, a TxLINE Merkle proof settles it automatically — no admin, no oracle.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WHISTL",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192.svg",
  },
  openGraph: {
    title: "WHISTL — Trustless World Cup Bets",
    description: "Pick a stat. Stake USDC. The proof settles it.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#c0f400",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink text-text font-sans flex flex-col">
        <Providers>
          <PWARegister />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
