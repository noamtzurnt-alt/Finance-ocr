import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "פתקים",
  description: "פתקים",
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
