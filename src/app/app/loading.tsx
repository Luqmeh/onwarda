export default function ClientLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-onwarda-olive/10" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[var(--onwarda-radius)] bg-onwarda-olive/10" />
        ))}
      </div>
    </div>
  );
}
