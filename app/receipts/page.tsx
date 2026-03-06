import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import Link from "next/link";
import { Suspense } from "react";
import ReceiptsTable from "./ui/ReceiptsTable";

// Always fetch fresh data so new WhatsApp receipts appear without stale cache
export const dynamic = "force-dynamic";

export default async function ReceiptsPage(props: { searchParams?: Promise<{ all?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  const showAll = sp.all !== "0";

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">קבלות החזר מס</h1>
          <p className="mt-1 text-sm text-zinc-600">קבלות על הוצאות לצורך החזר מס. העמוד נטען בהדרגה — הטבלה תופיע מיד כשמוכן.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn btn-primary" href="/receipts/upload">
            קבלת החזר מס חדשה
          </Link>
          <Link className="btn" href={showAll ? "/receipts?all=0" : "/receipts"}>
            {showAll ? "הצג החודש" : "הצג הכל"}
          </Link>
          <Link className="btn" href="/dashboard">
            דשבורד
          </Link>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-60 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-64 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <ReceiptsTable userId={user.id} showAll={showAll} />
      </Suspense>
    </div>
  );
}

