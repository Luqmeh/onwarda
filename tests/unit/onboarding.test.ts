import { describe, expect, it } from "vitest";

import {
  isOnboardingStep,
  nextOnboardingStep,
  onboardingProgress,
  previousOnboardingStep,
} from "@/lib/onboarding/steps";
import { onboardingPasswordSchema } from "@/lib/validation/onboarding";

describe("onboarding progress", () => {
  it("walks forward and back without leaving the wizard", () => {
    expect(nextOnboardingStep("welcome")).toBe("business");
    expect(nextOnboardingStep("review")).toBe("review");
    expect(previousOnboardingStep("business")).toBe("welcome");
    expect(previousOnboardingStep("welcome")).toBe("welcome");
    expect(isOnboardingStep("properties")).toBe(true);
    expect(isOnboardingStep("billing")).toBe(false);
  });

  it("reports the step position for the progress indicator", () => {
    expect(onboardingProgress("welcome")).toMatchObject({ index: 0, total: 7 });
    expect(onboardingProgress("review").index).toBe(6);
  });
});

describe("onboarding password", () => {
  it("requires a matching password of at least 8 characters", () => {
    expect(onboardingPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(
      onboardingPasswordSchema.safeParse({ password: "long-enough", confirmPassword: "different" }).success,
    ).toBe(false);
    expect(
      onboardingPasswordSchema.safeParse({ password: "long-enough", confirmPassword: "long-enough" }).success,
    ).toBe(true);
  });
});
