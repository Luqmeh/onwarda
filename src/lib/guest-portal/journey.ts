import { RESERVATION_JOURNEY_STATUSES, type ReservationJourneyStatus } from "@/types/enums";

export const JOURNEY_STATUS_LABELS: Record<ReservationJourneyStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  needs_attention: "Needs Attention",
  checked_out: "Checked Out",
};

export const GUEST_JOURNEY_STEP_KEYS = {
  GUEST_DETAILS: "guest_details",
  HOUSE_RULES: "house_rules",
  ARRIVAL: "arrival",
} as const;

export type GuestJourneyStepKey =
  (typeof GUEST_JOURNEY_STEP_KEYS)[keyof typeof GUEST_JOURNEY_STEP_KEYS];

export type GuestJourneyStepState = "complete" | "current" | "upcoming" | "not_applicable";

export type GuestStayPhase = "pre_arrival" | "during_stay" | "post_stay";

export type GuestJourneyStep = {
  key: GuestJourneyStepKey;
  title: string;
  description: string;
  href: string;
  required: boolean;
  state: GuestJourneyStepState;
  actionLabel: string | null;
};

export type GuestJourneyNextStep = {
  key: GuestJourneyStepKey | "ready" | "checkout";
  title: string;
  href: string;
  ctaLabel: string;
};

export type GuestJourney = {
  status: ReservationJourneyStatus;
  progress: number;
  completedCount: number;
  requiredCount: number;
  completedSteps: GuestJourneyStepKey[];
  requiredSteps: GuestJourneyStepKey[];
  remainingSteps: GuestJourneyStepKey[];
  currentStep: GuestJourneyStepKey | null;
  nextStep: GuestJourneyNextStep;
  steps: GuestJourneyStep[];
  phase: GuestStayPhase;
  headline: string;
  allRequiredComplete: boolean;
};

export type GuestJourneyInput = {
  checkIn: string;
  checkOut: string;
  onboardingCompleted: boolean;
  rulesAccepted: boolean;
  arrivalNotesProvided: boolean;
  checkoutCompleted: boolean;
  hasGuestVisibleRules: boolean;
  hasOpenIssues?: boolean;
  now?: Date;
};

const STEP_COPY: Record<
  GuestJourneyStepKey,
  { title: string; description: string; href: string; actionLabel: string }
> = {
  guest_details: {
    title: "Guest details",
    description: "Confirm who is staying and how the host can reach you.",
    href: "/onboarding",
    actionLabel: "Complete your guest information →",
  },
  house_rules: {
    title: "House rules",
    description: "Review the house rules before you arrive.",
    href: "/rules",
    actionLabel: "Review house rules →",
  },
  arrival: {
    title: "Arrival information",
    description: "Share how and when you plan to arrive.",
    href: "/arrival",
    actionLabel: "Add your arrival details →",
  },
};

export function calendarDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return localCalendarDate(parsed);
}

export function localCalendarDate(now: Date) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function guestStayPhase(input: {
  checkIn: string;
  checkOut: string;
  checkoutCompleted: boolean;
  now?: Date;
}): GuestStayPhase {
  if (input.checkoutCompleted) {
    return "post_stay";
  }

  const today = localCalendarDate(input.now ?? new Date());
  const checkIn = calendarDate(input.checkIn);
  const checkOut = calendarDate(input.checkOut);

  if (checkIn && today < checkIn) {
    return "pre_arrival";
  }

  if (checkOut && today >= checkOut) {
    return "post_stay";
  }

  return "during_stay";
}

export function journeyProgressFromCounts(completedCount: number, requiredCount: number) {
  if (requiredCount <= 0) {
    return 100;
  }

  return Math.round((completedCount / requiredCount) * 100);
}

function stepState(args: {
  required: boolean;
  complete: boolean;
  current: boolean;
}): GuestJourneyStepState {
  if (!args.required) {
    return "not_applicable";
  }

  if (args.complete) {
    return "complete";
  }

  return args.current ? "current" : "upcoming";
}

