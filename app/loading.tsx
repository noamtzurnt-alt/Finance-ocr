export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-56 rounded bg-zinc-200" />
        <div className="h-4 w-72 rounded bg-zinc-200" />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]" />
          ))}
        </div>
        <div className="mt-6 h-64 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]" />
      </div>
    </div>
  );
}

