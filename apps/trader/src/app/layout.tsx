import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TxAgent | Autonomous Betting Protocol",
  description: "Advanced trading desk and autonomous agent for TxLINE data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#050505] text-gray-300 font-sans selection:bg-emerald-500/30">
        {/* Self-heal: trader is NOT a PWA, but it shares the localhost origin with the Pulse
            app whose service worker can linger and serve stale bundles (breaking hydration).
            This inline script runs on parse — before React — and evicts any stale SW + caches,
            reloading ONCE so the page comes back uncontrolled and hydrates cleanly. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!('serviceWorker' in navigator))return;navigator.serviceWorker.getRegistrations().then(function(rs){if(!rs.length)return;Promise.all(rs.map(function(r){return r.unregister();})).then(function(){if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});});}if(!sessionStorage.getItem('txagent_sw_evicted')){sessionStorage.setItem('txagent_sw_evicted','1');location.reload();}});}).catch(function(){});}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
