"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLogout } from "@/app/ui/icons";

export default function LogoutButton(props: { variant?: "button" | "nav" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof caches !== "undefined") await caches.delete("nf-shell-v1").catch(() => null);
    setLoading(false);
    router.replace("/login");
  }

  if (props.variant === "nav") {
    return (
      <button onClick={logout} disabled={loading} className="nav-link" type="button">
        <span className="nav-icon">
          <IconLogout className="h-4.5 w-4.5" />
        </span>
        <span>{loading ? "מתנתק..." : "התנתקות"}</span>
      </button>
    );
  }

  return (
    <button onClick={logout} disabled={loading} className="btn" type="button">
      {loading ? "מתנתק..." : "התנתק"}
    </button>
  );
}
