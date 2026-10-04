import "server-only";

import { DOMAIN_EVENT_TYPES } from "@/lib/events/types";
import { createSupabaseServerClient } from "@/lib/database/server";
import { AppError } from "@/lib/errors";

export async function recordCleaningEvent(input: {
  organizationId: string;
  actorUserId: string;
  eventType: (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];
  propertyId?: string | null;
  metadata?: Record<string, string>;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("events").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    property_id: input.propertyId ?? null,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new AppError("cleaning_event_failed", "Unable to record this cleaning change.", 500);
  }
}
