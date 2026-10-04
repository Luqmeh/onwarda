import { GuestRulesForm } from "@/components/guest/guest-forms";
import { GuestContinueLink, GuestEmptyState, GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { HOUSE_RULE_LABELS, HOUSE_RULE_STATE_LABELS, type HouseRuleKey } from "@/lib/property-cms/catalog";
import { guestJourneyContinue } from "@/lib/guest-portal/journey";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { loadGuestStay } from "@/lib/guest-portal/load";
import { formatDateTime } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "House rules",
};

export default async function GuestRulesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  await recordGuestExperienceEvent(stay.tokenHash, "guest_rules_viewed");

  const hasRules = stay.content.houseRules.length > 0;
  const accepted = hasRules && Boolean(stay.reservation.rulesAcceptedAt);
  const continueNext = guestJourneyContinue(stay.journey, "house_rules");

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Stay"
        title="House rules"
        description={
          hasRules
            ? accepted
              ? "Thank you for reviewing the house rules."
              : "Please review the house rules before continuing."
            : "This step is not required."
        }
      />

      {!hasRules ? (
        <>
          <GuestEmptyState
            title="House rules"
            body="No house rules have been provided for this stay. This step is not required."
          />
          <div className="mt-6">
            <GuestContinueLink token={stay.token} next={continueNext} />
          </div>
        </>
      ) : (
        <>
          <ul className="divide-y rounded-[var(--onwarda-radius)] bg-onwarda-white shadow-onwarda">
            {stay.content.houseRules.map((rule) => (
              <li key={rule.ruleKey} className="px-4 py-3">
                <p className="font-medium">
                  {HOUSE_RULE_LABELS[rule.ruleKey as HouseRuleKey] ?? rule.ruleKey}
                </p>
                <p className="text-sm text-onwarda-muted">
                  {HOUSE_RULE_STATE_LABELS[rule.state] ?? rule.state}
                  {rule.details ? ` · ${rule.details}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {accepted ? (
              <>
                <p className="rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 py-3 text-sm shadow-onwarda">
                  ✓ House rules accepted
                  {stay.reservation.rulesAcceptedAt ? (
                    <span className="mt-1 block text-onwarda-muted">
                      Accepted on {formatDateTime(stay.reservation.rulesAcceptedAt)}
                    </span>
                  ) : null}
                </p>
                <div className="mt-4">
                  <GuestContinueLink token={stay.token} next={continueNext} />
                </div>
              </>
            ) : (
              <GuestRulesForm token={stay.token} />
            )}
          </div>
        </>
      )}
    </GuestShell>
  );
}
