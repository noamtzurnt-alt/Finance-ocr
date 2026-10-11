import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import PageHeader from "@/app/ui/PageHeader";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import { parseArchiveMonth } from "@/app/lib/receipts/year-date";
import { expenseDateRange } from "@/app/lib/receipts/query-range";
import { getDocumentsList } from "@/app/lib/receipts/list-documents";
import ReceiptsExpensesClient from "./ui/ReceiptsExpensesClient";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage(props: {
  searchParams?: Promise<{ year?: string; month?: string; q?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  const yearParam = sp.year ? parseInt(sp.year, 10) : new Date().getFullYear();
  const year = Number.isFinite(yearParam)
    ? Math.max(MIN_EXPENSE_ARCHIVE_YEAR, yearParam)
    : new Date().getFullYear();
  const month = parseArchiveMonth(sp.month);

  const range = expenseDateRange({ year, month, from: sp.from, to: sp.to });
  const { items: initialItems } = await getDocumentsList(user.id, {
    type: "expense",
    q: sp.q,
    from: range.from,
    to: range.to,
    limit: 200,
  });

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="הוצאות מוכרות"
        subtitle="כל ההוצאות לפי תאריך, בהעלאה ידנית ומבוקרת בלבד"
      />

      <ReceiptsExpensesClient
        initialYear={year}
        initialMonth={month}
        initialQ={sp.q}
        initialFrom={sp.from}
        initialTo={sp.to}
        initialItems={initialItems}
      />
    </div>
  );
}
