"use server";

import { recordPublicExperienceEvent } from "@/lib/public/events";

export async function recordPublicBookingCtaAction(
  organizationSlug: string,
  propertySlug: string,
) {
  await recordPublicExperienceEvent({
    type: "public_booking_cta_clicked",
    organizationSlug,
    propertySlug,
  });
}
