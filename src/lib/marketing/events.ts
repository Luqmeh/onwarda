import "server-only";

import { createSupabaseServerClient } from "@/lib/database/server";
import type { DomainEventType } from "@/lib/events/types";

const MARKETING_EVENT_TYPES = [
  "marketing_page_viewed",
  "pricing_viewed",
  "pricing_plan_selected",
  "signup_started",
  "signup_completed",
  "demo_requested",
  "contact_submitted",
  "login_started",
] as const;

type MarketingEventType = (typeof MARKETING_EVENT_TYPES)[number];

export async function recordMarketingEvent(input: {
  type: MarketingEventType | DomainEventType;
  path?: string;
  plan?: string | null;
}) {
  if (!MARKETING_EVENT_TYPES.includes(input.type as MarketingEventType)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("record_marketing_event", {
    p_event_type: input.type,
    p_path: input.path ?? null,
    p_plan: input.plan ?? null,
  });
}
