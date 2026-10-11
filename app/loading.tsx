export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 py-4">
      <div className="h-8 w-40 rounded-lg bg-[var(--surface)]" />
      <div className="h-4 w-56 rounded bg-[var(--surface)]" />
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[var(--surface)]" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-2xl bg-[var(--surface)]" />
    </div>
  );
}
