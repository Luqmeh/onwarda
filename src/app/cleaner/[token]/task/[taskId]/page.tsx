import Link from "next/link";

import {
  CleanerChecklist,
  FinishCleaningForm,
} from "@/components/cleaner/cleaner-task-controls";
import { checklistProgress } from "@/lib/cleaning/progress";
import { loadCleanerTask } from "@/lib/cleaning/cleaner-access";
import { formatDateTime } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cleaning task" };

export default async function CleanerTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; taskId: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token, taskId } = await params;
  const query = await searchParams;
  const task = await loadCleanerTask(token, taskId);

  if (task.status !== "ok" || !task.propertyName) {
    return (
      <main className="onwarda-client mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5">
        <h1 className="text-3xl font-medium">This property is not on your list</h1>
        <Link href={`/cleaner/${token}`} className="mt-4 text-sm font-medium underline underline-offset-4">
          Back to my cleaning tasks
        </Link>
      </main>
    );
  }

  const progress = checklistProgress(
    task.items.map((item) => ({ required: item.required, completedAt: item.completedAt })),
  );
  const complete = task.taskStatus === "completed";

  return (
    <main className="onwarda-client mx-auto min-h-svh max-w-lg px-4 py-8">
      <Link href={`/cleaner/${token}`} className="text-sm text-onwarda-muted">
        Back to my cleaning tasks
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">{task.propertyName}</h1>
      <p className="mt-1 text-sm text-onwarda-muted">
        {[task.address, task.city].filter(Boolean).join(", ") || "Property"}
      </p>
      {task.checkedOutAt ? (
        <p className="mt-2 text-sm">Guest checked out {formatDateTime(task.checkedOutAt)}</p>
      ) : null}
      {complete || query.done === "1" ? (
        <section className="mt-8 rounded-2xl border bg-onwarda-white p-5">
          <p className="onwarda-kicker">Cleaning complete</p>
          <h2 className="mt-2 text-2xl font-medium">{task.propertyName} is ready.</h2>
          <p className="mt-2 text-sm">Thank you, {task.cleanerName}. This cleaning task is complete.</p>
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          {task.taskStatus === "queued" ? (
            <p className="text-sm">Start this property from your cleaning list before checking items.</p>
          ) : (
            <>
              <CleanerChecklist
                token={token}
                taskId={taskId}
                items={task.items}
                locked={task.taskStatus !== "in_progress"}
              />
              {progress.ready ? <FinishCleaningForm token={token} taskId={taskId} /> : null}
            </>
          )}
        </div>
      )}
    </main>
  );
}
