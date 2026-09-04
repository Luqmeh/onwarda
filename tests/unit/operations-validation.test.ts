import { describe, expect, it } from "vitest";

import {
  createWorkspaceGuestSchema,
  createWorkspaceReservationSchema,
  updateWorkspacePropertySchema,
} from "@/lib/validation/operations";

const PROPERTY_ID = "11111111-1111-4111-8111-111111111111";
const GUEST_ID = "22222222-2222-4222-8222-222222222222";

describe("property validation", () => {
  it("accepts basic property fields without an organization id", () => {
    const parsed = updateWorkspacePropertySchema.safeParse({
      name: "Riad Atlas",
      city: "Marrakech",
      country: "Morocco",
      status: "active",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("organizationId");
  });
});

describe("guest validation", () => {
  it("normalizes email and allows a missing phone", () => {
    const parsed = createWorkspaceGuestSchema.safeParse({
      firstName: "Amelia",
      lastName: "Guest",
      email: "Amelia@Example.com",
      phone: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("amelia@example.com");
      expect(parsed.data.phone).toBeUndefined();
    }
  });
});

describe("reservation validation", () => {
  it("requires departure after arrival", () => {
    const parsed = createWorkspaceReservationSchema.safeParse({
      propertyId: PROPERTY_ID,
      guestMode: "existing",
      guestId: GUEST_ID,
      checkIn: "2026-09-10",
      checkOut: "2026-09-10",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts an existing-guest stay", () => {
    const parsed = createWorkspaceReservationSchema.safeParse({
      propertyId: PROPERTY_ID,
      guestMode: "existing",
      guestId: GUEST_ID,
      checkIn: "2026-09-10",
      checkOut: "2026-09-14",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("upcoming");
    }
  });

  it("requires a name when creating a guest with the reservation", () => {
    const parsed = createWorkspaceReservationSchema.safeParse({
      propertyId: PROPERTY_ID,
      guestMode: "new",
      checkIn: "2026-09-10",
      checkOut: "2026-09-14",
    });

    expect(parsed.success).toBe(false);
  });
});
