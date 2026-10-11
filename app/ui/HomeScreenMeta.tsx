"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Keep the home-screen identity in sync after client navigations. */
export default function HomeScreenMeta() {
  const pathname = usePathname();

  useEffect(() => {
    const notes = pathname === "/notes" || pathname.startsWith("/notes/");
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", notes ? "/notes/manifest.webmanifest" : "/manifest.json");
    document
      .querySelector('link[rel="apple-touch-icon"]')
      ?.setAttribute("href", notes ? "/notes/apple-touch-icon.png" : "/apple-touch-icon.png");
    document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.setAttribute("content", notes ? "פתקים" : "Noam Finance");
  }, [pathname]);

  return null;
}
