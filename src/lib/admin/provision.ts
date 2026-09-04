"use server";

import { redirect } from "next/navigation";

import { adminClientPath } from "@/config/admin";
import { getPublicEnv } from "@/config/env";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import { applyProvisionedOrganizationBranding } from "@/lib/admin/branding";
import {
  organizationStatusMutationSchema,
  provisionOrganizationSchema,
} from "@/lib/validation/organization";
import { ORGANIZATION_STATUSES } from "@/types/enums";

export type AdminMutationState = {
  error?: string;
};

export type ProvisionOrganizationResult = {
  organizationId: string;
  slug: string;
  invitationSent: boolean;
  attachedExistingUser: boolean;
};

function publicProvisionError(error: unknown) {
  if (error instanceof ValidationError || error instanceof AppError) {
    return error.message;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  if (/slug already exists/i.test(message)) {
    return "That slug is already in use.";
  }

  if (/owner already belongs/i.test(message)) {
    return "That email already belongs to another organization.";
  }

  if (/platform administrator/i.test(message)) {
    return "That email belongs to a platform administrator and cannot be an organization owner.";
  }

  if (/not authorized/i.test(message)) {
    return "Platform administrator access is required.";
  }

  return toPublicErrorMessage(error);
}

async function findProfileByEmail(
  privileged: ReturnType<typeof createServiceRoleClient>,
  email: string,
) {
  const { data, error } = await privileged
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .limit(2);

  if (error) {
    throw new AppError(
      "owner_lookup_failed",
      "Unable to look up the owner email.",
      500,
    );
  }

  if ((data?.length ?? 0) > 1) {
    throw new ValidationError(
      "Multiple accounts use this email. Resolve the duplicate identity before provisioning.",
    );
  }

  return data?.[0] ?? null;
}

async function assertOwnerIsAttachable(
  privileged: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  const [{ data: adminRow, error: adminError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      privileged
        .from("platform_admins")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle(),
      privileged
        .from("organization_users")
        .select("id")
        .eq("user_id", userId)
        .limit(1),
    ]);

  if (adminError || membershipError) {
    throw new AppError(
      "owner_lookup_failed",
      "Unable to verify the owner identity.",
      500,
    );
  }

  if (adminRow) {
    throw new ValidationError(
      "That email belongs to a platform administrator and cannot be an organization owner.",
    );
  }

  if ((memberships?.length ?? 0) > 0) {
    throw new ValidationError(
      "That email already belongs to an organization. Onwarda does not attach one person to multiple clients automatically.",
    );
  }
}

async function inviteOwner(email: string) {
  const privileged = createServiceRoleClient();
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const { data, error } = await privileged.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/login", appUrl).toString(),
    data: { onwarda_role: "owner" },
  });

  if (error || !data.user) {
    throw new AppError(
      "owner_invite_failed",
      "The owner invitation could not be sent. The organization was not created.",
      502,
    );
  }

  return data.user.id;
}

async function rollbackInvitedUser(userId: string) {
  const privileged = createServiceRoleClient();
  await privileged.auth.admin.deleteUser(userId);
}

export async function provisionOrganization(input: {
  name: string;
  slug: string;
  status?: string;
  ownerEmail: string;
}): Promise<ProvisionOrganizationResult> {
  await requirePlatformAdmin();

  const parsed = provisionOrganizationSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Enter a valid organization name, slug, status, and owner email.");
  }

  const privileged = createServiceRoleClient();
  const existing = await findProfileByEmail(privileged, parsed.data.ownerEmail);

  let ownerUserId: string;
  let invitationSent = false;
  let attachedExistingUser = false;
  let createdAuthUserId: string | null = null;

  if (existing) {
    await assertOwnerIsAttachable(privileged, existing.id);
    ownerUserId = existing.id;
    attachedExistingUser = true;
  } else {
    ownerUserId = await inviteOwner(parsed.data.ownerEmail);
    createdAuthUserId = ownerUserId;
    invitationSent = true;
  }

  const scoped = await createSupabaseServerClient();

  try {
    const { data, error } = await scoped.rpc("provision_organization", {
      p_name: parsed.data.name,
      p_slug: parsed.data.slug,
      p_status: parsed.data.status,
      p_owner_user_id: ownerUserId,
      p_owner_membership_status: invitationSent ? "invited" : "active",
      p_owner_email: parsed.data.ownerEmail,
    });

    if (error || !data) {
      throw error ?? new AppError(
        "provision_failed",
        "Unable to create the organization.",
        500,
      );
    }

    return {
      organizationId: data as string,
      slug: parsed.data.slug,
      invitationSent,
      attachedExistingUser,
    };
  } catch (error) {
    if (createdAuthUserId) {
      try {
        await rollbackInvitedUser(createdAuthUserId);
      } catch {
        throw new AppError(
          "provision_rollback_failed",
          "Provisioning failed and the invited Auth user could not be removed automatically. No organization was created.",
          500,
        );
      }
    }

    throw error instanceof AppError || error instanceof ValidationError
      ? error
      : new AppError(
          "provision_failed",
          publicProvisionError(error),
          400,
        );
  }
}

export async function provisionOrganizationAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  let result: ProvisionOrganizationResult;

  try {
    result = await provisionOrganization({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      status: String(formData.get("status") || ORGANIZATION_STATUSES.ACTIVE),
      ownerEmail: String(formData.get("ownerEmail") ?? ""),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicProvisionError(error) };
  }

  try {
    await applyProvisionedOrganizationBranding(result.organizationId, formData);
  } catch {
    const created = new URLSearchParams({
      created: "1",
      invited: result.invitationSent ? "1" : "0",
      notice: "branding-failed",
    });

    redirect(`${adminClientPath(result.organizationId)}?${created.toString()}`);
  }

  const created = new URLSearchParams({
    created: "1",
    invited: result.invitationSent ? "1" : "0",
  });

  redirect(`${adminClientPath(result.organizationId)}?${created.toString()}`);
}

export async function setOrganizationStatusAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await setOrganizationStatus({
      organizationId,
      status: String(formData.get("status") ?? "") as "active" | "suspended",
      confirm: String(formData.get("confirm") ?? ""),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicProvisionError(error) };
  }

  redirect(`${adminClientPath(organizationId)}?status=updated`);
}

export async function setOrganizationStatus(input: {
  organizationId: string;
  status: "active" | "suspended";
  confirm?: string;
}) {
  await requirePlatformAdmin();

  const parsed = organizationStatusMutationSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("The requested status change is invalid.");
  }

  if (
    parsed.data.status === ORGANIZATION_STATUSES.SUSPENDED &&
    parsed.data.confirm !== "suspend"
  ) {
    throw new ValidationError("Confirm suspension before continuing. Data will not be deleted.");
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("set_organization_status", {
    p_organization_id: parsed.data.organizationId,
    p_status: parsed.data.status,
  });

  if (error) {
    throw new AppError(
      "status_change_failed",
      publicProvisionError(error),
      400,
    );
  }

  return parsed.data;
}

