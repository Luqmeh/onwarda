type StatusBadgeProps = {
  status: string;
};

const TONES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  suspended: "bg-red-50 text-red-800 border-red-200",
  invited: "bg-sky-50 text-sky-800 border-sky-200",
  archived: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = TONES[status] ?? "bg-muted text-foreground border-border";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {status}
    </span>
  );
}
