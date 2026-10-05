"use server";

import { redirect } from "next/navigation";

import { adminClientPath } from "@/config/admin";
import { authRedirectUrl } from "@/lib/url";
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
import {
  inviteOrganizationUserSchema,
  setOrganizationUserRoleSchema,
  setOrganizationUserStatusSchema,
  transferOrganizationOwnershipSchema,
} from "@/lib/validation/organization";
import type { AdminMutationState } from "@/lib/admin/provision";

function publicMemberError(error: unknown) {
  if (error instanceof ValidationError || error instanceof AppError) {
    return error.message;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  if (/already belongs to another organization/i.test(message)) {
    return "That email already belongs to another organization.";
  }

  if (/already belongs to this organization/i.test(message)) {
    return "That email is already a member of this organization.";
  }

  if (/platform administrator/i.test(message)) {
    return "That email belongs to a platform administrator and cannot be an organization user.";
  }

  if (/must keep at least one owner/i.test(message)) {
    return "An organization must keep at least one owner.";
  }

  if (/new owner must be an active/i.test(message)) {
    return "Ownership can only transfer to an active member of this organization.";
  }

  if (/membership not found/i.test(message)) {
    return "That person is not a member of this organization.";
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
      "member_lookup_failed",
      "Unable to look up that email.",
      500,
    );
  }

  if ((data?.length ?? 0) > 1) {
    throw new ValidationError(
      "Multiple accounts use this email. Resolve the duplicate identity before inviting.",
    );
  }

  return data?.[0] ?? null;
}

async function assertMemberIsAttachable(
  privileged: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  organizationId: string,
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
        .select("id, organization_id")
        .eq("user_id", userId),
    ]);

  if (adminError || membershipError) {
    throw new AppError(
      "member_lookup_failed",
      "Unable to verify the user identity.",
      500,
    );
  }

  if (adminRow) {
    throw new ValidationError(
      "That email belongs to a platform administrator and cannot be an organization user.",
    );
  }

  if ((memberships ?? []).some((row) => row.organization_id === organizationId)) {
    throw new ValidationError("That email is already a member of this organization.");
  }

  if ((memberships?.length ?? 0) > 0) {
    throw new ValidationError(
      "That email already belongs to another organization.",
    );
  }
}

async function inviteAuthUser(email: string, role: string) {
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.auth.admin.inviteUserByEmail(email, {
    redirectTo: authRedirectUrl("/login"),
    data: { onwarda_role: role },
  });

  if (error || !data.user) {
    throw new AppError(
      "member_invite_failed",
      "The invitation could not be sent. The membership was not created.",
      502,
    );
  }

  return data.user.id;
}

async function rollbackInvitedUser(userId: string) {
  const privileged = createServiceRoleClient();
  await privileged.auth.admin.deleteUser(userId);
}

export async function inviteOrganizationUser(input: {
  organizationId: string;
  email: string;
  role: "admin" | "manager" | "staff";
}) {
  await requirePlatformAdmin();

  const parsed = inviteOrganizationUserSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Enter a valid email and organization role.");
  }

  const privileged = createServiceRoleClient();
  const existing = await findProfileByEmail(privileged, parsed.data.email);

  let userId: string;
  let invitationSent = false;
  let createdAuthUserId: string | null = null;

  if (existing) {
    await assertMemberIsAttachable(
      privileged,
      existing.id,
      parsed.data.organizationId,
    );
    userId = existing.id;
  } else {
    userId = await inviteAuthUser(parsed.data.email, parsed.data.role);
    createdAuthUserId = userId;
    invitationSent = true;
  }

  const scoped = await createSupabaseServerClient();

  try {
    const { error } = await scoped.rpc("admin_invite_organization_user", {
      p_organization_id: parsed.data.organizationId,
      p_user_id: userId,
      p_email: parsed.data.email,
      p_role: parsed.data.role,
      p_membership_status: invitationSent ? "invited" : "active",
    });

    if (error) {
      throw error;
    }

    return {
      organizationId: parsed.data.organizationId,
      invitationSent,
    };
  } catch (error) {
    if (createdAuthUserId) {
      try {
        await rollbackInvitedUser(createdAuthUserId);
      } catch {
        throw new AppError(
          "member_invite_rollback_failed",
          "Invitation failed and the invited Auth user could not be removed automatically. No membership was created.",
          500,
        );
      }
    }

    throw error instanceof AppError || error instanceof ValidationError
      ? error
      : new AppError("member_invite_failed", publicMemberError(error), 400);
  }
}

export async function setOrganizationUserRole(input: {
  organizationId: string;
  userId: string;
  role: "admin" | "manager" | "staff";
}) {
  await requirePlatformAdmin();

  const parsed = setOrganizationUserRoleSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("The requested role change is invalid.");
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("admin_set_organization_user_role", {
    p_organization_id: parsed.data.organizationId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) {
    throw new AppError("member_role_failed", publicMemberError(error), 400);
  }
}

export async function setOrganizationUserStatus(input: {
  organizationId: string;
  userId: string;
  status: "active" | "suspended";
}) {
  await requirePlatformAdmin();

  const parsed = setOrganizationUserStatusSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("The requested membership status change is invalid.");
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("admin_set_organization_user_status", {
    p_organization_id: parsed.data.organizationId,
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
  });

  if (error) {
    throw new AppError("member_status_failed", publicMemberError(error), 400);
  }
}

export async function transferOrganizationOwnership(input: {
  organizationId: string;
  userId: string;
  confirm?: string;
}) {
  await requirePlatformAdmin();

  const parsed = transferOrganizationOwnershipSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Confirm ownership transfer before continuing.");
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("admin_transfer_organization_ownership", {
    p_organization_id: parsed.data.organizationId,
    p_new_owner_user_id: parsed.data.userId,
  });

  if (error) {
    throw new AppError("ownership_transfer_failed", publicMemberError(error), 400);
  }
}

function redirectWithNotice(organizationId: string, notice: string): never {
  redirect(`${adminClientPath(organizationId)}?notice=${notice}`);
}

export async function inviteOrganizationUserAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  let result: { organizationId: string; invitationSent: boolean };

  try {
    result = await inviteOrganizationUser({
      organizationId,
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "") as "admin" | "manager" | "staff",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicMemberError(error) };
  }

  redirectWithNotice(
    result.organizationId,
    result.invitationSent ? "user-invited" : "user-attached",
  );
}

export async function setOrganizationUserRoleAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await setOrganizationUserRole({
      organizationId,
      userId: String(formData.get("userId") ?? ""),
      role: String(formData.get("role") ?? "") as "admin" | "manager" | "staff",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicMemberError(error) };
  }

  redirectWithNotice(organizationId, "role-updated");
}

export async function setOrganizationUserStatusAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await setOrganizationUserStatus({
      organizationId,
      userId: String(formData.get("userId") ?? ""),
      status: String(formData.get("status") ?? "") as "active" | "suspended",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicMemberError(error) };
  }

  redirectWithNotice(organizationId, "membership-updated");
}

export async function transferOrganizationOwnershipAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await transferOrganizationOwnership({
      organizationId,
      userId: String(formData.get("userId") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicMemberError(error) };
  }

  redirectWithNotice(organizationId, "ownership-transferred");
}
