import "server-only";

import { createSupabaseServerClient } from "@/lib/database/server";
import type { DomainEventType } from "@/lib/events/types";

const PUBLIC_EVENT_TYPES = [
  "public_operator_viewed",
  "public_property_viewed",
  "public_property_media_viewed",
  "public_booking_cta_clicked",
] as const;

type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];

export async function recordPublicExperienceEvent(input: {
  type: PublicEventType | DomainEventType;
  organizationSlug: string;
  propertySlug?: string;
}) {
  if (!PUBLIC_EVENT_TYPES.includes(input.type as PublicEventType)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("record_public_event", {
    p_event_type: input.type,
    p_org_slug: input.organizationSlug,
    p_property_slug: input.propertySlug ?? null,
    p_metadata: {},
  });
}
