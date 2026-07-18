import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import AuthGuard from "@/components/AuthGuard";
import PWARegister from "@/components/PWARegister";
import "./globals.css";
import Link from "next/link";
import ClientPulseNav from "./ClientPulseNav";

export const metadata: Metadata = {
  title: "PULSE · World Cup 2026 Feed",
  description: "Live World Cup 2026 updates, sharp movements, and sweepstakes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PULSE",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192.svg",
  },
  openGraph: {
    title: "PULSE · World Cup 2026 Feed",
    description: "Live updates and sharp movements.",
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
      className="h-full antialiased"
    >
      <body className="min-h-full bg-ink text-text font-sans flex flex-col">
        <Providers>
          <PWARegister />
          <AuthGuard>
            <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-ink">
              {/* Top bar */}
              <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
                <Link href="/" className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold tracking-[0.18em] text-text">
                    PULSE
                  </span>
                  <span className="size-1.5 animate-livedot rounded-full bg-signal" aria-hidden />
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                  World Cup 2026
                </span>
              </header>

              {/* Content */}
              <main className="flex-1 pb-24">{children}</main>

              {/* Bottom tab bar */}
              <ClientPulseNav />
            </div>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
