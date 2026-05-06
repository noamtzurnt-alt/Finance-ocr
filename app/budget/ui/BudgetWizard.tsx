"use client";

import { useState } from "react";

type WizardStep = 1 | 2 | 3 | 4 | 5;

type WizardAnswers = {
  // Step 1: Income
  incomeType: "steady" | "variable" | "";
  monthlyIncome: string;
  // Step 2: Fixed expenses
  hasRent: boolean;
  rentAmount: string;
  isPlanning: boolean;
  estimatedRent: string;
  hasMortgage: boolean;
  mortgageAmount: string;
  creditCardDay: "1" | "3" | "other" | "";
  // Step 3: Pension & insurance
  hasPension: boolean;
  pensionFeeKnown: boolean;
  pensionFee: string;
  hasLifeInsurance: boolean;
  hasHealthInsurance: boolean;
  hasDisabilityInsurance: boolean;
  // Step 4: Debts & goals
  hasDebts: boolean;
  debtAmount: string;
  goal: "emergency_fund" | "vacation" | "financial_independence" | "pay_debt" | "other" | "";
  emergencyFundMonths: string;
};

const INITIAL_ANSWERS: WizardAnswers = {
  incomeType: "",
  monthlyIncome: "",
  hasRent: false,
  rentAmount: "",
  isPlanning: false,
  estimatedRent: "",
  hasMortgage: false,
  mortgageAmount: "",
  creditCardDay: "",
  hasPension: false,
  pensionFeeKnown: false,
  pensionFee: "",
  hasLifeInsurance: false,
  hasHealthInsurance: false,
  hasDisabilityInsurance: false,
  hasDebts: false,
  debtAmount: "",
  goal: "",
  emergencyFundMonths: "3",
};

type Recommendation = {
  method: string;
  title: string;
  color: string;
  ratio: string;
  description: string;
  insights: string[];
  actions: { label: string; urgent: boolean }[];
};

