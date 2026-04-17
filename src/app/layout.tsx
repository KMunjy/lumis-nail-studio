import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/Navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TryOnProvider } from "@/store/try-on-context";
import { RegionProvider } from "@/store/region-context";
import { ConsentBanner } from "@/components/ConsentBanner";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LUMIS | Virtual Nail Try-On",
  description: "Try any nail shade live on your hand. Browse, discover, and try on — powered by on-device AR.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LUMIS",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F43F78",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full`}
    >
      <head>
        {/* Suppress MediaPipe TFLite console noise in dev */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  var _ce=console.error.bind(console);
  console.error=function(){
    var m=String(arguments[0]||"");
    if(m.includes("TensorFlow Lite")||m.includes("XNNPACK")||m.startsWith("INFO:")||m.startsWith("WARNING:")||m.includes("TfLite")||m.includes("inference_feedback")||m.includes("landmark_projection"))return;
    _ce.apply(console,arguments);
  };
})();`,
          }}
        />
      </head>
      <body
        style={{
          backgroundColor: "var(--color-canvas)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-sans)",
        }}
        className="min-h-full flex flex-col antialiased selection:bg-pink-100 selection:text-pink-700"
      >
        <RegionProvider>
          <TryOnProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <BottomNav />
            {/* Global consent gate — renders as pill for returning users, full modal for first-timers */}
            <ConsentBanner />
          </TryOnProvider>
        </RegionProvider>
      </body>
    </html>
  );
}
