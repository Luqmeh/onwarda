import { z } from "zod";

export const uuidSchema = z.uuid();

export const emailSchema = z.email();

export const urlSchema = z.url();

export const nonEmptyStringSchema = z.string().trim().min(1).max(500);

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value.");

export const timezoneSchema = z.string().min(1).max(100);

export const languageSchema = z.enum(["en", "fr", "ar"]);

export const dateSchema = z.iso.date();

export const dateTimeSchema = z.iso.datetime();
