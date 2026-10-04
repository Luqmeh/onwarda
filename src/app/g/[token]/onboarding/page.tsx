import { GuestOnboardingForm } from "@/components/guest/guest-forms";
import { GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { loadGuestStay } from "@/lib/guest-portal/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guest information",
};

export default async function GuestOnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  const completed = Boolean(stay.reservation.onboardingCompletedAt);

  if (!completed) {
    await recordGuestExperienceEvent(stay.tokenHash, "guest_onboarding_started");
  }

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Stay"
        title="Guest information"
        description="Tell the host who is arriving and how they can reach you."
      />
      {completed ? (
        <p className="mb-5 rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 py-3 text-sm shadow-onwarda">
          ✓ Guest details saved
        </p>
      ) : null}
      <GuestOnboardingForm
        token={stay.token}
        firstName={stay.guest.firstName}
        lastName={stay.guest.lastName}
        email={stay.guest.email}
        phone={stay.guest.phone}
        numberOfGuests={stay.reservation.numberOfGuests}
        completed={completed}
      />
    </GuestShell>
  );
}
