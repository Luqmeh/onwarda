import { describe, expect, it } from "vitest";

import {
  getGuestJourney,
  guestJourneyContinue,
  journeyProgressFromCounts,
  journeyProgressPercent,
  nextGuestAction,
} from "@/lib/guest-portal/journey";

const base = {
  checkIn: "2026-10-02",
  checkOut: "2026-10-09",
  onboardingCompleted: false,
  rulesAccepted: false,
  arrivalNotesProvided: false,
  checkoutCompleted: false,
  hasGuestVisibleRules: true,
  hasOpenIssues: false,
  now: new Date("2026-09-05T12:00:00"),
};

describe("guest journey projection", () => {
  it("starts not started at 0% and points at guest information", () => {
    const journey = getGuestJourney(base);

    expect(journey.status).toBe("not_started");
    expect(journey.progress).toBe(0);
    expect(journey.headline).toBe("Get ready for your stay");
    expect(journey.currentStep).toBe("guest_details");
    expect(journey.nextStep.href).toBe("/onboarding");
    expect(journey.nextStep.title).toMatch(/guest information/i);
    expect(journey.requiredSteps).toEqual(["guest_details", "house_rules", "arrival"]);
  });

  it("calculates progress from required steps only", () => {
    expect(
      getGuestJourney({
        ...base,
        onboardingCompleted: true,
      }).progress,
    ).toBe(33);

    expect(
      getGuestJourney({
        ...base,
        onboardingCompleted: true,
        rulesAccepted: true,
      }).progress,
    ).toBe(67);

    expect(
      getGuestJourney({
        ...base,
        onboardingCompleted: true,
        rulesAccepted: true,
        arrivalNotesProvided: true,
      }).progress,
    ).toBe(100);
  });

  it("treats a completed journey as 100% ready", () => {
    const journey = getGuestJourney({
      ...base,
      onboardingCompleted: true,
      rulesAccepted: true,
      arrivalNotesProvided: true,
    });

    expect(journey.status).toBe("complete");
    expect(journey.allRequiredComplete).toBe(true);
    expect(journey.headline).toBe("You're all set");
    expect(journey.nextStep.key).toBe("ready");
    expect(journey.remainingSteps).toEqual([]);
    expect(journeyProgressPercent({
      ...base,
      onboardingCompleted: true,
      rulesAccepted: true,
      arrivalNotesProvided: true,
    })).toBe(100);
  });

  it("does not count optional informational content", () => {
    const withoutGuides = getGuestJourney(base);
    const stillTheSame = getGuestJourney({
      ...base,
    });

    expect(withoutGuides.requiredSteps).not.toContain("wifi");
    expect(withoutGuides.requiredSteps).not.toContain("guides");
    expect(withoutGuides.requiredCount).toBe(3);
    expect(stillTheSame.progress).toBe(withoutGuides.progress);
  });

  it("marks house rules not applicable when none exist", () => {
    const journey = getGuestJourney({
      ...base,
      hasGuestVisibleRules: false,
      rulesAccepted: true,
    });

    expect(journey.requiredSteps).toEqual(["guest_details", "arrival"]);
    expect(journey.steps.find((step) => step.key === "house_rules")?.state).toBe("not_applicable");
    expect(journey.nextStep.key).toBe("guest_details");
    expect(journey.progress).toBe(0);
  });

  it("keeps house rules incomplete until they are accepted", () => {
    const journey = getGuestJourney({
      ...base,
      onboardingCompleted: true,
      hasGuestVisibleRules: true,
      rulesAccepted: false,
    });

    expect(journey.status).toBe("in_progress");
    expect(journey.currentStep).toBe("house_rules");
    expect(journey.nextStep.href).toBe("/rules");
    expect(journey.nextStep.title).toMatch(/house rules/i);
    expect(journey.steps.find((step) => step.key === "house_rules")?.state).toBe("current");
  });

  it("completes house rules only after acceptance when rules exist", () => {
    const journey = getGuestJourney({
      ...base,
      onboardingCompleted: true,
      hasGuestVisibleRules: true,
      rulesAccepted: true,
    });

    expect(journey.completedSteps).toContain("house_rules");
    expect(journey.currentStep).toBe("arrival");
    expect(journey.nextStep.href).toBe("/arrival");
  });

  it("changes the next step after each completion", () => {
    expect(nextGuestAction(base).href).toBe("/onboarding");

    expect(
      nextGuestAction({
        ...base,
        onboardingCompleted: true,
      }).href,
    ).toBe("/rules");

    expect(
      nextGuestAction({
        ...base,
        onboardingCompleted: true,
        rulesAccepted: true,
      }).href,
    ).toBe("/arrival");

    expect(
      nextGuestAction({
        ...base,
        onboardingCompleted: true,
        rulesAccepted: true,
        arrivalNotesProvided: true,
      }).href,
    ).toBe("/");
  });

  it("skips rules in the next-step sequence when they are not applicable", () => {
    expect(
      getGuestJourney({
        ...base,
        hasGuestVisibleRules: false,
        onboardingCompleted: true,
      }).nextStep.href,
    ).toBe("/arrival");
  });

  it("returns 100% when no required steps remain or none were required", () => {
    expect(journeyProgressFromCounts(0, 0)).toBe(100);
    expect(journeyProgressFromCounts(2, 4)).toBe(50);
    expect(journeyProgressFromCounts(2, 3)).toBe(67);
  });

  it("adapts copy to stay dates without a second lifecycle", () => {
    expect(
      getGuestJourney({
        ...base,
        onboardingCompleted: true,
        rulesAccepted: true,
        arrivalNotesProvided: true,
        now: new Date("2026-10-05T12:00:00"),
      }).headline,
    ).toBe("Enjoy your stay");

    expect(
      getGuestJourney({
        ...base,
        onboardingCompleted: true,
        rulesAccepted: true,
        arrivalNotesProvided: true,
        checkoutCompleted: true,
        now: new Date("2026-10-10T12:00:00"),
      }).headline,
    ).toBe("Thanks for staying with us");
  });

  it("scopes continue to the next remaining required step", () => {
    const afterRules = getGuestJourney({
      ...base,
      onboardingCompleted: true,
      rulesAccepted: true,
    });

    expect(guestJourneyContinue(afterRules, "house_rules").href).toBe("/arrival");

    const ready = getGuestJourney({
      ...base,
      onboardingCompleted: true,
      rulesAccepted: true,
      arrivalNotesProvided: true,
    });

    expect(guestJourneyContinue(ready, "arrival").ctaLabel).toMatch(/all set/i);
  });

  it("does not let guest A facts produce guest B destinations", () => {
    const guestA = getGuestJourney({
      ...base,
      onboardingCompleted: true,
    });
    const guestB = getGuestJourney({
      ...base,
      hasGuestVisibleRules: false,
      onboardingCompleted: false,
    });

    expect(guestA.currentStep).toBe("house_rules");
    expect(guestB.currentStep).toBe("guest_details");
    expect(guestA.nextStep.href).not.toBe(guestB.nextStep.href);
    expect(JSON.stringify(guestA)).not.toMatch(/reservation_id|organization_id|guest_id/);
  });
});
