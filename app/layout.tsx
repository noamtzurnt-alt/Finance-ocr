import type { Metadata, Viewport } from "next";
import { Inter, Heebo } from "next/font/google";
import "./globals.css";
import AppFrame from "@/app/ui/AppFrame";
import OfflineBanner from "@/app/ui/OfflineBanner";
import { Suspense } from "react";
import { normalizeAppTheme, THEME_COOKIE, themeColorMeta } from "@/app/lib/ui/theme";
import { cookies, headers } from "next/headers";
import ServiceWorkerRegister from "@/app/ui/ServiceWorkerRegister";
import HomeScreenMeta from "@/app/ui/HomeScreenMeta";
import ChatFaceIdGate from "@/app/chat/ui/ChatFaceIdGate";

const inter = Inter({ subsets: ["latin"] });

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "Noam Finance",
  description: "כספת דיגיטלית לניהול הכנסות, הוצאות ומסמכים פיננסיים",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  const pathname = headerList.get("x-pathname") ?? "";
  const notesHome = pathname === "/notes" || pathname.startsWith("/notes/");
  const theme = normalizeAppTheme(cookieStore.get(THEME_COOKIE)?.value ?? "green");

  return (
    <html lang="he" dir="rtl" data-theme={theme} style={{ colorScheme: "dark" }}>
      <head>
        <meta name="theme-color" content={themeColorMeta(theme)} />
        {notesHome ? (
          <>
            <link rel="manifest" href="/notes/manifest.webmanifest" />
            <link rel="apple-touch-icon" href="/notes/apple-touch-icon.png" sizes="180x180" />
            <meta name="apple-mobile-web-app-title" content="פתקים" />
          </>
        ) : (
          <>
            <link rel="manifest" href="/manifest.json" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
            <meta name="apple-mobile-web-app-title" content="Noam Finance" />
          </>
        )}
      </head>
      <body className={`${inter.className} ${heebo.variable}`}>
        {process.env.NODE_ENV === "production" ? (
          <script
            dangerouslySetInnerHTML={{
              __html: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js')",
            }}
          />
        ) : null}
        <OfflineBanner />
        <ServiceWorkerRegister />
        <HomeScreenMeta />
        <ChatFaceIdGate>
          <Suspense fallback={<div />}>
            <AppFrame>{children}</AppFrame>
          </Suspense>
        </ChatFaceIdGate>
      </body>
    </html>
  );
}
