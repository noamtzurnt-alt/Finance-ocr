import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import Link from "next/link";
import { Suspense } from "react";
import InvoicesTable from "./ui/InvoicesTable";

export default async function InvoicesPage(props: { searchParams?: Promise<{ all?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  // Default to "show all" so newly saved invoices are visible (no month filter)
  const showAll = sp.all !== "0";

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">חשבוניות</h1>
          <p className="section-sub">חשבוניות שהוצאת ללקוחות</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn" href={showAll ? "/invoices?all=0" : "/invoices"}>
            {showAll ? "החודש בלבד" : "הצג הכל"}
          </Link>
          <Link className="btn btn-primary" href="/invoices/upload">+ חשבונית חדשה</Link>
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
        <InvoicesTable userId={user.id} showAll={showAll} />
      </Suspense>
    </div>
  );
}

