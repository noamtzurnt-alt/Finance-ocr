import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Hebrew, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import AppFrame from "@/app/ui/AppFrame";
import OfflineBanner from "@/app/ui/OfflineBanner";
import { Suspense } from "react";

// Kept exactly as before — the chat bot inherits this as its body font and
// must not change. New typography below is additive (exposed as CSS
// variables only) and is opted into by the ".v2-shell" scope class, which
// the chat screen never uses.
const inter = Inter({ subsets: ["latin"] });

const plexSansHebrew = IBM_Plex_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Noam Finance",
  description: "כספת דיגיטלית לניהול הכנסות, הוצאות ומסמכים פיננסיים",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noam Finance",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Make all pages dynamic to avoid stale/cached data between devices.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${inter.className} ${plexSansHebrew.variable} ${plexMono.variable}`}>
        <OfflineBanner />
        <Suspense fallback={<div />}>
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}
