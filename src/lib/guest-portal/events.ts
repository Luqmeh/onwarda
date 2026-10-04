import "server-only";

import { createServiceRoleClient } from "@/lib/database/admin";

const GUEST_EVENT_TYPES = [
  "guest_portal_opened",
  "guest_onboarding_started",
  "guest_onboarding_completed",
  "guest_rules_viewed",
  "guest_rules_accepted",
  "guest_knowledge_viewed",
  "guest_access_viewed",
  "guest_issue_created",
  "guest_checkout_started",
  "guest_checkout_completed",
] as const;

export type GuestExperienceEventType = (typeof GUEST_EVENT_TYPES)[number];

export async function recordGuestExperienceEvent(
  tokenHash: string,
  type: GuestExperienceEventType,
) {
  if (!GUEST_EVENT_TYPES.includes(type)) {
    return;
  }

  const privileged = createServiceRoleClient();
  await privileged.rpc("record_guest_event", {
    p_token_hash: tokenHash,
    p_event_type: type,
    p_metadata: {},
  });
}
