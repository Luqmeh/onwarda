import { GuestArrivalForm } from "@/components/guest/guest-forms";
import { GuestEmptyState, GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { PROPERTY_CONTENT_FIELD_META } from "@/lib/property-cms/catalog";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { loadGuestStay } from "@/lib/guest-portal/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Arrival & access",
};

const ACCESS_FIELDS = [
  "arrival_instructions",
  "parking_instructions",
  "building_entry",
  "key_retrieval",
  "lockbox_instructions",
  "smart_lock_instructions",
  "reception_instructions",
] as const;

export default async function GuestArrivalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  await recordGuestExperienceEvent(stay.tokenHash, "guest_access_viewed");

  const sections = ACCESS_FIELDS.flatMap((field) => {
    const body = stay.content.content[field];
    return body
      ? [
          {
            field,
            label: PROPERTY_CONTENT_FIELD_META[field].label,
            body,
          },
        ]
      : [];
  });
  const arrivalComplete = Boolean(stay.reservation.arrivalNotes?.trim());

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Arrival"
        title="Arrival & access"
        description="Share your arrival plans, then use the access details your host has prepared."
      />

      <section className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 shadow-onwarda">
        <h2 className="font-medium">Arrival information</h2>
        {arrivalComplete ? (
          <p className="mt-2 text-sm text-[var(--client-primary)]">✓ Arrival information saved</p>
        ) : (
          <p className="mt-2 text-sm text-onwarda-muted">
            Add a short note so your host knows when to expect you.
          </p>
        )}
        <div className="mt-4">
          <GuestArrivalForm
            token={stay.token}
            arrivalNotes={stay.reservation.arrivalNotes}
            completed={arrivalComplete}
          />
        </div>
      </section>

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 py-3">
          <dt className="text-onwarda-muted">Check-in</dt>
          <dd className="mt-1 font-medium">{stay.content.checkInTime ?? "See host instructions"}</dd>
        </div>
        <div className="rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 py-3">
          <dt className="text-onwarda-muted">Checkout</dt>
          <dd className="mt-1 font-medium">{stay.content.checkOutTime ?? "See host instructions"}</dd>
        </div>
      </dl>
      {sections.length === 0 ? (
        <div className="mt-5">
          <GuestEmptyState
            title="Access details"
            body="Access information has not been provided for this stay yet. Use Help if you need assistance."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {sections.map((section) => (
            <article key={section.field} className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 shadow-onwarda">
              <h2 className="font-medium">{section.label}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-onwarda-muted">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </GuestShell>
  );
}
