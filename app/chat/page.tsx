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
  themeColor: "#07111f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function ChatPage() {
  return <ChatClient />;
}
