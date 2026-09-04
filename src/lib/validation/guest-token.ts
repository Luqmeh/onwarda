import { z } from "zod";

export const guestPortalTokenSchema = z
  .string()
  .trim()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Guest tokens must be opaque random values.");
