import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import Link from "next/link";
import { Suspense } from "react";
import TransactionsContent from "./ui/TransactionsContent";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">תנועות</h1>
          <p className="section-sub">הוסף, ערוך וחפש תנועות</p>
        </div>
        <Link className="btn" href="/dashboard">← דשבורד</Link>
      </div>

      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-56 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-64 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <TransactionsContent userId={user.id} />
      </Suspense>
    </div>
  );
}

