import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import Link from "next/link";
import { Suspense } from "react";
import PaymentReceiptsTable from "./ui/PaymentReceiptsTable";
import GmailSyncButton from "@/app/ui/GmailSyncButton";

export const dynamic = "force-dynamic";

export default async function PaymentReceiptsPage(props: { searchParams?: Promise<{ all?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  const showAll = sp.all !== "0";

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">קבלות (הכנסות)</h1>
          <p className="section-sub">קבלות על כסף שנכנס בפועל לחשבון · גם מ־Morning וגם מהמייל</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GmailSyncButton purpose="receipts" />
          <Link className="btn" href={showAll ? "/payment-receipts?all=0" : "/payment-receipts"}>
            {showAll ? "החודש בלבד" : "הצג הכל"}
          </Link>
          <Link className="btn btn-primary" href="/payment-receipts/upload">+ קבלה חדשה</Link>
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
        <PaymentReceiptsTable userId={user.id} showAll={showAll} />
      </Suspense>
    </div>
  );
}
