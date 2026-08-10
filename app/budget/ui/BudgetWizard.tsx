"use client";

import { useState, useEffect, useRef } from "react";
import { parseWizardState } from "@/app/lib/budget/wizard-state";
const WIZARD_LS_KEY = "budget_wizard_v4";

type ExpenseRow = {
  id: string;
  icon: string;
  label: string;
  amount: string;
  isFixed: boolean;
  notes?: string;
};

const DEFAULT_PERSONAL_EXPENSE_ROWS: ExpenseRow[] = [
  { id: "car",           icon: "🚗", label: "דלק/רכב",                amount: "", isFixed: true },
  { id: "food",          icon: "🍽", label: "אוכל",                   amount: "", isFixed: false },
  { id: "entertainment", icon: "🎉", label: "בזבוזים",                amount: "", isFixed: false },
  { id: "events",        icon: "🎂", label: "יום הולדת/אירוע מיוחד", amount: "", isFixed: false },
  { id: "books",         icon: "📌", label: "ספר",                    amount: "", isFixed: false },
  { id: "train",         icon: "📌", label: "רכבת",                   amount: "", isFixed: false },
];

const DEFAULT_BUSINESS_EXPENSE_ROWS: ExpenseRow[] = [
  { id: "biz_software",   icon: "💻", label: "תוכנות ומנויים",       amount: "", isFixed: true,  notes: "" },
  { id: "biz_phones",     icon: "📱", label: "מספרי טלפון",          amount: "", isFixed: true,  notes: "" },
  { id: "biz_domain",     icon: "🌐", label: "דומיין",               amount: "", isFixed: true,  notes: "" },
  { id: "biz_whatsapp",   icon: "💬", label: "עלות הודעות ווצאפ",    amount: "", isFixed: false, notes: "" },
  { id: "biz_accountant", icon: "📊", label: "עלות רואה חשבון",      amount: "", isFixed: true,  notes: "" },
];

type IncomeSources = {
  steady: boolean;
  variable: boolean;
  other: boolean;
};

type BudgetSummary = {
  income: number;
  personalIncome: number;
  businessIncome: number;
  businessExpenses: number;
  businessDeficit: number;
  personalSubsidyToBusiness: number;
  salarySavings: number;
  expenseRows: ExpenseRow[];
  businessExpenseRows: ExpenseRow[];
  personalExpenses: number;
  totalOutflow: number;
  expenseLimit: number;
  surplus: number;
  dailyBudget: number;
  hasBreakdown: boolean;
};

type WizardStep = 1 | 2 | 3;

type WizardAnswers = {
  incomeSources: IncomeSources;
  salaryIncome: string;
  businessIncome: string;
  otherIncome: string;
  monthlySavings: string;
  expenseRows: ExpenseRow[];
  businessExpenseRows: ExpenseRow[];
};

const INITIAL_ANSWERS: WizardAnswers = {
  incomeSources: { steady: false, variable: false, other: false },
  salaryIncome: "",
  businessIncome: "",
  otherIncome: "",
  monthlySavings: "",
  expenseRows: DEFAULT_PERSONAL_EXPENSE_ROWS,
  businessExpenseRows: DEFAULT_BUSINESS_EXPENSE_ROWS,
};

function hasIncomeSource(a: WizardAnswers): boolean {
  return a.incomeSources.steady || a.incomeSources.variable || a.incomeSources.other;
}

type IncomeSplit = {
  salary: number;
  other: number;
  businessNet: number;
  personalNet: number;
  net: number;
};

function computeIncomeSplit(a: WizardAnswers): IncomeSplit {
  const salary = a.incomeSources.steady ? Number(a.salaryIncome) || 0 : 0;
  const other = a.incomeSources.other ? Number(a.otherIncome) || 0 : 0;
  const businessNet = a.incomeSources.variable ? Number(a.businessIncome) || 0 : 0;
  const personalNet = salary + other;
  const net = personalNet + businessNet;

  return { salary, other, businessNet, personalNet, net };
}

/** הכנסה לתקציב חיים אישיים */
function budgetIncomeBase(a: WizardAnswers): number {
  return computeIncomeSplit(a).personalNet;
}

