import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
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
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
};

export default async function ChatPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/chat");

  return <ChatClient />;
}
