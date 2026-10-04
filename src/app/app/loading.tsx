export default function ClientLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workspace</span>
      <div className="h-4 w-24 animate-pulse rounded-full bg-onwarda-olive/10" />
      <div className="h-10 w-72 max-w-full animate-pulse rounded-xl bg-onwarda-olive/10" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="h-56 animate-pulse rounded-[var(--onwarda-radius-lg)] bg-onwarda-white" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="h-24 animate-pulse rounded-[var(--onwarda-radius-lg)] bg-onwarda-white" />
          <div className="h-24 animate-pulse rounded-[var(--onwarda-radius-lg)] bg-onwarda-white" />
        </div>
      </div>
    </div>
  );
}