function sumExpenseRows(rows: ExpenseRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

function computeBusinessDeficit(a: WizardAnswers): number {
  if (!a.incomeSources.variable) return 0;
  const split = computeIncomeSplit(a);
  const businessExpenses = sumExpenseRows(a.businessExpenseRows);
  return Math.max(0, businessExpenses - split.businessNet);
}

function normalizeExpenseRows(rows: ExpenseRow[]): ExpenseRow[] {
  const fixedByDefault = new Set(["car"]);
  return rows.map((r) => ({
    ...r,
    isFixed: r.isFixed ?? fixedByDefault.has(r.id),
    notes: r.notes ?? "",
  }));
}

function normalizeBusinessExpenseRows(rows: ExpenseRow[]): ExpenseRow[] {
  return (rows.length > 0 ? rows : DEFAULT_BUSINESS_EXPENSE_ROWS).map((r) => ({
    ...r,
    notes: r.notes ?? "",
  }));
}

type LegacyWizardAnswers = Partial<WizardAnswers> & {
  incomeType?: "steady" | "variable" | "not_working" | "";
  monthlyIncome?: string;
  incomeSources?: IncomeSources;
};

function migrateAnswers(raw: LegacyWizardAnswers): WizardAnswers {
  const base: WizardAnswers = {
    ...INITIAL_ANSWERS,
    incomeSources: raw.incomeSources ?? { steady: false, variable: false, other: false },
    salaryIncome: raw.salaryIncome ?? "",
    businessIncome: raw.businessIncome ?? "",
    otherIncome: raw.otherIncome ?? "",
    monthlySavings: raw.monthlySavings ?? "",
    expenseRows: normalizeExpenseRows(
      (raw.expenseRows ?? DEFAULT_PERSONAL_EXPENSE_ROWS).filter((r) => r.id !== "subscriptions"),
    ),
    businessExpenseRows: normalizeBusinessExpenseRows(
      raw.businessExpenseRows ?? DEFAULT_BUSINESS_EXPENSE_ROWS,
    ),
  };

  if (!hasIncomeSource(base) && raw.incomeType) {
    if (raw.incomeType === "steady") {
      base.incomeSources.steady = true;
      base.salaryIncome = raw.monthlyIncome ?? "";
    } else if (raw.incomeType === "variable") {
      base.incomeSources.variable = true;
      base.businessIncome = raw.monthlyIncome ?? "";
    } else if (raw.incomeType === "not_working") {
      base.incomeSources.other = true;
      base.otherIncome = raw.monthlyIncome ?? "";
    }
  }

  return base;
}

function migrateStep(step: number, done: boolean): WizardStep {
  if (done || step >= 5) return 3;
  if (step >= 3) return 2;
  return (step === 2 ? 2 : 1) as WizardStep;
}

function computeBudgetSummary(a: WizardAnswers): BudgetSummary {
  const split = computeIncomeSplit(a);
  const budgetIncome = budgetIncomeBase(a);
  const personalExpenses = sumExpenseRows(a.expenseRows);
  const businessExpenses = sumExpenseRows(a.businessExpenseRows);
  const businessDeficit = computeBusinessDeficit(a);
  const salarySavings = Number(a.monthlySavings) || 0;
  const expenseLimit = Math.max(0, budgetIncome - salarySavings);
  const surplus = expenseLimit - personalExpenses - businessDeficit;
  const dailyBudget = budgetIncome > 0 ? Math.round(expenseLimit / 30) : 0;
  const totalOutflow = personalExpenses + businessExpenses + salarySavings;

  return {
    income: split.net,
    personalIncome: split.personalNet,
    businessIncome: split.businessNet,
    businessExpenses,
    businessDeficit,
    personalSubsidyToBusiness: businessDeficit,
    salarySavings,
    expenseRows: a.expenseRows,
    businessExpenseRows: a.businessExpenseRows,
    personalExpenses,
    totalOutflow,
    expenseLimit,
    surplus,
    dailyBudget,
    hasBreakdown: budgetIncome > 0 || split.net > 0,
  };
}

const stepTitles = ["הכנסה", "הוצאות", "סיכום"];

const STEP_META = [
  { emoji: "💵", gradient: "from-emerald-500 to-teal-500", ring: "ring-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  { emoji: "🛒", gradient: "from-violet-500 to-fuchsia-500", ring: "ring-violet-400", text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  { emoji: "✨", gradient: "from-amber-500 to-orange-500", ring: "ring-amber-400", text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" },
] as const;

const INCOME_SOURCE_STYLE = {
  steady: { emoji: "💼", active: "border-emerald-400 bg-gradient-to-l from-emerald-50 to-teal-50 shadow-sm shadow-emerald-100", accent: "accent-emerald-600" },
  variable: { emoji: "🚀", active: "border-violet-400 bg-gradient-to-l from-violet-50 to-fuchsia-50 shadow-sm shadow-violet-100", accent: "accent-violet-600" },
  other: { emoji: "🎁", active: "border-sky-400 bg-gradient-to-l from-sky-50 to-cyan-50 shadow-sm shadow-sky-100", accent: "accent-sky-600" },
} as const;

function StepBanner({ step }: { step: WizardStep }) {
  const meta = STEP_META[step - 1];
  const subtitles = [
    "כמה נכנס לכיס החודש? אפשר לשלב שכיר + עצמאי",
    "חלק לחיים, חלק לעסק — קטגוריה אחר קטגוריה",
    "התמונה המלאה: נכנס, יוצא, חיסכון ומה נשאר",
  ];
  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-2xl shadow-sm">
          {meta.emoji}
        </span>
        <div>
          <p className={`text-sm font-bold ${meta.text}`}>שלב {step} מתוך 3: {stepTitles[step - 1]}</p>
          <p className="mt-1 text-xs text-zinc-600">{subtitles[step - 1]}</p>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm">
      <label className="text-sm font-semibold text-zinc-700">{label}</label>
      <input
        className="field mt-2 border-emerald-200 bg-emerald-50/40 focus:border-emerald-400 focus:ring-emerald-300/50"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        placeholder={placeholder ?? "₪"}
      />
    </div>
  );
}

type ExpenseTableProps = {
  title: string;
  subtitle?: string;
  headerClass: string;
  income: number;
  incomeLabel: string;
  incomeIcon?: string;
  savings?: { value: string; onChange: (v: string) => void };
  rows: ExpenseRow[];
  onRowsChange: (rows: ExpenseRow[]) => void;
  showNotes?: boolean;
  showFixedToggle?: boolean;
  businessSubsidy?: number;
};

