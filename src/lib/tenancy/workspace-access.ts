import "server-only";

import { resolveValidSupportWorkspace } from "@/lib/authorization/support-workspace";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { requireCurrentOrganization } from "@/lib/tenancy/context";
import type { Organization } from "@/types/database";
import type { WorkspaceView } from "@/types/auth";

export async function requireWorkspaceView(): Promise<WorkspaceView> {
  try {
    return {
      kind: "membership",
      context: await requireCurrentOrganization(),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (!(error instanceof AuthorizationError)) {
      throw error;
    }

    const support = await resolveValidSupportWorkspace();

    if (support) {
      return { kind: "support", context: support };
    }

    throw error;
  }
}

export async function requireWorkspaceOrganization(): Promise<{
  organization: Organization;
  access: "membership" | "support";
}> {
  const view = await requireWorkspaceView();

  return {
    organization: view.context.organization,
    access: view.kind,
  };
}
