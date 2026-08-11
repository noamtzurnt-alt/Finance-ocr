import type { Metadata, Viewport } from "next";
import ChatClient from "./ui/ChatClient";

export const metadata: Metadata = {
  title: "Noam Finance",
  description: "צ׳אט מהיר להוספת הוצאות לתנועות",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noam Finance",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1c2a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Keyboard overlays; we shrink the chat shell via visualViewport.height only.
  interactiveWidget: "overlays-content",
};

export default function ChatPage() {
  return <ChatClient />;
}