function ExpenseBudgetTable({
  title,
  subtitle,
  headerClass,
  income,
  incomeLabel,
  incomeIcon = "💵",
  savings,
  rows,
  onRowsChange,
  showNotes = false,
  showFixedToggle = true,
  businessSubsidy,
}: ExpenseTableProps) {
  const savingsAmt = savings ? Number(savings.value) || 0 : 0;
  const subsidyAmt = businessSubsidy ?? 0;
  const rowBalances: number[] = [];
  let bal = income - savingsAmt;
  for (const row of rows) {
    bal -= Number(row.amount) || 0;
    rowBalances.push(bal);
  }
  if (businessSubsidy !== undefined) {
    bal -= subsidyAmt;
  }
  const remaining = bal;

  function updateRow(id: string, field: keyof ExpenseRow, value: string | boolean) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function deleteRow(id: string) {
    onRowsChange(rows.filter((r) => r.id !== id));
  }

  function addRow() {
    onRowsChange([
      ...rows,
      { id: `custom_${Date.now()}`, icon: "📌", label: "", amount: "", isFixed: false, notes: "" },
    ]);
  }

  return (
    <div className="space-y-2">
      <div className={`rounded-xl border px-4 py-3 shadow-sm ${headerClass}`}>
        <p className="text-sm font-bold">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs opacity-75">{subtitle}</p>}
      </div>

      <div className="rounded-2xl overflow-hidden border border-zinc-200/80 bg-white/70 shadow-sm backdrop-blur-sm">
        <table className="w-full text-sm" style={{ direction: "rtl" }}>
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">קטגוריה</th>
              {showNotes && (
                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">פירוט</th>
              )}
              {showFixedToggle && (
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-500 w-20">סוג</th>
              )}
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 w-32">סכום חודשי ₪</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 w-24">יתרה</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100 bg-emerald-50/50">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span>{incomeIcon}</span>
                  <span className="text-sm font-semibold text-emerald-800">{incomeLabel}</span>
                </div>
              </td>
              {showNotes && <td></td>}
              {showFixedToggle && <td></td>}
              <td className="px-3 py-2.5 text-left">
                <span className="text-sm font-bold text-emerald-700">+{income.toLocaleString()} ₪</span>
              </td>
              <td className="px-3 py-2.5 text-left">
                <span className="text-sm text-zinc-500 tabular-nums">{income.toLocaleString()} ₪</span>
              </td>
              <td></td>
            </tr>

            {savings && (() => {
              const savBal = income - savingsAmt;
              return (
                <tr className="border-b border-blue-100 bg-blue-50/60">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none w-6 text-center">💰</span>
                      <div>
                        <span className="text-sm font-semibold text-blue-800">חיסכון</span>
                        <p className="text-[0.6rem] text-blue-400 leading-tight">יוצא ביום קבלת שכר, לפני הוצאות</p>
                      </div>
                    </div>
                  </td>
                  {showNotes && <td></td>}
                  {showFixedToggle && <td></td>}
                  <td className="px-3 py-1.5 text-left">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={savings.value}
                      onChange={(e) => savings.onChange(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className={`w-full rounded-lg border px-2 py-1 text-right text-sm font-semibold focus:outline-none focus:ring-1 ${
                        savingsAmt > 0
                          ? "border-blue-300 bg-blue-100 text-blue-800 focus:ring-blue-400"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500 focus:ring-zinc-300"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-left">
                    <span className={`text-sm tabular-nums ${savBal < 0 ? "text-red-600 font-bold" : "text-zinc-500"}`}>
                      {savBal.toLocaleString()} ₪
                    </span>
                  </td>
                  <td></td>
                </tr>
              );
            })()}

            {rows.map((row, idx) => {
              const rowBal = rowBalances[idx] ?? 0;
              const amt = Number(row.amount) || 0;
              return (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none w-6 text-center">{row.icon}</span>
                      <input
                        type="text"
                        dir="rtl"
                        tabIndex={-1}
                        value={row.label}
                        onChange={(e) => updateRow(row.id, "label", e.target.value)}
                        placeholder="שם קטגוריה"
                        className="w-full bg-transparent text-sm font-medium text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:bg-white focus:rounded px-1"
                      />
                    </div>
                  </td>
                  {showNotes && (
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        dir="rtl"
                        value={row.notes ?? ""}
                        onChange={(e) => updateRow(row.id, "notes", e.target.value)}
                        placeholder="הערות פירוט..."
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-300"
                      />
                    </td>
                  )}
                  {showFixedToggle && (
                    <td className="px-3 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, "isFixed", !row.isFixed)}
                        className={`rounded-lg px-2 py-0.5 text-[0.65rem] font-semibold transition ${
                          row.isFixed
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-zinc-100 text-zinc-500 border border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        {row.isFixed ? "קבוע" : "משתנה"}
                      </button>
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-left">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, "amount", e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className={`w-full rounded-lg border px-2 py-1 text-right text-sm font-semibold focus:outline-none focus:ring-1 ${
                        amt > 0
                          ? "border-indigo-200 bg-indigo-50 text-indigo-800 focus:ring-indigo-400"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500 focus:ring-zinc-300"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-left">
                    <span className={`text-sm tabular-nums ${rowBal < 0 ? "text-red-600 font-bold" : "text-zinc-500"}`}>
                      {rowBal.toLocaleString()} ₪
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => deleteRow(row.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-300 transition hover:bg-red-50 hover:text-red-500"
                      title="מחק שורה"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}

            {businessSubsidy !== undefined && (() => {
              const subsidyBal = (rowBalances[rowBalances.length - 1] ?? income - savingsAmt) - subsidyAmt;
              return (
                <tr className={`border-b ${subsidyAmt > 0 ? "border-amber-200 bg-amber-50/70" : "border-zinc-100 bg-zinc-50/40"}`}>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none w-6 text-center">🏢</span>
                      <div>
                        <span className={`text-sm font-semibold ${subsidyAmt > 0 ? "text-amber-900" : "text-zinc-500"}`}>
                          השלמה לעסק
                        </span>
                        <p className="text-[0.6rem] text-zinc-400 leading-tight">
                          מתעדכן אוטומטית לפי תקציב העסקי
                        </p>
                      </div>
                    </div>
                  </td>
                  {showNotes && <td></td>}
                  {showFixedToggle && <td></td>}
                  <td className="px-3 py-1.5 text-left">
                    <span className={`inline-block w-full rounded-lg border px-2 py-1 text-right text-sm font-semibold tabular-nums ${
                      subsidyAmt > 0
                        ? "border-amber-300 bg-amber-100 text-amber-900"
                        : "border-zinc-200 bg-zinc-100 text-zinc-400"
                    }`}>
                      {subsidyAmt.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-left">
                    <span className={`text-sm tabular-nums ${subsidyBal < 0 ? "text-red-600 font-bold" : "text-zinc-500"}`}>
                      {subsidyBal.toLocaleString()} ₪
                    </span>
                  </td>
                  <td></td>
                </tr>
              );
            })()}

            <tr className={`border-t-2 ${remaining < 0 ? "border-red-200 bg-red-50/50" : "border-zinc-200 bg-zinc-50"}`}>
              <td className="px-3 py-2.5">
                <span className="text-sm font-bold text-zinc-700">{remaining < 0 ? "⚠️ חריגה מהכנסה" : "✅ יתרה"}</span>
              </td>
              {showNotes && <td></td>}
              {showFixedToggle && <td></td>}
              <td className="px-3 py-2.5 text-left text-xs text-zinc-400">
                הוצאות: {sumExpenseRows(rows).toLocaleString()} ₪
                {subsidyAmt > 0 && ` + השלמה לעסק: ${subsidyAmt.toLocaleString()} ₪`}
                {savingsAmt > 0 && ` + חיסכון: ${savingsAmt.toLocaleString()} ₪`}
              </td>
              <td className="px-3 py-2.5 text-left">
                <span className={`text-sm font-bold tabular-nums ${remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {remaining.toLocaleString()} ₪
                </span>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300/60 bg-violet-50/50 py-2.5 text-sm font-medium text-violet-600 transition hover:border-violet-400 hover:bg-violet-100/60 hover:text-violet-800 active:scale-[0.99]"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
        </svg>
        הוסף קטגוריה
      </button>
    </div>
  );
}

function BudgetSummaryCard({
  budget,
  onSave,
  onEditIncome,
  onEditExpenses,
  saving,
  saved,
}: {
  budget: BudgetSummary;
  onSave: () => void;
  onEditIncome: () => void;
  onEditExpenses: () => void;
  saving: boolean;
  saved: boolean;
}) {
  if (!budget.hasBreakdown) return null;

  const expensesOnly =
    budget.personalExpenses + budget.businessExpenses + budget.personalSubsidyToBusiness;
  const hasBusiness = budget.businessIncome > 0;
  const personalOut =
    budget.personalExpenses + budget.salarySavings + budget.personalSubsidyToBusiness;
  const netLeft = budget.surplus;

  type LineItem = {
    icon: string;
    label: string;
    detail?: string;
    amount: number;
    tone: "in" | "out" | "auto" | "result";
  };

  const personalLines: LineItem[] = [
    { icon: "💵", label: "הכנסה אישית", amount: budget.personalIncome, tone: "in" },
  ];
  if (budget.salarySavings > 0) {
    personalLines.push({ icon: "💰", label: "חיסכון", amount: -budget.salarySavings, tone: "out" });
  }
  for (const row of budget.expenseRows) {
    personalLines.push({
      icon: row.icon,
      label: row.label || "ללא שם",
      amount: -(Number(row.amount) || 0),
      tone: "out",
    });
  }
  if (budget.personalSubsidyToBusiness > 0) {
    personalLines.push({
      icon: "🏢",
      label: "השלמה לעסק",
      detail: "מכוסה מהאישי כי העסק במינוס",
      amount: -budget.personalSubsidyToBusiness,
      tone: "auto",
    });
  }
  personalLines.push({
    icon: netLeft >= 0 ? "✅" : "⚠️",
    label: "יתרה חופשית",
    detail: "אחרי חיסכון, הוצאות והשלמה לעסק",
    amount: netLeft,
    tone: "result",
  });

  const businessLines: LineItem[] = hasBusiness
    ? [
        { icon: "🏢", label: "הכנסה עסקית", amount: budget.businessIncome, tone: "in" },
        ...budget.businessExpenseRows.map((row) => ({
          icon: row.icon,
          label: row.label || "ללא שם",
          detail: row.notes?.trim() || undefined,
          amount: -(Number(row.amount) || 0),
          tone: "out" as const,
        })),
        {
          icon: budget.businessIncome - budget.businessExpenses >= 0 ? "✅" : "⚠️",
          label: budget.businessIncome - budget.businessExpenses >= 0 ? "יתרה עסקית" : "חוסר עסקי",
          detail:
            budget.businessDeficit > 0
              ? `${budget.businessDeficit.toLocaleString()} ₪ יגיעו מהאישי`
              : undefined,
          amount: budget.businessIncome - budget.businessExpenses,
          tone: "result" as const,
        },
      ]
    : [];

  const savingsPct =
    budget.personalIncome > 0
      ? Math.round((budget.salarySavings / budget.personalIncome) * 100)
      : 0;

  function amountClass(tone: LineItem["tone"], amount: number) {
    if (tone === "in") return "text-emerald-600 font-bold";
    if (tone === "out") return amount === 0 ? "text-zinc-500" : "text-zinc-700 font-semibold";
    if (tone === "auto") return "text-amber-700 font-semibold";
    return amount < 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold";
  }

  function formatAmount(amount: number, tone: LineItem["tone"]) {
    if (tone === "result") return `${amount.toLocaleString()} ₪`;
    if (amount === 0) return "0 ₪";
    return amount > 0 ? `+${amount.toLocaleString()} ₪` : `${amount.toLocaleString()} ₪`;
  }

  function SectionTable({
    title,
    subtitle,
    lines,
    theme,
  }: {
    title: string;
    subtitle: string;
    lines: LineItem[];
    theme: "personal" | "business";
  }) {
    const themeCls =
      theme === "personal"
        ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50"
        : "border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/50";
    const headCls =
      theme === "personal"
        ? "border-emerald-100 bg-gradient-to-l from-emerald-100/80 to-teal-50"
        : "border-violet-100 bg-gradient-to-l from-violet-100/80 to-fuchsia-50";

    return (
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${themeCls}`}>
        <div className={`border-b px-4 py-3 ${headCls}`}>
          <h3 className="text-sm font-bold text-zinc-800">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-600">{subtitle}</p>
        </div>
        <table className="w-full text-sm" style={{ direction: "rtl" }}>
          <thead>
            <tr className="border-b border-zinc-100/80">
              <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-500">פריט</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500 w-28">סכום</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const isResult = line.tone === "result";
              return (
                <tr
                  key={i}
                  className={`border-b border-zinc-100/60 ${isResult ? "bg-white/60" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{line.icon}</span>
                      <div>
                        <div className={`text-sm ${isResult ? "font-bold text-zinc-800" : "font-medium text-zinc-700"}`}>
                          {line.label}
                        </div>
                        {line.detail && (
                          <div className="text-[0.65rem] text-zinc-500">{line.detail}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-left tabular-nums">
                    <span className={amountClass(line.tone, line.amount)}>
                      {formatAmount(line.amount, line.tone)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/40 via-violet-50/30 to-emerald-50/40 p-4 shadow-inner">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 p-4 shadow-sm">
          <span className="absolute -left-1 -top-1 text-3xl opacity-20">📈</span>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">נכנס החודש</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800 tabular-nums">
            {budget.income.toLocaleString()} ₪
          </p>
          <p className="mt-1 text-[0.65rem] text-emerald-700/80">
            {hasBusiness
              ? `אישי ${budget.personalIncome.toLocaleString()} + עסק ${budget.businessIncome.toLocaleString()}`
              : "הכנסה אישית"}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-100 via-orange-50 to-rose-50 p-4 shadow-sm">
          <span className="absolute -left-1 -top-1 text-3xl opacity-20">🛍️</span>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">יוצא החודש</p>
          <p className="mt-2 text-2xl font-bold text-orange-800 tabular-nums">
            {expensesOnly.toLocaleString()} ₪
          </p>
          <p className="mt-1 text-[0.65rem] text-orange-700/80">
            הוצאות בלבד{budget.personalSubsidyToBusiness > 0 ? " (כולל השלמה לעסק)" : ""}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-100 via-sky-50 to-indigo-50 p-4 shadow-sm">
          <span className="absolute -left-1 -top-1 text-3xl opacity-20">🐷</span>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">הולך לחיסכון</p>
          <p className="mt-2 text-2xl font-bold text-sky-800 tabular-nums">
            {budget.salarySavings.toLocaleString()} ₪
          </p>
          <p className="mt-1 text-[0.65rem] text-sky-700/80">
            {budget.salarySavings > 0 && budget.personalIncome > 0
              ? `${savingsPct}% מההכנסה · ביום קבלת שכר 🎯`
              : "הגדר סכום בשלב הוצאות"}
          </p>
        </div>
      </div>

      <SectionTable
        title="🏠 חיים אישיים"
        subtitle={`הכנסה ${budget.personalIncome.toLocaleString()} ₪ · יוצא ${personalOut.toLocaleString()} ₪`}
        lines={personalLines}
        theme="personal"
      />

      {hasBusiness && (
        <SectionTable
          title="🏢 עסק"
          subtitle={`הכנסה ${budget.businessIncome.toLocaleString()} ₪ · הוצאות ${budget.businessExpenses.toLocaleString()} ₪`}
          lines={businessLines}
          theme="business"
        />
      )}

      {budget.surplus < 0 && (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-l from-red-50 to-rose-50 px-4 py-3 text-sm text-red-800">
          ההוצאות האישיות עולות על ההכנסה האישית (אחרי חיסכון והשלמה לעסק).
          לחץ &quot;ערוך הוצאות&quot; לתיקון.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onEditIncome}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:shadow-sm active:scale-[0.98]"
        >
          ✏️ ערוך הכנסות
        </button>
        <button
          type="button"
          onClick={onEditExpenses}
          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-100 hover:shadow-sm active:scale-[0.98]"
        >
          ✏️ ערוך הוצאות
        </button>
      </div>

      <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-l from-indigo-50 to-violet-50 p-4 shadow-sm">
        {saved ? (
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-400 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-md">
            <span className="text-lg">🎉</span>
            <span>נשמר! תקציב חודשי {budget.expenseLimit.toLocaleString()} ₪</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "שומר..." : "💾 שמור תקציב חודשי"}
          </button>
        )}
        <p className="mt-2 text-center text-xs text-indigo-700/70">
          מגבלת הוצאות אישית = הכנסה אישית פחות חיסכון ({budget.salarySavings.toLocaleString()} ₪)
          {budget.personalSubsidyToBusiness > 0 &&
            ` פחות השלמה לעסק (${budget.personalSubsidyToBusiness.toLocaleString()} ₪)`}
        </p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
type PersistedState = { answers: WizardAnswers; step: WizardStep; done: boolean };

function loadFromStorage(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of [WIZARD_LS_KEY, "budget_wizard_v3", "budget_wizard_v2", "budget_wizard_v1"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as PersistedState;
      const answers = migrateAnswers(parsed.answers as LegacyWizardAnswers);
      const step = migrateStep(parsed.step, parsed.done);
      const done = step === 3;
      return { answers, step, done };
    }
    return null;
  } catch { return null; }
}

function saveToStorage(state: PersistedState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(WIZARD_LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function profileBodyFromState(state: PersistedState) {
  return {
    wizardState: state,
    wizardCompleted: state.done,
    monthlySavings: state.answers.monthlySavings || undefined,
    personalCategories: state.answers.expenseRows.map((r) => r.label.trim()).filter(Boolean),
    businessCategories: state.answers.businessExpenseRows.map((r) => r.label.trim()).filter(Boolean),
  };
}

async function pushWizardStateToServer(state: PersistedState) {
  await fetch("/api/budget/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(profileBodyFromState(state)),
  });
}

function applyPersistedState(
  state: PersistedState,
  setters: {
    setAnswers: (a: WizardAnswers) => void;
    setStep: (s: WizardStep) => void;
    setDone: (d: boolean) => void;
    setSummary: (s: BudgetSummary | null) => void;
  },
) {
  setters.setAnswers(state.answers);
  setters.setStep(state.step);
  setters.setDone(state.done);
  if (state.done) {
    setters.setSummary(computeBudgetSummary(state.answers));
  }
  saveToStorage(state);
}


export default function BudgetWizard({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [answers, setAnswers] = useState<WizardAnswers>(INITIAL_ANSWERS);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from server (cross-device), fallback to localStorage
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = loadFromStorage();

      try {
        const res = await fetch("/api/budget/profile");
        if (!res.ok) throw new Error("profile fetch failed");
        const body = (await res.json()) as { profile: { wizardState?: unknown } | null };
        const serverRaw = body.profile?.wizardState;
        const server = serverRaw ? parseWizardState(serverRaw) : null;

        if (!cancelled && server) {
          const state: PersistedState = {
            answers: migrateAnswers(server.answers as LegacyWizardAnswers),
            step: server.step,
            done: server.done,
          };
          applyPersistedState(state, { setAnswers, setStep, setDone, setSummary });
        } else if (!cancelled && local) {
          applyPersistedState(local, { setAnswers, setStep, setDone, setSummary });
          void pushWizardStateToServer(local);
        }
      } catch {
        if (!cancelled && local) {
          applyPersistedState(local, { setAnswers, setStep, setDone, setSummary });
        }
      }

      if (!cancelled) setHydrated(true);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  // Cache locally + sync to server (debounced)
  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { answers, step, done };
    saveToStorage(state);

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void pushWizardStateToServer(state);
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [answers, step, done, hydrated]);

  function set<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === 1) return hasIncomeSource(answers);
    return true;
  }

  function toggleIncomeSource(key: keyof IncomeSources) {
    setAnswers((prev) => ({
      ...prev,
      incomeSources: { ...prev.incomeSources, [key]: !prev.incomeSources[key] },
    }));
  }

  function next() {
    if (!canAdvance()) return;
    if (step < 2) {
      setStep((s) => (s + 1) as WizardStep);
    } else {
      advanceToSummary();
    }
  }

  function advanceToSummary() {
    setSummary(computeBudgetSummary(answers));
    setStep(3);
    setDone(true);
    setSaved(false);
  }

  function returnToSummary() {
    setSummary(computeBudgetSummary(answers));
    setStep(3);
  }

  function goToEditIncome() {
    setStep(1);
    setSaved(false);
  }

  function goToEditExpenses() {
    setStep(2);
    setSaved(false);
  }

  function goToStep(s: WizardStep) {
    if (s === 3) {
      returnToSummary();
      return;
    }
    setStep(s);
    setSaved(false);
  }

  function back() {
    if (step === 3) {
      setStep(2);
    } else if (step > 1) {
      setStep((s) => (s - 1) as WizardStep);
    }
  }

  function reset() {
    if (typeof window !== "undefined") localStorage.removeItem(WIZARD_LS_KEY);
    void fetch("/api/budget/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wizardState: null }),
    });
    setAnswers(INITIAL_ANSWERS); setStep(1); setDone(false); setSummary(null); setSaved(false);
  }

  async function saveBudget(expenseLimit: number) {
    setSaving(true);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const state: PersistedState = { answers, step: 3, done: true };

    await Promise.all([
      fetch("/api/budget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, expenseLimit: expenseLimit.toFixed(2) }),
      }),
      fetch("/api/budget/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profileBodyFromState(state)),
      }),
    ]);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 via-white to-emerald-50/60 shadow-xl shadow-violet-100/40">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/20 bg-gradient-to-l from-violet-600 via-indigo-600 to-teal-600 px-5 py-5 text-white">
        <div className="pointer-events-none absolute -left-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-4 left-1/3 h-20 w-20 rounded-full bg-teal-400/20" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">✨ תכנון תקציב</h2>
            <p className="mt-1 text-sm text-white/85">הכסף שלך, בצבע ובבהירות — בלי כאבי ראש</p>
          </div>
          <div className="flex items-center gap-2">
            {done && (
              <button
                type="button"
                onClick={() => { if (confirm("לאפס את השאלון ולהתחיל מחדש?")) reset(); }}
                className="flex items-center gap-1 rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition hover:bg-white/20"
                title="אפס שאלון"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 8a6 6 0 1 1 1.5 4" strokeLinecap="round" />
                  <path d="M2 13V9h4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                אפס שאלון
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="relative mt-5 flex gap-2">
          {([1, 2, 3] as WizardStep[]).map((s) => {
            const meta = STEP_META[s - 1];
            const isActive = s === step;
            const isDone = s < step;
            return (
              <button
                key={s}
                type="button"
                disabled={!done && !isActive && s > step}
                onClick={() => (done || s <= step) && goToStep(s)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition ${
                  isActive
                    ? "bg-white/20 ring-2 ring-white/50"
                    : isDone
                      ? "bg-white/10 hover:bg-white/15"
                      : "opacity-50"
                } ${done ? "cursor-pointer" : s <= step ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className="text-lg leading-none">{meta.emoji}</span>
                <span className="text-[0.65rem] font-semibold">{stepTitles[s - 1]}</span>
                <div className={`h-1 w-full rounded-full bg-gradient-to-l ${meta.gradient} ${!isActive && !isDone ? "opacity-30" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">

        {done && step < 3 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 to-fuchsia-50 px-4 py-3 shadow-sm">
            <span className="text-sm font-medium text-violet-800">✏️ מצב עריכה — שינוי נקודתי</span>
            <button type="button" onClick={returnToSummary} className="rounded-lg bg-violet-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98]">
              חזרה לסיכום ✨
            </button>
          </div>
        )}

        {/* ── Step 1: Income ── */}
        {step === 1 && (
          <div className="space-y-5">
            <StepBanner step={1} />

            <div>
              <label className="text-sm font-bold text-zinc-800">מאילו מקורות מגיעה ההכנסה שלך?</label>
              <div className="mt-3 space-y-2">
                {([
                  ["steady", "שכיר (משכורת קבועה)", "אותו סכום כל חודש"],
                  ["variable", "עצמאי / עסק צדדי", "פרילנס, סוכנות, עסק"],
                  ["other", "אחר", "קצבה, עזרת משפחה, חסכונות"],
                ] as const).map(([key, title, sub]) => {
                  const style = INCOME_SOURCE_STYLE[key];
                  return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${
                      answers.incomeSources[key]
                        ? style.active
                        : "border-zinc-200 bg-white/60 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <span className="text-2xl leading-none">{style.emoji}</span>
                    <input
                      type="checkbox"
                      checked={answers.incomeSources[key]}
                      onChange={() => toggleIncomeSource(key)}
                      className={`mt-1 h-4 w-4 rounded border-zinc-300 ${style.accent}`}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-zinc-900">{title}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>
                    </div>
                  </label>
                  );
                })}
              </div>
              {!hasIncomeSource(answers) && (
                <p className="mt-2 text-xs text-red-500">יש לבחור לפחות מקור הכנסה אחד</p>
              )}
            </div>

            {answers.incomeSources.steady && (
              <NumField
                label="הכנסה נטו חודשית ממשכורת ₪"
                value={answers.salaryIncome}
                onChange={(v) => set("salaryIncome", v)}
                placeholder="למשל 12000"
              />
            )}

            {answers.incomeSources.variable && (
              <NumField
                label="הכנסה נטו חודשית מהעסק ₪"
                value={answers.businessIncome}
                onChange={(v) => set("businessIncome", v)}
                placeholder="למשל 5000"
              />
            )}

            {answers.incomeSources.other && (
              <NumField
                label="הכנסה חודשית ממקורות אחרים ₪"
                value={answers.otherIncome}
                onChange={(v) => set("otherIncome", v)}
                placeholder="ניתן להשאיר 0"
              />
            )}

            {hasIncomeSource(answers) && (() => {
              const s = computeIncomeSplit(answers);
              return (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-teal-50 p-4 text-sm text-emerald-900 shadow-sm space-y-1">
                  {(answers.incomeSources.steady || answers.incomeSources.other) && (
                    <div>
                      <span className="font-semibold">הכנסה אישית: </span>
                      {s.personalNet.toLocaleString()} ₪
                    </div>
                  )}
                  {answers.incomeSources.variable && (
                    <div>
                      <span className="font-semibold">הכנסה עסקית: </span>
                      {s.businessNet.toLocaleString()} ₪
                    </div>
                  )}
                  {s.businessNet > 0 && s.personalNet > 0 && (
                    <div className="text-xs text-emerald-700 pt-1 border-t border-emerald-200">
                      בשלב 2 תבנה תקציב נפרד לכל אחד. אם העסק במינוס — תשלים מהאישי.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Step 2: Personal + business expense tables ── */}
        {step === 2 && (() => {
          const split = computeIncomeSplit(answers);
          const personalIncome = split.personalNet;
          const businessIncome = split.businessNet;
          const showPersonal = answers.incomeSources.steady || answers.incomeSources.other;
          const showBusiness = answers.incomeSources.variable;
          const businessExpenses = sumExpenseRows(answers.businessExpenseRows);
          const businessRemaining = businessIncome - businessExpenses;
          const businessDeficit = Math.max(0, -businessRemaining);
          const personalExpenses = sumExpenseRows(answers.expenseRows);
          const savings = Number(answers.monthlySavings) || 0;
          const personalRemaining = personalIncome - savings - personalExpenses - businessDeficit;
          const fixedTotal = answers.expenseRows
            .filter((r) => r.isFixed)
            .reduce((s, r) => s + (Number(r.amount) || 0), 0);

          return (
            <div className="space-y-5">
              <StepBanner step={2} />

              {showBusiness && (
                <ExpenseBudgetTable
                  title="תקציב עסקי"
                  subtitle={`הכנסה עסקית: ${businessIncome.toLocaleString()} ₪`}
                  headerClass="border-violet-200 bg-gradient-to-l from-violet-100 to-fuchsia-50 text-violet-900"
                  income={businessIncome}
                  incomeLabel="הכנסה עסקית"
                  incomeIcon="🏢"
                  rows={answers.businessExpenseRows}
                  onRowsChange={(rows) => set("businessExpenseRows", rows)}
                  showNotes
                  showFixedToggle={false}
                />
              )}

              {showPersonal && (
                <>
                  {fixedTotal > 0 && answers.incomeSources.steady && Number(answers.salaryIncome) > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      הוצאות קבועות אישיות: <strong>{fixedTotal.toLocaleString()} ₪</strong>
                      {" "}— משכורת: {Number(answers.salaryIncome).toLocaleString()} ₪
                      {Number(answers.salaryIncome) < fixedTotal
                        ? " (לא מכסה את הקבועות!)"
                        : ` (נשארים ${(Number(answers.salaryIncome) - fixedTotal).toLocaleString()} ₪)`}
                    </div>
                  )}

                  <ExpenseBudgetTable
                    title="תקציב חיים אישיים"
                    subtitle={`הכנסה אישית: ${personalIncome.toLocaleString()} ₪`}
                    headerClass="border-emerald-200 bg-gradient-to-l from-emerald-100 to-teal-50 text-emerald-900"
                    income={personalIncome}
                    incomeLabel="הכנסה אישית"
                    savings={{ value: answers.monthlySavings, onChange: (v) => set("monthlySavings", v) }}
                    rows={answers.expenseRows}
                    onRowsChange={(rows) => set("expenseRows", rows)}
                    businessSubsidy={showBusiness ? businessDeficit : undefined}
                  />
                </>
              )}

              {showPersonal && showBusiness && (
                <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                  personalRemaining < 0
                    ? "border-red-200 bg-gradient-to-l from-red-50 to-rose-50 text-red-800"
                    : "border-emerald-200 bg-gradient-to-l from-emerald-50 to-teal-50 text-emerald-900"
                }`}>
                  <span className="font-bold">📊 סיכום מהיר: </span>
                  אישי {personalIncome.toLocaleString()} ₪
                  {businessIncome > 0 && ` + עסק ${businessIncome.toLocaleString()} ₪`}
                  {" → "}
                  <span className={personalRemaining < 0 ? "font-bold text-red-600" : "font-bold text-emerald-600"}>
                    יתרה אישית {personalRemaining.toLocaleString()} ₪
                  </span>
                  {businessDeficit > 0 && (
                    <span className="text-xs block mt-1 text-amber-700">
                      (כולל השלמה של {businessDeficit.toLocaleString()} ₪ לעסק)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Step 3: Summary ── */}
        {step === 3 && summary && (
          <div className="space-y-4">

            <BudgetSummaryCard
              budget={summary}
              onSave={() => saveBudget(summary.expenseLimit)}
              onEditIncome={goToEditIncome}
              onEditExpenses={goToEditExpenses}
              saving={saving}
              saved={saved}
            />

            <button
              type="button"
              onClick={() => { if (confirm("לאפס את כל התקציב ולהתחיל מהתחלה?")) reset(); }}
              className="w-full text-center text-xs text-zinc-400 hover:text-red-500 transition"
            >
              איפוס מלא והתחלה מחדש
            </button>
          </div>
        )}

        {/* Navigation — always visible */}
        <div className="mt-6 flex items-center justify-between border-t border-violet-100/80 pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]"
            >
              ← חזרה
            </button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <span className="rounded-full bg-violet-100/80 px-3 py-1 text-xs font-medium text-violet-700">
              שלב {step} מתוך 3
            </span>
          )}

          {/* Forward button — steps 1–4 only */}
          {step < 3 ? (
            <button
              type="button"
              onClick={done && step === 2 ? returnToSummary : next}
              disabled={!canAdvance()}
              className="rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:opacity-40"
            >
              {step === 2 ? (done ? "עדכן סיכום ✨" : "לסיכום ✨") : "הבא ←"}
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
