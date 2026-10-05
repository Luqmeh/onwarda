export const ONBOARDING_STEPS = [
  { id: "welcome", label: "Welcome", requirement: "required" },
  { id: "business", label: "Business", requirement: "required" },
  { id: "branding", label: "Brand", requirement: "optional" },
  { id: "properties", label: "Properties", requirement: "required" },
  { id: "guides", label: "Guides", requirement: "optional" },
  { id: "operations", label: "Operations", requirement: "optional" },
  { id: "review", label: "Review", requirement: "required" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

const STEP_IDS = ONBOARDING_STEPS.map((step) => step.id);

export function isOnboardingStep(value: string | null | undefined): value is OnboardingStepId {
  return STEP_IDS.includes(value as OnboardingStepId);
}

export function nextOnboardingStep(step: OnboardingStepId): OnboardingStepId {
  const index = STEP_IDS.indexOf(step);
  return STEP_IDS[Math.min(index + 1, STEP_IDS.length - 1)] ?? "review";
}

export function previousOnboardingStep(step: OnboardingStepId): OnboardingStepId {
  const index = STEP_IDS.indexOf(step);
  return STEP_IDS[Math.max(index - 1, 0)] ?? "welcome";
}

export function onboardingProgress(step: OnboardingStepId) {
  const index = STEP_IDS.indexOf(step);
  return {
    index,
    total: STEP_IDS.length,
    ratio: (index + 1) / STEP_IDS.length,
  };
}