function computeRecommendation(a: WizardAnswers): Recommendation {
  const income = Number(a.monthlyIncome) || 0;
  const rent = a.hasRent ? Number(a.rentAmount) || 0 : 0;
  const estimatedRentNum = a.isPlanning ? Number(a.estimatedRent) || 0 : 0;
  const mortgage = a.hasMortgage ? Number(a.mortgageAmount) || 0 : 0;
  const debt = a.hasDebts ? Number(a.debtAmount) || 0 : 0;
  const effectiveRent = estimatedRentNum > rent ? estimatedRentNum : rent;
  const fixedBase = effectiveRent + mortgage;
  const fixedRatio = income > 0 ? fixedBase / income : 0;

  const insights: string[] = [];
  const actions: { label: string; urgent: boolean }[] = [];

  // Housing cost insight
  if (fixedRatio > 0.4) {
    insights.push(`דיור אוכל ${Math.round(fixedRatio * 100)}% מהכנסתך — מעל 40% הוא עומס פיננסי כבד`);
    actions.push({ label: "בדוק הגדלת הכנסה או מגורים משותפים", urgent: true });
  } else if (fixedRatio > 0) {
    insights.push(`דיור אוכל ${Math.round(fixedRatio * 100)}% מהכנסתך — מקובל עד 30%`);
  }

  // Pension insight
  if (!a.hasPension) {
    insights.push("אין פנסיה — זו אחת הטעויות הכי יקרות לטווח ארוך");
    actions.push({ label: "פתח קרן פנסיה עוד השבוע", urgent: true });
  } else if (!a.pensionFeeKnown) {
    insights.push("לא בדקת דמי ניהול בפנסיה — 0.5% הפרש שווה מאות אלפי ₪ לאורך שנים");
    actions.push({ label: "כנס להר הכסף ובדוק דמי ניהול", urgent: false });
  } else {
    const fee = Number(a.pensionFee) || 0;
    if (fee > 0.5) {
      insights.push(`דמי ניהול ${fee}% — גבוה! ממוצע שוק הוא 0.3-0.5%. פנה לחברת פנסיה אחרת`);
      actions.push({ label: "השווה דמי ניהול ב-Har HaKesef", urgent: true });
    } else {
      insights.push(`דמי ניהול ${fee}% — טוב! ממשיך לבנות לטווח ארוך`);
    }
  }

  // Insurance insight
  const insuranceCount = [a.hasLifeInsurance, a.hasHealthInsurance, a.hasDisabilityInsurance].filter(Boolean).length;
  if (insuranceCount >= 2) {
    insights.push("יש לך כמה ביטוחים — בדוק אם יש חפיפות (כפל ביטוח) שאפשר לבטל");
    actions.push({ label: "כנס להר הביטוח ובדוק כפל ביטוחים", urgent: false });
  }

  // Debt insight
  if (a.hasDebts && debt > 0) {
    const debtRatio = income > 0 ? debt / income : 0;
    if (debtRatio > 6) {
      insights.push(`חוב של ${debt.toLocaleString()} ₪ הוא ${Math.round(debtRatio)} משכורות — כדאי לתעדף פירעון`);
      actions.push({ label: "תכנן אסטרטגיית פירעון חוב (Avalanche/Snowball)", urgent: true });
    }
  }

  // Future rent simulation
  if (a.isPlanning && estimatedRentNum > 0 && income > 0) {
    const futureRatio = estimatedRentNum / income;
    insights.push(`עם שכירות של ${estimatedRentNum} ₪, דיור יגיע ל-${Math.round(futureRatio * 100)}% מהכנסתך`);
  }

  // Method recommendation
  let method: string;
  let title: string;
  let color: string;
  let ratio: string;
  let description: string;

  if (a.incomeType === "variable" || a.hasDebts) {
    method = "ZBB";
    title = "תקציב מבוסס אפס (Zero-Based Budget)";
    color = "violet";
    ratio = "כל שקל מוקצה ליעד";
    description = "מתאים להכנסה משתנה או עומס חובות. כל שקל מקבל שם ספציפי בתחילת כל חודש. הכנסה − הוצאות = 0.";
  } else if (income > 0 && fixedRatio > 0.3) {
    method = "Pay-Yourself-First";
    title = "שלם לעצמך קודם";
    color = "emerald";
    ratio = "10-15% חיסכון אוטומטי";
    description = "עם הוצאות קבועות גבוהות, הדרך הטובה ביותר היא לעיל 10-15% מהכנסה לחיסכון ביום קבלת שכר, לפני כל הוצאה אחרת.";
  } else {
    method = "50/30/20";
    title = "כלל ה-50/30/20";
    color = "blue";
    ratio = "50% צרכים / 30% רצונות / 20% חיסכון";
    description = "50% לצרכים (דיור, מזון, תחבורה), 30% לרצונות (בידור, קניות), 20% לחיסכון ופנסיה. הדרך הפשוטה ביותר להתחיל.";
  }

  // Adjust ratios for high cost of living
  if (income > 0 && fixedRatio > 0.4 && method === "50/30/20") {
    ratio = "65% צרכים / 20% רצונות / 15% חיסכון";
    description += " שים לב: עם עלות דיור גבוהה, אחוזי הצרכים מותאמים ל-65%.";
  }

  return { method, title, color, ratio, description, insights, actions };
}

const stepTitles = ["הכנסה", "דיור ואשראי", "פנסיה וביטוח", "חובות ומטרות", "המלצה"];