export function getGuestJourney(input: GuestJourneyInput): GuestJourney {
  const phase = guestStayPhase(input);
  const rulesRequired = input.hasGuestVisibleRules;
  const rulesComplete = rulesRequired && input.rulesAccepted;
  const guestDetailsComplete = input.onboardingCompleted;
  const arrivalComplete = input.arrivalNotesProvided;

  const definitions: Array<{
    key: GuestJourneyStepKey;
    required: boolean;
    complete: boolean;
  }> = [
    {
      key: GUEST_JOURNEY_STEP_KEYS.GUEST_DETAILS,
      required: true,
      complete: guestDetailsComplete,
    },
    {
      key: GUEST_JOURNEY_STEP_KEYS.HOUSE_RULES,
      required: rulesRequired,
      complete: rulesComplete,
    },
    {
      key: GUEST_JOURNEY_STEP_KEYS.ARRIVAL,
      required: true,
      complete: arrivalComplete,
    },
  ];

  const requiredSteps = definitions.filter((step) => step.required).map((step) => step.key);
  const completedSteps = definitions
    .filter((step) => step.required && step.complete)
    .map((step) => step.key);
  const remainingSteps = definitions
    .filter((step) => step.required && !step.complete)
    .map((step) => step.key);
  const currentStep = remainingSteps[0] ?? null;
  const allRequiredComplete = remainingSteps.length === 0;
  const progress = input.checkoutCompleted
    ? 100
    : journeyProgressFromCounts(completedSteps.length, requiredSteps.length);

  let status: ReservationJourneyStatus = RESERVATION_JOURNEY_STATUSES.NOT_STARTED;

  if (input.checkoutCompleted) {
    status = RESERVATION_JOURNEY_STATUSES.CHECKED_OUT;
  } else if (input.hasOpenIssues) {
    status = RESERVATION_JOURNEY_STATUSES.NEEDS_ATTENTION;
  } else if (allRequiredComplete) {
    status = RESERVATION_JOURNEY_STATUSES.COMPLETE;
  } else if (completedSteps.length > 0) {
    status = RESERVATION_JOURNEY_STATUSES.IN_PROGRESS;
  }

  const steps = definitions.map((step) => {
    const copy = STEP_COPY[step.key];
    const state = stepState({
      required: step.required,
      complete: step.complete,
      current: currentStep === step.key,
    });

    return {
      key: step.key,
      title: copy.title,
      description:
        state === "not_applicable"
          ? "This step is not required for this stay."
          : copy.description,
      href: copy.href,
      required: step.required,
      state,
      actionLabel: state === "current" || state === "upcoming" ? copy.actionLabel : null,
    };
  });

  const nextStep = resolveNextStep({
    remainingSteps,
    allRequiredComplete,
    checkoutCompleted: input.checkoutCompleted,
    phase,
  });

  return {
    status,
    progress,
    completedCount: completedSteps.length,
    requiredCount: requiredSteps.length,
    completedSteps,
    requiredSteps,
    remainingSteps,
    currentStep,
    nextStep,
    steps,
    phase,
    headline: journeyHeadline({
      phase,
      allRequiredComplete,
      checkoutCompleted: input.checkoutCompleted,
    }),
    allRequiredComplete,
  };
}

function resolveNextStep(input: {
  remainingSteps: GuestJourneyStepKey[];
  allRequiredComplete: boolean;
  checkoutCompleted: boolean;
  phase: GuestStayPhase;
}): GuestJourneyNextStep {
  const nextRequired = input.remainingSteps[0];

  if (nextRequired) {
    const copy = STEP_COPY[nextRequired];
    return {
      key: nextRequired,
      title: copy.actionLabel.replace(/\s*→\s*$/, ""),
      href: copy.href,
      ctaLabel: copy.actionLabel,
    };
  }

  if (input.checkoutCompleted) {
    return {
      key: "ready",
      title: "Thanks for staying with us",
      href: "/",
      ctaLabel: "Back to stay →",
    };
  }

  if (input.phase === "post_stay") {
    return {
      key: "checkout",
      title: "Complete checkout",
      href: "/checkout",
      ctaLabel: "Complete checkout →",
    };
  }

  if (input.allRequiredComplete) {
    return {
      key: "ready",
      title: "You're all set",
      href: "/",
      ctaLabel: "You're all set →",
    };
  }

  return {
    key: "ready",
    title: "Explore your stay",
    href: "/",
    ctaLabel: "Back to stay →",
  };
}

function journeyHeadline(input: {
  phase: GuestStayPhase;
  allRequiredComplete: boolean;
  checkoutCompleted: boolean;
}) {
  if (input.checkoutCompleted || input.phase === "post_stay") {
    return "Thanks for staying with us";
  }

  if (input.phase === "during_stay") {
    return "Enjoy your stay";
  }

  if (input.allRequiredComplete) {
    return "You're all set";
  }

  return "Get ready for your stay";
}

export function guestJourneyContinue(
  journey: GuestJourney,
  currentKey?: GuestJourneyStepKey,
): GuestJourneyNextStep {
  if (!currentKey) {
    return journey.nextStep;
  }

  const remainingAfter = journey.remainingSteps.filter((key) => key !== currentKey);

  if (remainingAfter[0]) {
    const copy = STEP_COPY[remainingAfter[0]];
    return {
      key: remainingAfter[0],
      title: copy.actionLabel.replace(/\s*→\s*$/, ""),
      href: copy.href,
      ctaLabel: `Continue to ${copy.title.toLowerCase()} →`,
    };
  }

  if (journey.allRequiredComplete || journey.steps.find((step) => step.key === currentKey)?.state === "complete") {
    return {
      key: "ready",
      title: "You're all set",
      href: "/",
      ctaLabel: "You're all set →",
    };
  }

  return journey.nextStep;
}

export function journeyProgressPercent(input: GuestJourneyInput) {
  return getGuestJourney(input).progress;
}

export function nextGuestAction(input: GuestJourneyInput) {
  const next = getGuestJourney(input).nextStep;
  return {
    label: next.title,
    href: next.href,
  };
}
