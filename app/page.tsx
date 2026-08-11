import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/server";

export default async function Home() {
  const session = await getSession();
  // Phone / home-screen entry goes straight to Noam Finance chat.
  if (session?.sub) redirect("/chat");
  redirect("/login?next=/chat");
}
