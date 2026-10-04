import Link from "next/link";

import {
  GuestInformationHub,
  GuestJourneyChecklist,
  GuestReadyActions,
  guestProgressLabel,
} from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { guestPortalPath } from "@/config/app";
import { JOURNEY_STATUS_LABELS } from "@/lib/guest-portal/journey";
import { loadGuestStayOrMark } from "@/lib/guest-portal/load";
import { formatStay } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your stay",
};

export default async function GuestPortalHomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStayOrMark(token, true);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  const hero = stay.media.find((item) => item.role === "hero" && item.signedUrl) ?? stay.media.find((item) => item.signedUrl);
  const { journey } = stay;
  const nextHref = guestPortalPath(stay.token, journey.nextStep.href === "/" ? "" : journey.nextStep.href);

  return (
    <GuestShell stay={stay}>
      {hero?.signedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero.signedUrl}
          alt={stay.content.name}
          className="mb-5 h-48 w-full rounded-[var(--onwarda-radius)] object-cover"
        />
      ) : null}
      <p className="onwarda-kicker">Welcome, {stay.guest.firstName}</p>
      <h1 className="onwarda-display mt-2">{stay.content.name}</h1>
      <p className="mt-2 text-sm text-onwarda-muted">
        {formatStay(stay.reservation.checkIn, stay.reservation.checkOut)}
      </p>

      <section className="mt-6 rounded-[var(--onwarda-radius)] bg-onwarda-white p-5 shadow-onwarda">
        <p className="onwarda-kicker">{journey.headline}</p>
        {journey.allRequiredComplete || stay.reservation.checkoutCompletedAt ? (
          <>
            <h2 className="mt-3 text-xl font-medium">
              {journey.phase === "post_stay" || stay.reservation.checkoutCompletedAt
                ? "Thanks for staying with us"
                : "Your stay is ready."}
            </h2>
            <p className="mt-2 text-sm text-onwarda-muted">
              {stay.content.name}
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              {formatStay(stay.reservation.checkIn, stay.reservation.checkOut)}
            </p>
            <GuestJourneyChecklist token={stay.token} steps={journey.steps} />
            <p className="mt-4 text-sm text-onwarda-muted">
              You can still access all your stay information below.
            </p>
            <GuestReadyActions token={stay.token} />
          </>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-sm text-onwarda-muted">
                {journey.completedCount} of {journey.requiredCount} complete
              </p>
              <p className="text-xs text-onwarda-muted">{JOURNEY_STATUS_LABELS[journey.status]}</p>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--client-primary)_18%,var(--onwarda-cream))]"
              role="progressbar"
              aria-valuenow={journey.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={guestProgressLabel(journey)}
            >
              <div
                className="h-full rounded-full bg-[var(--client-primary)] motion-reduce:transition-none"
                style={{ width: `${journey.progress}%` }}
              />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--client-primary)]">Next step</p>
            <Link
              href={nextHref}
              className="mt-2 flex min-h-14 items-center justify-between rounded-[var(--onwarda-radius)] bg-[var(--client-primary)] px-4 text-onwarda-white"
            >
              <span className="text-base font-medium">{journey.nextStep.title}</span>
              <span aria-hidden="true">→</span>
            </Link>
            <GuestJourneyChecklist token={stay.token} steps={journey.steps} />
          </>
        )}
      </section>

      <GuestInformationHub token={stay.token} />
    </GuestShell>
  );
}
