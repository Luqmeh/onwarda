import type { AdminAuditEntry } from "@/lib/admin/dashboard";

type ActivityListProps = {
  entries: AdminAuditEntry[];
  emptyDescription: string;
};

export function ActivityList({ entries, emptyDescription }: ActivityListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyDescription}</p>
    );
  }

  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{entry.action}</p>
            <p className="text-xs text-muted-foreground">
              {entry.actorType} · {entry.targetType}
            </p>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
            {new Date(entry.createdAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
