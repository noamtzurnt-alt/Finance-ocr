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
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">תנועות אחרונות</h1>
          <p className="mt-1 text-sm text-zinc-600">העמוד נטען בהדרגה — הרשימה תופיע מיד כשמוכן.</p>
        </div>
        <Link className="btn" href="/dashboard">
          דשבורד
        </Link>
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

