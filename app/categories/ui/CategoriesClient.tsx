"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string };

function sortCategories(cats: Category[]) {
  return [...cats].sort((a, b) => {
    if (a.name === "כללי") return -1;
    if (b.name === "כללי") return 1;
    return a.name.localeCompare(b.name, "he");
  });
}

export default function CategoriesClient(props: { initial: Category[] }) {
  const [items, setItems] = useState<Category[]>(sortCategories(props.initial));
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(sortCategories(props.initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.initial)]);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה");
      return;
    }
    const body = (await res.json()) as Category;
    setItems((prev) => sortCategories([...prev, body]));
    setName("");
  }

  async function resetDefaults() {
    if (!confirm("פעולה זו תמחק את כל הקטגוריות שאינן בברירת המחדל ותשאיר רק: כללי, אוכל, רכב/דלק, תוכנות/מנויים, בגדים. להמשיך?")) return;
    setResetting(true);
    setError(null);
    const res = await fetch("/api/categories/reset-defaults", { method: "POST" });
    setResetting(false);
    if (!res.ok) { setError("שגיאה בניקוי קטגוריות"); return; }
    const body = (await res.json()) as { categories: Category[] };
    const sorted = [...body.categories].sort((a, b) => {
      if (a.name === "כללי") return -1;
      if (b.name === "כללי") return 1;
      return a.name.localeCompare(b.name, "he");
    });
    setItems(sorted);
  }

  async function remove(id: string) {
    if (!confirm("למחוק קטגוריה?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetDefaults}
          disabled={resetting}
          className="btn text-xs text-zinc-500 underline disabled:opacity-60"
        >
          {resetting ? "מנקה..." : "אפס לקטגוריות ברירת מחדל"}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם קטגוריה חדשה"
        />
        <button
          type="button"
          onClick={create}
          disabled={loading || !name.trim()}
          className="btn btn-primary disabled:opacity-60"
        >
          הוסף
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y rounded-xl border border-zinc-200/70 bg-white">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm">{c.name}</span>
            <button
              type="button"
              onClick={() => remove(c.id)}
              className="btn"
            >
              מחק
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


