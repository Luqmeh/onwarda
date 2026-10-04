"use server";

import { redirect } from "next/navigation";

import { callCleanerRpc, hashCleanerAccessToken } from "@/lib/cleaning/cleaner-access";

function cleanerTaskPath(token: string, taskId: string) {
  return `/cleaner/${token}/task/${taskId}`;
}

export async function startCleanerTaskAction(token: string, taskId: string) {
  const tokenHash = hashCleanerAccessToken(token);

  if (!tokenHash) {
    redirect(`/cleaner/${token}`);
  }

  await callCleanerRpc("cleaner_start_task", {
    p_token_hash: tokenHash,
    p_task_id: taskId,
  });

  redirect(cleanerTaskPath(token, taskId));
}

export async function setCleanerItemAction(
  token: string,
  taskId: string,
  itemKey: string,
  completed: boolean,
) {
  const tokenHash = hashCleanerAccessToken(token);

  if (!tokenHash) {
    redirect(`/cleaner/${token}`);
  }

  await callCleanerRpc("cleaner_set_task_item", {
    p_token_hash: tokenHash,
    p_task_id: taskId,
    p_item_key: itemKey,
    p_completed: completed,
  });

  redirect(cleanerTaskPath(token, taskId));
}

export async function markCleanerDoneAction(token: string, taskId: string) {
  const tokenHash = hashCleanerAccessToken(token);

  if (!tokenHash) {
    redirect(`/cleaner/${token}`);
  }

  await callCleanerRpc("cleaner_mark_done", {
    p_token_hash: tokenHash,
    p_task_id: taskId,
  });

  redirect(`/cleaner/${token}`);
}

export async function finishCleanerTaskAction(
  token: string,
  taskId: string,
  _previous: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const tokenHash = hashCleanerAccessToken(token);

  if (!tokenHash) {
    return { error: "This cleaning link is not valid." };
  }

  const payload = await callCleanerRpc("cleaner_finish_task", {
    p_token_hash: tokenHash,
    p_task_id: taskId,
    p_confirm_cleaning: formData.get("confirmCleaning") === "on",
    p_confirm_left: formData.get("confirmLeft") === "on",
  });

  if (payload.status === "ok" || payload.status === "already_completed") {
    redirect(`${cleanerTaskPath(token, taskId)}?done=1`);
  }

  if (payload.status === "checklist_incomplete") {
    return { error: "Finish every required item before completing this cleaning." };
  }

  if (payload.status === "confirmation_required") {
    return { error: "Confirm the cleaning is complete and that you have left the property." };
  }

  return { error: "This cleaning task cannot be completed." };
}
