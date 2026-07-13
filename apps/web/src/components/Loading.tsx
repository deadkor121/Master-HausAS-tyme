export function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-pulse rounded-full bg-cyan-400"
        />
        <span className="text-sm uppercase tracking-[0.3em] text-cyan-400">
          Loading
        </span>
      </div>
    </div>
  );
}
