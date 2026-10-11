"use server";

import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/config/admin";
import {
  permanentlyDeleteOrganization,
  retryOrganizationDeletion,
} from "@/lib/admin/offboarding";
import { AppError, AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import type { DeletionActionState } from "@/lib/admin/offboarding-types";

function rethrowFrameworkError(error: unknown) {
  if (error instanceof AuthenticationError) {
    throw error;
  }

  if (typeof error === "object" && error && "digest" in error) {
    throw error;
  }
}

export async function permanentlyDeleteOrganizationAction(
  _previous: DeletionActionState,
  formData: FormData,
): Promise<DeletionActionState> {
  try {
    const result = await permanentlyDeleteOrganization({
      organizationId: String(formData.get("organizationId") ?? ""),
      confirmation: String(formData.get("confirmation") ?? ""),
      acknowledge: formData.get("acknowledge") === "delete",
    });

    if ("incomplete" in result) {
      return result;
    }

    redirect(`${ADMIN_ROUTES.clients}?notice=client-deleted`);
  } catch (error) {
    rethrowFrameworkError(error);

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AppError) {
      return { error: error.message };
    }

    return { error: "The client could not be deleted." };
  }
}

export async function retryOrganizationDeletionAction(formData: FormData) {
  try {
    const result = await retryOrganizationDeletion(String(formData.get("jobId") ?? ""));

    if ("status" in result && result.status === "complete") {
      redirect(`${ADMIN_ROUTES.clients}?notice=client-deleted`);
    }

    const detail =
      "incomplete" in result && result.incomplete
        ? result.incomplete.detail
        : result.error ?? "Cleanup is still incomplete.";

    redirect(`${ADMIN_ROUTES.clients}?notice=cleanup-incomplete&detail=${encodeURIComponent(detail)}`);
  } catch (error) {
    rethrowFrameworkError(error);
    redirect(`${ADMIN_ROUTES.clients}?notice=cleanup-incomplete`);
  }
}
