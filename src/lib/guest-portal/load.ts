import "server-only";

import {
  resolveOrganizationBranding,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";
import { createServiceRoleClient } from "@/lib/database/admin";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { getGuestJourney, type GuestJourney } from "@/lib/guest-portal/journey";
import { createGuestOperatorLogoSignedUrl, createGuestPropertyMediaSignedUrl } from "@/lib/guest-portal/media";
import { inspectGuestPortalToken, type GuestTokenStatus } from "@/lib/guest-portal/resolve";
import {
  getGuestPropertyContent,
  type GuestPropertyContent,
} from "@/lib/property-cms/safe-content";
import { snapshotFromPublicJson } from "@/lib/public/snapshot";
import type { ReservationJourneyStatus, ReservationStatus } from "@/types/enums";

export type GuestStayIssue = {
  category: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
};

export type GuestStay = {
  status: "ok";
  token: string;
  tokenHash: string;
  branding: ResolvedOrganizationBranding;
  guest: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  reservation: {
    checkIn: string;
    checkOut: string;
    status: ReservationStatus;
    numberOfGuests: number;
    journeyStatus: ReservationJourneyStatus;
    onboardingCompletedAt: string | null;
    rulesAcceptedAt: string | null;
    rulesAcceptedVersion: string | null;
    checkoutCompletedAt: string | null;
    arrivalNotes: string | null;
  };
  content: GuestPropertyContent;
  media: Array<GuestPropertyContent["media"][number] & { signedUrl: string | null }>;
  issues: GuestStayIssue[];
  journey: GuestJourney;
  progress: number;
  nextAction: { label: string; href: string };
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function brandingFromJson(
  organization: Record<string, unknown> | null,
  logoUrl: string | null,
): ResolvedOrganizationBranding {
  const name = typeof organization?.name === "string" ? organization.name : "Stay";

  return resolveOrganizationBranding({
    organizationId:
      typeof organization?.slug === "string" ? organization.slug : "guest-stay",
    organizationName: name,
    branding: {
      display_name: typeof organization?.displayName === "string" ? organization.displayName : null,
      public_description:
        typeof organization?.publicDescription === "string" ? organization.publicDescription : null,
      logo_path: typeof organization?.logoPath === "string" ? organization.logoPath : null,
      primary_color: typeof organization?.primaryColor === "string" ? organization.primaryColor : null,
      secondary_color:
        typeof organization?.secondaryColor === "string" ? organization.secondaryColor : null,
      accent_color: typeof organization?.accentColor === "string" ? organization.accentColor : null,
    },
    logoUrl,
  });
}

export async function loadGuestStay(
  token: string,
): Promise<GuestStay | { status: Exclude<GuestTokenStatus, "valid"> }> {
  const inspected = await inspectGuestPortalToken(token);

  if (inspected.status !== "valid") {
    return { status: inspected.status };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("get_guest_stay_bundle", {
    p_token_hash: inspected.tokenHash,
  });

  if (error) {
    return { status: "unavailable" };
  }

  const payload = asRecord(data);
  const payloadStatus = payload?.status;

  if (
    payloadStatus === "invalid" ||
    payloadStatus === "expired" ||
    payloadStatus === "revoked" ||
    payloadStatus === "unavailable"
  ) {
    return { status: payloadStatus };
  }

  const snapshot = snapshotFromPublicJson(payload?.snapshot);

  if (!snapshot || payloadStatus !== "ok") {
    return { status: "unavailable" };
  }

  const content = getGuestPropertyContent(snapshot);
  const organization = asRecord(payload?.organization);
  const logoUrl = await createGuestOperatorLogoSignedUrl(
    typeof organization?.logoPath === "string" ? organization.logoPath : null,
  );
  const media = await Promise.all(
    content.media.map(async (item) => ({
      ...item,
      storagePath: null,
      signedUrl: item.storagePath
        ? await createGuestPropertyMediaSignedUrl(inspected.tokenHash, item.id)
        : null,
    })),
  );

  const guest = asRecord(payload?.guest);
  const reservation = asRecord(payload?.reservation);
  const onboardingCompleted = Boolean(reservation?.onboardingCompletedAt);
  const rulesAccepted = Boolean(reservation?.rulesAcceptedAt);
  const checkoutCompleted = Boolean(reservation?.checkoutCompletedAt);
  const arrivalNotes =
    typeof reservation?.arrivalNotes === "string" ? reservation.arrivalNotes : null;
  const storedJourneyStatus = (
    typeof reservation?.journeyStatus === "string" ? reservation.journeyStatus : "not_started"
  ) as ReservationJourneyStatus;
  const issues = Array.isArray(payload?.issues)
    ? payload.issues.flatMap((item) => {
        const issue = asRecord(item);

        if (!issue || typeof issue.description !== "string") {
          return [];
        }

        return [
          {
            category: typeof issue.category === "string" ? issue.category : "other",
            description: issue.description,
            status: typeof issue.status === "string" ? issue.status : "open",
            priority: typeof issue.priority === "string" ? issue.priority : "medium",
            createdAt: typeof issue.createdAt === "string" ? issue.createdAt : "",
          },
        ];
      })
    : [];
  const journey = getGuestJourney({
    checkIn: typeof reservation?.checkIn === "string" ? reservation.checkIn : "",
    checkOut: typeof reservation?.checkOut === "string" ? reservation.checkOut : "",
    onboardingCompleted,
    rulesAccepted,
    arrivalNotesProvided: Boolean(arrivalNotes?.trim()),
    checkoutCompleted,
    hasGuestVisibleRules: content.houseRules.length > 0,
    hasOpenIssues:
      storedJourneyStatus === "needs_attention" ||
      issues.some((issue) => issue.status === "open" || issue.status === "in_progress"),
  });

  return {
    status: "ok",
    token,
    tokenHash: inspected.tokenHash,
    branding: brandingFromJson(organization, logoUrl),
    guest: {
      firstName: typeof guest?.firstName === "string" ? guest.firstName : "Guest",
      lastName: typeof guest?.lastName === "string" ? guest.lastName : "",
      email: typeof guest?.email === "string" ? guest.email : null,
      phone: typeof guest?.phone === "string" ? guest.phone : null,
    },
    reservation: {
      checkIn: typeof reservation?.checkIn === "string" ? reservation.checkIn : "",
      checkOut: typeof reservation?.checkOut === "string" ? reservation.checkOut : "",
      status: (typeof reservation?.status === "string"
        ? reservation.status
        : "upcoming") as ReservationStatus,
      numberOfGuests:
        typeof reservation?.numberOfGuests === "number" ? reservation.numberOfGuests : 1,
      journeyStatus: journey.status,
      onboardingCompletedAt:
        typeof reservation?.onboardingCompletedAt === "string"
          ? reservation.onboardingCompletedAt
          : null,
      rulesAcceptedAt:
        typeof reservation?.rulesAcceptedAt === "string" ? reservation.rulesAcceptedAt : null,
      rulesAcceptedVersion:
        typeof reservation?.rulesAcceptedVersion === "string"
          ? reservation.rulesAcceptedVersion
          : null,
      checkoutCompletedAt:
        typeof reservation?.checkoutCompletedAt === "string"
          ? reservation.checkoutCompletedAt
          : null,
      arrivalNotes,
    },
    content: {
      ...content,
      media: content.media.map((item) => ({ ...item, storagePath: null })),
    },
    media,
    issues,
    journey,
    progress: journey.progress,
    nextAction: {
      label: journey.nextStep.title,
      href: journey.nextStep.href,
    },
  };
}

export async function loadGuestStayOrMark(
  token: string,
  openedEvent = false,
) {
  const stay = await loadGuestStay(token);

  if (stay.status === "ok" && openedEvent) {
    await recordGuestExperienceEvent(stay.tokenHash, "guest_portal_opened");
  }

  return stay;
}
