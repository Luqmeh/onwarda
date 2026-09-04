import type { Organization, OrganizationUser, PlatformAdmin, Profile } from "@/types/database";

export type AuthenticatedUser = {
  id: string;
  email: string | undefined;
};

export type PlatformAdminContext = {
  user: AuthenticatedUser;
  profile: Profile | null;
  admin: PlatformAdmin;
};

export type OrganizationMembershipContext = {
  user: AuthenticatedUser;
  profile: Profile | null;
  membership: OrganizationUser;
  organization: Organization;
};

export type SupportWorkspaceContext = {
  user: AuthenticatedUser;
  profile: Profile | null;
  organization: Organization;
  supportSession: {
    id: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    reason: string | null;
    startedAt: string;
    expiresAt: string;
  };
};

export type WorkspaceView =
  | { kind: "membership"; context: OrganizationMembershipContext }
  | { kind: "support"; context: SupportWorkspaceContext };
