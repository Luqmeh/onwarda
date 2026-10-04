import Link from "next/link";

import { StartCleaningButton } from "@/components/cleaner/cleaner-task-controls";
import { markCleanerDoneAction } from "@/lib/cleaning/cleaner-actions";
import { loadCleanerHome } from "@/lib/cleaning/cleaner-access";
import { formatDateTime } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cleaning" };

const COPY = {
  invalid: "This cleaning link is not valid.",
  revoked: "This cleaning link is no longer active. Ask your host for the new link.",
  expired: "This cleaning link has expired.",
  disabled: "This cleaner profile is disabled.",
  forbidden: "This cleaning link cannot open that work.",
};

export default async function CleanerHomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const home = await loadCleanerHome(token);

  if (home.status !== "valid") {
    return (
      <main className="onwarda-client mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5">
        <p className="onwarda-kicker">Cleaning</p>
        <h1 className="onwarda-display mt-3 text-3xl">Link unavailable</h1>
        <p className="mt-3 text-sm text-onwarda-muted">{COPY[home.status] ?? COPY.invalid}</p>
      </main>
    );
  }

  return (
    <main className="onwarda-client mx-auto min-h-svh max-w-lg px-4 py-8">
      <p className="text-sm text-onwarda-muted">{home.organizationName}</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Hello {home.cleanerName}</h1>
      <p className="mt-2 text-sm text-onwarda-muted">Today&apos;s cleaning</p>
      <div className="mt-6 space-y-3">
        {home.active.length === 0 ? (
          <p className="rounded-xl border bg-onwarda-white p-4 text-sm">
            No properties are assigned to you yet.
          </p>
        ) : (
          home.active.map((task) => (
            <article key={task.taskId ?? task.propertyId} className="rounded-2xl border bg-onwarda-white p-4">
              <h2 className="text-xl font-medium">{task.propertyName}</h2>
              {task.taskId ? (
                <>
                  <p className="mt-1 text-sm text-onwarda-muted">
                    {task.status === "in_progress" ? "Cleaning in progress" : "Cleaning required"}
                  </p>
                  {task.checkedOutAt ? (
                    <p className="mt-1 text-sm">Guest checked out {formatDateTime(task.checkedOutAt)}</p>
                  ) : null}
                  <p className="mt-1 text-sm">
                    {task.completedCount} / {task.totalCount} complete
                  </p>
                  <div className="mt-4 space-y-2">
                    {task.status === "queued" ? (
                      <StartCleaningButton token={token} taskId={task.taskId} />
                    ) : (
                      <Link
                        href={`/cleaner/${token}/task/${task.taskId}`}
                        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-onwarda-olive text-base font-medium text-white"
                      >
                        Continue
                      </Link>
                    )}
                    <form action={markCleanerDoneAction.bind(null, token, task.taskId)}>
                      <button
                        type="submit"
                        className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-onwarda-olive text-base font-medium text-onwarda-olive"
                      >
                        Done
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-onwarda-muted">
                  Assigned to you. Cleaning appears here after a guest checks out.
                </p>
              )}
            </article>
          ))
        )}
      </div>
      {home.completedToday.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-onwarda-muted">Completed today</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {home.completedToday.map((task) => (
              <li key={task.taskId}>{task.propertyName}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
