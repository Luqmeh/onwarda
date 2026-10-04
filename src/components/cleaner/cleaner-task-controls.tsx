"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { CLEANING_CHECKLIST_CATEGORIES } from "@/lib/cleaning/catalog";
import { checklistProgress } from "@/lib/cleaning/progress";
import {
  finishCleanerTaskAction,
  setCleanerItemAction,
  startCleanerTaskAction,
} from "@/lib/cleaning/cleaner-actions";
import type { CleanerTaskItem } from "@/lib/cleaning/cleaner-access";

export function StartCleaningButton({ token, taskId }: { token: string; taskId: string }) {
  const action = startCleanerTaskAction.bind(null, token, taskId);

  return (
    <form action={action}>
      <Button type="submit" className="h-12 w-full text-base">
        Start cleaning
      </Button>
    </form>
  );
}

export function CleanerChecklist({
  token,
  taskId,
  items,
  locked,
}: {
  token: string;
  taskId: string;
  items: CleanerTaskItem[];
  locked: boolean;
}) {
  const progress = checklistProgress(
    items.map((item) => ({ required: item.required, completedAt: item.completedAt })),
  );

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium">
        {progress.completed} / {progress.total} complete
      </p>
      {CLEANING_CHECKLIST_CATEGORIES.map((category) => {
        const group = items.filter((item) => item.category === category.key);

        if (group.length === 0) {
          return null;
        }

        return (
          <section key={category.key} className="space-y-2">
            <h2 className="text-sm font-medium tracking-wide text-onwarda-muted uppercase">
              {category.label}
            </h2>
            <ul className="space-y-2">
              {group.map((item) => (
                <li key={item.key}>
                  <form action={setCleanerItemAction.bind(null, token, taskId, item.key, !item.completedAt)}>
                    <button
                      type="submit"
                      disabled={locked}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-onwarda-white px-4 text-left text-base disabled:opacity-70"
                    >
                      <span aria-hidden="true" className="text-lg">
                        {item.completedAt ? "☑" : "☐"}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function FinishCleaningForm({ token, taskId }: { token: string; taskId: string }) {
  const action = finishCleanerTaskAction.bind(null, token, taskId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-onwarda-white p-4">
      <h2 className="text-base font-medium">Final check</h2>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input type="checkbox" name="confirmCleaning" className="size-5" />
        I completed the cleaning
      </label>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input type="checkbox" name="confirmLeft" className="size-5" />
        I have left the property
      </label>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Saving..." : "Finish cleaning"}
      </Button>
    </form>
  );
}