export default function BudgetWizard({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [answers, setAnswers] = useState<WizardAnswers>(INITIAL_ANSWERS);
  const [done, setDone] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  function next() {
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
    else {
      setRec(computeRecommendation(answers));
      setStep(5);
      setDone(true);
    }
  }

  function back() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  function reset() {
    setAnswers(INITIAL_ANSWERS);
    setStep(1);
    setDone(false);
    setRec(null);
  }

  function set<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  const colorMap: Record<string, string> = {
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-indigo-600",
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-zinc-900">צ׳ק-אפ פיננסי עמוק</h2>
            <p className="mt-0.5 text-xs text-zinc-500">שאלון שמגלה מה אתה לא יודע על הכסף שלך</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex gap-1.5">
          {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${s <= step ? "bg-indigo-500" : "bg-zinc-200"}`} />
              <div className={`mt-1 text-center text-[0.6rem] font-medium ${s <= step ? "text-indigo-600" : "text-zinc-400"}`}>
                {stepTitles[s - 1]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* Step 1: Income */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-sm font-medium text-indigo-800">שלב 1 מתוך 4: הכנסה</p>
              <p className="mt-1 text-xs text-indigo-600">בסיס לכל חישוב תקציב הוא ההכנסה שלך</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-700">מה סוג ההכנסה שלך?</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["steady", "variable"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("incomeType", v)}
                    className={`rounded-xl border p-4 text-right transition ${answers.incomeType === v ? "border-indigo-400 bg-indigo-50" : "border-zinc-200 hover:border-zinc-300"}`}
                  >
                    <div className="font-semibold text-zinc-900">{v === "steady" ? "משכורת קבועה" : "עצמאי / פרילנסר"}</div>
                    <div className="mt-1 text-xs text-zinc-500">{v === "steady" ? "אותו סכום כל חודש" : "הכנסה משתנה בין חודש לחודש"}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-700">
                {answers.incomeType === "variable" ? "הכנסה ממוצעת (3 חודשים אחרונים)" : "הכנסה נטו חודשית"} ₪
              </label>
              <input
                className="field mt-1.5"
                value={answers.monthlyIncome}
                onChange={(e) => set("monthlyIncome", e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="למשל 12000"
              />
              {answers.incomeType === "variable" && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  💡 לפרילנסרים: השתמש בחודש השפל ההיסטורי שלך כבסיס — לא בחודש הטוב
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Housing & credit */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-sm font-medium text-indigo-800">שלב 2 מתוך 4: דיור ואשראי</p>
              <p className="mt-1 text-xs text-indigo-600">דיור הוא בדרך כלל ההוצאה הקבועה הגדולה ביותר</p>
            </div>

            <div className="space-y-4">
              {/* Rent */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={answers.hasRent}
                    onChange={(e) => set("hasRent", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                  <span className="text-sm font-semibold text-zinc-700">אני משלם שכירות</span>
                </label>
                {answers.hasRent && (
                  <input className="field mt-2" value={answers.rentAmount}
                    onChange={(e) => set("rentAmount", e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal" placeholder="סכום שכירות חודשי ₪" />
                )}
              </div>

              {/* Future move simulation */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={answers.isPlanning}
                    onChange={(e) => set("isPlanning", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                  <span className="text-sm font-semibold text-zinc-700">מתכנן לעבור דירה / להוציא על שכירות בעתיד</span>
                </label>
                {answers.isPlanning && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700 mb-2">סימולציה: ניתן לחזות איך החיים שלך ייראו עם שכירות — לפני שזה קורה</p>
                    <input className="field" value={answers.estimatedRent}
                      onChange={(e) => set("estimatedRent", e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal" placeholder="שכירות משוערת ₪" />
                    {answers.estimatedRent && answers.monthlyIncome && (
                      <p className="mt-2 text-xs font-medium text-amber-800">
                        זה יהיה {Math.round((Number(answers.estimatedRent) / Number(answers.monthlyIncome)) * 100)}% מהכנסתך החודשית
                        {Number(answers.estimatedRent) / Number(answers.monthlyIncome) > 0.35 && " ⚠️ עומס גבוה"}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Mortgage */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={answers.hasMortgage}
                    onChange={(e) => set("hasMortgage", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                  <span className="text-sm font-semibold text-zinc-700">יש לי משכנתא</span>
                </label>
                {answers.hasMortgage && (
                  <input className="field mt-2" value={answers.mortgageAmount}
                    onChange={(e) => set("mortgageAmount", e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal" placeholder="תשלום משכנתא חודשי ₪" />
                )}
              </div>

              {/* Credit card day */}
              <div>
                <label className="text-sm font-semibold text-zinc-700">באיזה תאריך יורד האשראי שלך?</label>
                <div className="mt-2 flex gap-2">
                  {(["1", "3", "other"] as const).map((d) => (
                    <button key={d} type="button"
                      onClick={() => set("creditCardDay", d)}
                      className={`rounded-xl border px-4 py-2 text-sm transition ${answers.creditCardDay === d ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700" : "border-zinc-200 hover:border-zinc-300"}`}>
                      {d === "1" ? "1 לחודש" : d === "3" ? "3 לחודש" : "תאריך אחר"}
                    </button>
                  ))}
                </div>
                {(answers.creditCardDay === "1" || answers.creditCardDay === "3") && (
                  <div className="mt-2 rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600">
                    💡 חיוב ב-{answers.creditCardDay} לחודש = החיוב כולל הוצאות מהחודש הקודם.
                    סמן תנועת אשראי כ"קבועה" בתנועות כדי שה-DFSI לא יספור אותה כהוצאה משתנה של היום.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Pension & insurance */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-sm font-medium text-indigo-800">שלב 3 מתוך 4: פנסיה וביטוח</p>
              <p className="mt-1 text-xs text-indigo-600">הטעויות הכי יקרות קורות פה — ברוב המקרים אנשים לא מודעים אליהן</p>
            </div>

            <div className="space-y-4">
              {/* Pension */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={answers.hasPension}
                    onChange={(e) => set("hasPension", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                  <span className="text-sm font-semibold text-zinc-700">יש לי קרן פנסיה / קרן השתלמות</span>
                </label>
                {!answers.hasPension && (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    ⚠️ ללא פנסיה, אתה מפסיד צבירת הון עצום לאורך השנים. זה דחוף.
                  </div>
                )}
                {answers.hasPension && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={answers.pensionFeeKnown}
                          onChange={(e) => set("pensionFeeKnown", e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                        <span className="text-sm text-zinc-700">אני יודע מה דמי הניהול שלי</span>
                      </label>
                    </div>
                    {answers.pensionFeeKnown && (
                      <div>
                        <input className="field" value={answers.pensionFee}
                          onChange={(e) => set("pensionFee", e.target.value.replace(/[^0-9.]/g, ""))}
                          inputMode="decimal" placeholder="דמי ניהול % (למשל 0.3)" />
                        <p className="mt-1 text-xs text-zinc-400">ממוצע שוק: 0.3–0.5%. מעל 1% = יקר מאד</p>
                      </div>
                    )}
                    {!answers.pensionFeeKnown && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                        💡 הפרש של 0.5% בדמי ניהול = עשרות אלפי ₪ פחות בפנסיה. בדוק ב-<strong>הר הכסף</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Insurance */}
              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-2">איזה ביטוחים יש לך? (סמן הכל שרלוונטי)</label>
                <div className="space-y-2">
                  {[
                    { key: "hasLifeInsurance" as const, label: "ביטוח חיים" },
                    { key: "hasHealthInsurance" as const, label: "ביטוח בריאות / מחלה קשה" },
                    { key: "hasDisabilityInsurance" as const, label: "ביטוח אובדן כושר עבודה" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={answers[key]}
                        onChange={(e) => set(key, e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                      <span className="text-sm text-zinc-700">{label}</span>
                    </label>
                  ))}
                </div>
                {[answers.hasLifeInsurance, answers.hasHealthInsurance, answers.hasDisabilityInsurance].filter(Boolean).length >= 2 && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                    💡 עם מספר ביטוחים — בדוק כפל ביטוחים ב-<strong>הר הביטוח</strong>. אנשים משלמים פעמיים על אותו כיסוי.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Debts & goals */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-sm font-medium text-indigo-800">שלב 4 מתוך 4: חובות ומטרות</p>
              <p className="mt-1 text-xs text-indigo-600">לאן אתה רוצה להגיע? זה מגדיר את שיטת התקציב שלך</p>
            </div>

            <div className="space-y-4">
              {/* Debts */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={answers.hasDebts}
                    onChange={(e) => set("hasDebts", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
                  <span className="text-sm font-semibold text-zinc-700">יש לי הלוואות / חובות (לא כולל משכנתא)</span>
                </label>
                {answers.hasDebts && (
                  <input className="field mt-2" value={answers.debtAmount}
                    onChange={(e) => set("debtAmount", e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal" placeholder="סכום כולל של כל החובות ₪" />
                )}
              </div>

              {/* Goal */}
              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-2">מה המטרה הפיננסית הראשית שלך?</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["emergency_fund", "קרן חירום", "3-6 חודשי הוצאות שמורים"],
                    ["pay_debt", "פירעון חובות", "יצא מהמינוס / הלוואות"],
                    ["vacation", "חיסכון יעד", "חופשה, רכב, חתונה"],
                    ["financial_independence", "עצמאות כלכלית", "הון שמייצר הכנסה"],
                  ] as [string, string, string][]).map(([value, title, sub]) => (
                    <button key={value} type="button"
                      onClick={() => set("goal", value as WizardAnswers["goal"])}
                      className={`rounded-xl border p-3 text-right transition ${answers.goal === value ? "border-indigo-400 bg-indigo-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                      <div className="font-semibold text-zinc-900 text-sm">{title}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {answers.goal === "emergency_fund" && (
                <div>
                  <label className="text-sm font-medium text-zinc-700">כמה חודשים של קרן חירום אתה שואף ל?</label>
                  <div className="mt-2 flex gap-2">
                    {["3", "6", "12"].map((m) => (
                      <button key={m} type="button"
                        onClick={() => set("emergencyFundMonths", m)}
                        className={`rounded-xl border px-4 py-2 text-sm transition ${answers.emergencyFundMonths === m ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700" : "border-zinc-200"}`}>
                        {m} חודשים
                      </button>
                    ))}
                  </div>
                  {answers.monthlyIncome && (
                    <p className="mt-2 text-xs text-zinc-500">
                      יעד: {(Number(answers.monthlyIncome) * Number(answers.emergencyFundMonths)).toLocaleString()} ₪
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Recommendation */}
        {step === 5 && rec && (
          <div className="space-y-5">
            {/* Method card */}
            <div className={`rounded-2xl bg-gradient-to-br ${colorMap[rec.color]} p-5 text-white`}>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">שיטת התקציב המומלצת לך</div>
              <div className="mt-2 text-2xl font-bold">{rec.title}</div>
              <div className="mt-1 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold inline-block">{rec.ratio}</div>
              <p className="mt-3 text-sm opacity-90 leading-relaxed">{rec.description}</p>
            </div>

            {/* Insights */}
            {rec.insights.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">💡 מה גילינו על הכסף שלך</h3>
                <div className="space-y-2">
                  {rec.insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                      <span className="mt-0.5 shrink-0 text-base">•</span>
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action items */}
            {rec.actions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">✅ פעולות מיידיות</h3>
                <div className="space-y-2">
                  {rec.actions.map((a, i) => (
                    <div key={i}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${a.urgent ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                      <span className="shrink-0">{a.urgent ? "🚨" : "✅"}</span>
                      <span className="font-medium">{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External tools */}
            <div>
              <h3 className="text-sm font-bold text-zinc-900 mb-2">🔗 כלים חיצוניים</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: "הר הכסף", desc: "בדוק פנסיות, קרנות ותוכניות חיסכון", url: "https://www.finance.gov.il/mountain" },
                  { label: "הר הביטוח", desc: "בדוק כפל ביטוחים וכיסויים", url: "https://www.finance.gov.il/insurancemountain" },
                  { label: "בדיקת זכאות מענק עבודה", desc: "עד ₪10,260 לשנה", url: "https://secapp.taxes.gov.il/smas/" },
                ].map((tool) => (
                  <a key={tool.label} href={tool.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-right transition hover:border-indigo-300 hover:bg-indigo-50/30">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 8h10M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">{tool.label}</div>
                      <div className="text-xs text-zinc-500">{tool.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <button type="button" onClick={reset}
              className="btn w-full text-sm">
              התחל את השאלון מחדש
            </button>
          </div>
        )}

        {/* Navigation */}
        {!done && (
          <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
            <button type="button" onClick={back} disabled={step === 1}
              className="btn text-sm disabled:opacity-40">
              ← חזרה
            </button>
            <span className="text-xs text-zinc-400">שלב {step} מתוך 4</span>
            <button type="button" onClick={next}
              className="btn btn-primary text-sm"
              disabled={step === 1 && !answers.incomeType}>
              {step === 4 ? "קבל המלצה →" : "הבא →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
