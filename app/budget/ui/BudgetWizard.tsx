"use client";

import { useState, useEffect, useRef } from "react";
import { parseWizardState } from "@/app/lib/budget/wizard-state";
import {
  IconBriefcase,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconRefresh,
  IconSavings,
  IconTrash,
  IconWallet,
  IconGrid,
} from "@/app/ui/icons";

const WIZARD_LS_KEY = "budget_wizard_v4";

type ExpenseRow = {
  id: string;
  /** Legacy field, kept for stored state compatibility; not rendered. */
  icon: string;
  label: string;
  amount: string;
  notes?: string;
};

const DEFAULT_PERSONAL_EXPENSE_ROWS: ExpenseRow[] = [
  { id: "car",           icon: "", label: "דלק/רכב",                amount: "" },
  { id: "food",          icon: "", label: "אוכל",                   amount: "" },
  { id: "entertainment", icon: "", label: "בזבוזים",                amount: "" },
  { id: "events",        icon: "", label: "יום הולדת/אירוע מיוחד", amount: "" },
  { id: "train",         icon: "", label: "רכבת",                   amount: "" },
];

const DEFAULT_BUSINESS_EXPENSE_ROWS: ExpenseRow[] = [];

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
  return rows.map((r) => ({
    ...r,
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

// ─── UI helpers ───────────────────────────────────────────────────────────────

const STEP_TITLES = ["הכנסה", "הוצאות", "סיכום"] as const;

/** One color per category, shared by the expense list and the summary bar. */
const CATEGORY_COLORS = [
  "var(--chart-6)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-4)",
];

function colorAt(i: number) {
  return CATEGORY_COLORS[i % CATEGORY_COLORS.length]!;
}

function ils(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function digitsOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

function AmountInput(props: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <span className="bw-amount">
      <input
        className="bw-amount-input amount"
        inputMode="numeric"
        dir="ltr"
        value={props.value}
        onChange={(e) => props.onChange(digitsOnly(e.target.value))}
        placeholder="0"
        aria-label={props.label}
        autoFocus={props.autoFocus}
        enterKeyHint="done"
      />
      <span className="bw-amount-unit" aria-hidden>₪</span>
    </span>
  );
}

function Switch(props: { on: boolean }) {
  return (
    <span className={`bw-switch${props.on ? " is-on" : ""}`} aria-hidden>
      <span className="bw-switch-knob" />
    </span>
  );
}

function SectionHead(props: { title: string; meta?: string }) {
  return (
    <div className="bw-section-head">
      <h3>{props.title}</h3>
      {props.meta ? <span className="amount">{props.meta}</span> : null}
    </div>
  );
}

function ExpenseList(props: {
  rows: ExpenseRow[];
  onRowsChange: (rows: ExpenseRow[]) => void;
  colorOffset?: number;
  showNotes?: boolean;
  addLabel: string;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  function updateRow(id: string, field: keyof ExpenseRow, value: string) {
    props.onRowsChange(props.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function deleteRow(id: string) {
    props.onRowsChange(props.rows.filter((r) => r.id !== id));
  }

  function addRow() {
    const id = `custom_${Date.now()}`;
    props.onRowsChange([...props.rows, { id, icon: "", label: "", amount: "", notes: "" }]);
    setFocusId(id);
  }

  return (
    <div className="bw-group">
      {props.rows.map((row, i) => (
        <div key={row.id} className="bw-expense">
          <span className="bw-dot" style={{ background: colorAt(i + (props.colorOffset ?? 0)) }} aria-hidden />
          <div className="bw-expense-main">
            <input
              className="bw-expense-name"
              value={row.label}
              onChange={(e) => updateRow(row.id, "label", e.target.value)}
              placeholder="שם הקטגוריה"
              aria-label="שם הקטגוריה"
              autoFocus={focusId === row.id}
              enterKeyHint="next"
            />
            {props.showNotes ? (
              <input
                className="bw-expense-note"
                value={row.notes ?? ""}
                onChange={(e) => updateRow(row.id, "notes", e.target.value)}
                placeholder="הערה (לא חובה)"
                aria-label="הערה"
              />
            ) : null}
          </div>
          <AmountInput
            value={row.amount}
            onChange={(v) => updateRow(row.id, "amount", v)}
            label={`סכום חודשי ל${row.label || "קטגוריה"}`}
          />
          <button
            type="button"
            className="bw-icon-btn bw-icon-btn--danger"
            onClick={() => deleteRow(row.id)}
            aria-label={`מחק את ${row.label || "הקטגוריה"}`}
          >
            <IconTrash className="h-[1.15rem] w-[1.15rem]" />
          </button>
        </div>
      ))}
      <button type="button" className="bw-add" onClick={addRow}>
        <IconPlus className="h-5 w-5" />
        {props.addLabel}
      </button>
    </div>
  );
}

// ─── Persistence ──────────────────────────────────────────────────────────────

type PersistedState = { answers: WizardAnswers; step: WizardStep; done: boolean };

function getWizardStorageKey(userId: string) {
  return `${WIZARD_LS_KEY}:${userId}`;
}

function loadFromStorage(userId: string): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of [
      getWizardStorageKey(userId),
      `${"budget_wizard_v3"}:${userId}`,
      `${"budget_wizard_v2"}:${userId}`,
      `${"budget_wizard_v1"}:${userId}`,
    ]) {
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

function saveToStorage(userId: string, state: PersistedState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(getWizardStorageKey(userId), JSON.stringify(state)); } catch { /* ignore */ }
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
  userId: string,
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
  saveToStorage(userId, state);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BudgetWizard({ userId }: { userId: string }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [answers, setAnswers] = useState<WizardAnswers>(INITIAL_ANSWERS);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Load from server (cross-device), fallback to localStorage
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = loadFromStorage(userId);

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
          applyPersistedState(userId, state, { setAnswers, setStep, setDone, setSummary });
        } else if (!cancelled && local) {
          applyPersistedState(userId, local, { setAnswers, setStep, setDone, setSummary });
          void pushWizardStateToServer(local);
        }
      } catch {
        if (!cancelled && local) {
          applyPersistedState(userId, local, { setAnswers, setStep, setDone, setSummary });
        }
      }

      if (!cancelled) setHydrated(true);
    }

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  // Cache locally + sync to server (debounced)
  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { answers, step, done };
    saveToStorage(userId, state);

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void pushWizardStateToServer(state);
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [answers, step, done, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step, hydrated]);

  function set<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
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
    setSaved(false);
  }

  function goToSummary() {
    setSummary(computeBudgetSummary(answers));
    setStep(3);
    setDone(true);
  }

  function next() {
    if (!canAdvance()) return;
    if (step === 1) setStep(2);
    else goToSummary();
  }

  function back() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  function goToStep(s: WizardStep) {
    if (s === 3) {
      if (hasIncomeSource(answers)) goToSummary();
      return;
    }
    setStep(s);
  }

  function reset() {
    if (typeof window !== "undefined") localStorage.removeItem(getWizardStorageKey(userId));
    void fetch("/api/budget/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wizardState: null }),
    });
    setAnswers(INITIAL_ANSWERS); setStep(1); setDone(false); setSummary(null); setSaved(false);
  }

  async function saveBudget(expenseLimit: number) {
    setSaving(true);
    const state: PersistedState = { answers, step: 3, done: true };

    await Promise.all([
      fetch("/api/budget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expenseLimit: expenseLimit.toFixed(2) }),
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

  const split = computeIncomeSplit(answers);
  const savingsAmt = Number(answers.monthlySavings) || 0;
  const personalExpenses = sumExpenseRows(answers.expenseRows);
  const businessExpenses = sumExpenseRows(answers.businessExpenseRows);
  const businessDeficit = answers.incomeSources.variable ? Math.max(0, businessExpenses - split.businessNet) : 0;
  const personalLeft = split.personalNet - savingsAmt - personalExpenses - businessDeficit;
  const showPersonal = answers.incomeSources.steady || answers.incomeSources.other;
  const showBusiness = answers.incomeSources.variable;

  if (!hydrated) {
    return <div className="bw-loading" aria-busy="true">טוען את התקציב…</div>;
  }

  return (
    <div className="bw" ref={topRef}>
      {/* Step control */}
      <nav className="bw-steps" aria-label="שלבי התקציב">
        {([1, 2, 3] as WizardStep[]).map((s) => {
          const reachable = done || s <= step;
          return (
            <button
              key={s}
              type="button"
              className={`bw-step${s === step ? " is-active" : ""}${s < step || (done && s !== step) ? " is-done" : ""}`}
              onClick={() => reachable && goToStep(s)}
              disabled={!reachable}
              aria-current={s === step ? "step" : undefined}
            >
              <span className="bw-step-num">{s < step || (done && s !== step) ? <IconCheck className="h-3.5 w-3.5" /> : s}</span>
              {STEP_TITLES[s - 1]}
            </button>
          );
        })}
      </nav>

      {/* ── Step 1: Income ── */}
      {step === 1 && (
        <section className="bw-screen">
          <header className="bw-intro">
            <h2>כמה נכנס לך בחודש?</h2>
            <p>בחר את מקורות ההכנסה והזן סכום נטו.</p>
          </header>

          <div className="bw-group">
            {([
              ["steady", "משכורת", "סכום קבוע כל חודש", IconWallet, "salaryIncome"],
              ["variable", "עסק / פרילנס", "הכנסה משתנה מהעסק", IconBriefcase, "businessIncome"],
              ["other", "הכנסה אחרת", "קצבה, עזרה, שכירות", IconGrid, "otherIncome"],
            ] as const).map(([key, title, sub, Icon, field]) => {
              const on = answers.incomeSources[key];
              return (
                <div key={key} className={`bw-source${on ? " is-on" : ""}`}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    className="bw-source-toggle"
                    onClick={() => toggleIncomeSource(key)}
                  >
                    <span className="bw-tile"><Icon className="h-5 w-5" /></span>
                    <span className="bw-source-text">
                      <span className="bw-source-title">{title}</span>
                      <span className="bw-source-sub">{sub}</span>
                    </span>
                    <Switch on={on} />
                  </button>
                  {on ? (
                    <div className="bw-source-amount">
                      <span>סכום חודשי נטו</span>
                      <AmountInput
                        value={answers[field]}
                        onChange={(v) => set(field, v)}
                        label={`${title}, סכום חודשי נטו`}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {hasIncomeSource(answers) ? (
            <div className="bw-total">
              <span>סה״כ הכנסה חודשית</span>
              <strong className="amount">{ils(split.net)}</strong>
              {split.businessNet > 0 && split.personalNet > 0 ? (
                <small>אישי {ils(split.personalNet)} · עסק {ils(split.businessNet)}</small>
              ) : null}
            </div>
          ) : (
            <p className="bw-hint">בחר לפחות מקור הכנסה אחד כדי להמשיך.</p>
          )}
        </section>
      )}

      {/* ── Step 2: Expenses ── */}
      {step === 2 && (
        <section className="bw-screen">
          <header className="bw-intro">
            <h2>לאן הולך הכסף?</h2>
            <p>כמה אתה מתכנן להוציא בכל קטגוריה בחודש.</p>
          </header>

          {showPersonal ? (
            <div className={`bw-remain${personalLeft < 0 ? " is-over" : ""}`} role="status" aria-live="polite">
              <span>{personalLeft < 0 ? "חריגה מההכנסה" : "נשאר לחלוקה"}</span>
              <strong className="amount">{ils(Math.abs(personalLeft))}</strong>
            </div>
          ) : null}

          {showPersonal ? (
            <>
              <SectionHead title="חיסכון" />
              <div className="bw-group">
                <div className="bw-expense">
                  <span className="bw-tile bw-tile--sm"><IconSavings className="h-[1.1rem] w-[1.1rem]" /></span>
                  <div className="bw-expense-main">
                    <span className="bw-expense-fixed">חיסכון חודשי</span>
                    <span className="bw-expense-sub">יוצא ביום המשכורת, לפני הוצאות</span>
                  </div>
                  <AmountInput
                    value={answers.monthlySavings}
                    onChange={(v) => set("monthlySavings", v)}
                    label="חיסכון חודשי"
                  />
                </div>
              </div>

              <SectionHead title="הוצאות אישיות" meta={ils(personalExpenses)} />
              <ExpenseList
                rows={answers.expenseRows}
                onRowsChange={(rows) => set("expenseRows", rows)}
                addLabel="הוסף קטגוריה"
              />
            </>
          ) : null}

          {showBusiness ? (
            <>
              <SectionHead title="הוצאות העסק" meta={`${ils(businessExpenses)} מתוך ${ils(split.businessNet)}`} />
              <ExpenseList
                rows={answers.businessExpenseRows}
                onRowsChange={(rows) => set("businessExpenseRows", rows)}
                colorOffset={answers.expenseRows.length}
                showNotes
                addLabel="הוסף הוצאה עסקית"
              />
              {businessDeficit > 0 ? (
                <p className="bw-hint bw-hint--warn">
                  העסק במינוס {ils(businessDeficit)}. הסכום יורד מהתקציב האישי.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      )}

      {/* ── Step 3: Summary ── */}
      {step === 3 && summary && summary.hasBreakdown && (() => {
        const s = summary;
        const free = s.surplus;
        const base = Math.max(s.personalIncome, 1);
        const slices = [
          ...s.expenseRows
            .map((r, i) => ({ label: r.label || "ללא שם", amount: Number(r.amount) || 0, color: colorAt(i) }))
            .filter((x) => x.amount > 0),
          ...(s.salarySavings > 0 ? [{ label: "חיסכון", amount: s.salarySavings, color: "var(--brand)" }] : []),
          ...(s.personalSubsidyToBusiness > 0
            ? [{ label: "השלמה לעסק", amount: s.personalSubsidyToBusiness, color: "var(--negative)" }]
            : []),
        ];

        return (
          <section className="bw-screen">
            <div className="bw-hero">
              <span className="bw-hero-label">תקציב הוצאות חודשי</span>
              <strong className="bw-hero-value amount">{ils(s.expenseLimit)}</strong>
              <span className="bw-hero-sub">
                הכנסה {ils(s.personalIncome)}{s.salarySavings > 0 ? ` פחות חיסכון ${ils(s.salarySavings)}` : ""}
              </span>
            </div>

            <div className="bw-stats">
              <div><span>נכנס</span><strong className="amount">{ils(s.income)}</strong></div>
              <div><span>מתוכנן</span><strong className="amount">{ils(s.personalExpenses + s.personalSubsidyToBusiness)}</strong></div>
              <div className={free < 0 ? "is-over" : "is-ok"}>
                <span>{free < 0 ? "חריגה" : "נשאר חופשי"}</span>
                <strong className="amount">{ils(Math.abs(free))}</strong>
              </div>
            </div>

            {s.personalIncome > 0 ? (
              <>
                <SectionHead title="לאן הולכת ההכנסה" />
                <div className="bw-group bw-alloc">
                  <div className="bw-alloc-bar" role="img" aria-label="חלוקת ההכנסה">
                    {slices.map((x, i) => (
                      <span key={i} style={{ width: `${(x.amount / base) * 100}%`, background: x.color }} />
                    ))}
                  </div>
                  {slices.map((x, i) => (
                    <div key={i} className="bw-alloc-row">
                      <span className="bw-dot" style={{ background: x.color }} aria-hidden />
                      <span className="bw-alloc-label">{x.label}</span>
                      <span className="bw-alloc-pct">{Math.round((x.amount / base) * 100)}%</span>
                      <span className="bw-alloc-amount amount">{ils(x.amount)}</span>
                    </div>
                  ))}
                  <div className={`bw-alloc-row is-total${free < 0 ? " is-over" : ""}`}>
                    <span className="bw-dot bw-dot--ring" aria-hidden />
                    <span className="bw-alloc-label">{free < 0 ? "חריגה" : "נשאר חופשי"}</span>
                    <span className="bw-alloc-pct">{Math.round((Math.abs(free) / base) * 100)}%</span>
                    <span className="bw-alloc-amount amount">{ils(free)}</span>
                  </div>
                </div>
              </>
            ) : null}

            {s.businessIncome > 0 ? (
              <>
                <SectionHead title="העסק" />
                <div className="bw-group">
                  <div className="bw-alloc-row">
                    <span className="bw-alloc-label">הכנסה עסקית</span>
                    <span className="bw-alloc-amount amount">{ils(s.businessIncome)}</span>
                  </div>
                  {s.businessExpenseRows
                    .filter((r) => (Number(r.amount) || 0) > 0)
                    .map((r) => (
                      <div key={r.id} className="bw-alloc-row">
                        <span className="bw-alloc-label">
                          {r.label || "ללא שם"}
                          {r.notes?.trim() ? <small>{r.notes}</small> : null}
                        </span>
                        <span className="bw-alloc-amount amount">−{ils(Number(r.amount) || 0)}</span>
                      </div>
                    ))}
                  <div className={`bw-alloc-row is-total${s.businessIncome - s.businessExpenses < 0 ? " is-over" : ""}`}>
                    <span className="bw-alloc-label">{s.businessIncome - s.businessExpenses < 0 ? "חוסר בעסק" : "נשאר בעסק"}</span>
                    <span className="bw-alloc-amount amount">{ils(s.businessIncome - s.businessExpenses)}</span>
                  </div>
                </div>
              </>
            ) : null}

            {free < 0 ? (
              <p className="bw-hint bw-hint--warn" role="alert">
                ההוצאות המתוכננות גבוהות מההכנסה ב־{ils(Math.abs(free))}. כדאי להוריד בקטגוריות או בחיסכון.
              </p>
            ) : null}

            <div className="bw-group">
              <button type="button" className="bw-link-row" onClick={() => setStep(1)}>
                <span>עריכת הכנסות</span>
                <IconChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" className="bw-link-row" onClick={() => setStep(2)}>
                <span>עריכת הוצאות</span>
                <IconChevronLeft className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              className="bw-reset"
              onClick={() => { if (confirm("למחוק את התקציב ולהתחיל מהתחלה?")) reset(); }}
            >
              <IconRefresh className="h-4 w-4" />
              התחלה מחדש
            </button>
          </section>
        );
      })()}

      {/* Bottom action bar */}
      <div className="bw-bar">
        {step > 1 ? (
          <button type="button" className="bw-bar-back" onClick={back} aria-label="חזרה לשלב הקודם">
            <IconChevronRight className="h-6 w-6" />
          </button>
        ) : null}

        {step < 3 ? (
          <button type="button" className="btn btn-primary bw-bar-cta" onClick={next} disabled={!canAdvance()}>
            {step === 1 ? "המשך להוצאות" : done ? "עדכן סיכום" : "לסיכום"}
          </button>
        ) : saved ? (
          <div className="bw-bar-saved" role="status">
            <IconCheck className="h-5 w-5" />
            נשמר · {ils(summary?.expenseLimit ?? 0)} לחודש
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary bw-bar-cta"
            onClick={() => summary && void saveBudget(summary.expenseLimit)}
            disabled={saving || !summary}
          >
            {saving ? "שומר…" : "שמור תקציב"}
          </button>
        )}
      </div>
    </div>
  );
}
