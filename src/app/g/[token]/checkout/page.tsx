import { GuestCheckoutForm } from "@/components/guest/guest-forms";
import { GuestContinueLink, GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { loadGuestStay } from "@/lib/guest-portal/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout",
};

export default async function GuestCheckoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  if (!stay.reservation.checkoutCompletedAt) {
    await recordGuestExperienceEvent(stay.tokenHash, "guest_checkout_started");
  }

  const checkoutNotes = stay.content.knowledge
    .filter((entry) => entry.category === "check_out")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const checkoutRule = stay.content.houseRules.find((rule) => rule.ruleKey === "checkout");

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Departure"
        title="Checkout"
        description={`Checkout time ${stay.content.checkOutTime ?? "is set by your host"}.`}
      />
      {checkoutRule?.details ? (
        <p className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 text-sm">{checkoutRule.details}</p>
      ) : null}
      {checkoutNotes.map((entry) => (
        <article key={entry.id} className="mt-4 rounded-[var(--onwarda-radius)] bg-onwarda-white p-4">
          <h2 className="font-medium">{entry.title || "Checkout notes"}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-onwarda-muted">{entry.body}</p>
        </article>
      ))}
      <div className="mt-6">
        <GuestCheckoutForm
          token={stay.token}
          completed={Boolean(stay.reservation.checkoutCompletedAt)}
        />
      </div>
      {stay.reservation.checkoutCompletedAt ? (
        <div className="mt-4">
          <GuestContinueLink
            token={stay.token}
            next={{
              key: "ready",
              title: "Back to stay",
              href: "/",
              ctaLabel: "Back to stay →",
            }}
          />
        </div>
      ) : null}
    </GuestShell>
  );
}
