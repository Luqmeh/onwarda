"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { clientPropertyPath } from "@/config/client";
import { ORGANIZATION_OPERATIONAL_ROLES } from "@/lib/authorization/roles";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  CONTENT_VISIBILITY,
  HOUSE_RULE_KEYS,
  PROPERTY_AMENITY_LABELS,
  PROPERTY_MEDIA_TYPES,
  contentFieldsForGroup,
  type PropertyAmenity,
} from "@/lib/property-cms/catalog";
import {
  propertyMediaObjectPath,
  readPropertyImageFile,
} from "@/lib/property-cms/media";
import { normalizeExternalMediaUrl } from "@/lib/property-cms/urls";
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
} from "@/lib/errors";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import { uuidSchema } from "@/lib/validation/common";
import {
  createWorkspaceKnowledgeSchema,
  deletePropertyMediaSchema,
  deleteWorkspaceKnowledgeSchema,
  propertyImageMetaSchema,
  updatePropertyAmenitiesSchema,
  updatePropertyContentSchema,
  updatePropertyExternalMediaSchema,
  updatePropertyHouseRulesSchema,
  updatePropertyImageMetaSchema,
  updateWorkspaceKnowledgeSchema,
} from "@/lib/validation/property-cms";
import type { WorkspaceMutationState } from "@/lib/workspace/actions";

export type { WorkspaceMutationState };

function publicMutationError(error: unknown) {
  if (
    error instanceof ValidationError ||
    error instanceof AuthorizationError ||
    error instanceof TenantIsolationError
  ) {
    return error.message;
  }

  return "This action could not be completed.";
}

async function requireCmsProperty(propertyId: string) {
  const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
  const parsedId = uuidSchema.safeParse(propertyId);

  if (!parsedId.success) {
    throw new ValidationError("That property is not available in this workspace.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (error || !property) {
    throw new ValidationError("That property is not available in this workspace.");
  }

  return { context, supabase, propertyId: property.id };
}

function redirectToProperty(propertyId: string): never {
  redirect(clientPropertyPath(propertyId));
}

export async function updatePropertyAmenitiesAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = updatePropertyAmenitiesSchema.safeParse({
      amenities: formData.getAll("amenities"),
    });

    if (!parsed.success) {
      return { error: "Choose amenities from the supported list." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { error: deleteError } = await supabase
      .from("property_amenities")
      .delete()
      .eq("property_id", id)
      .eq("organization_id", context.organization.id);

    if (deleteError) {
      return { error: "Unable to update amenities." };
    }

    if (parsed.data.amenities.length > 0) {
      const { error } = await supabase.from("property_amenities").insert(
        parsed.data.amenities.map((amenity_key, index) => ({
          organization_id: context.organization.id,
          property_id: id,
          amenity_key,
          sort_order: (index + 1) * 10,
        })),
      );

      if (error) {
        return { error: "Unable to update amenities." };
      }
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.amenities_updated",
      metadata: {
        amenities: parsed.data.amenities.map(
          (key) => PROPERTY_AMENITY_LABELS[key as PropertyAmenity] ?? key,
        ),
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function updatePropertyHouseRulesAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const rules = Object.values(HOUSE_RULE_KEYS).map((ruleKey, index) => ({
      ruleKey,
      state: formData.get(`state_${ruleKey}`) || "unspecified",
      details: formData.get(`details_${ruleKey}`),
      visibility: formData.get(`visibility_${ruleKey}`) || CONTENT_VISIBILITY.PUBLIC,
      sortOrder: (index + 1) * 10,
    }));
    const parsed = updatePropertyHouseRulesSchema.safeParse({ rules });

    if (!parsed.success) {
      return { error: "Enter valid house rules." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { error: deleteError } = await supabase
      .from("property_house_rules")
      .delete()
      .eq("property_id", id)
      .eq("organization_id", context.organization.id);

    if (deleteError) {
      return { error: "Unable to update house rules." };
    }

    const rows = parsed.data.rules.filter((rule) => rule.state !== "unspecified" || rule.details);
    if (rows.length > 0) {
      const { error } = await supabase.from("property_house_rules").insert(
        rows.map((rule, index) => ({
          organization_id: context.organization.id,
          property_id: id,
          rule_key: rule.ruleKey,
          state: rule.state,
          details: rule.details ?? null,
          visibility: rule.visibility,
          sort_order: (index + 1) * 10,
        })),
      );

      if (error) {
        return { error: "Unable to update house rules." };
      }
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.rules_updated",
      metadata: { count: rows.length },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function updatePropertyContentAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const groupValue = String(formData.get("group") ?? "content");
    const group =
      groupValue === "access" || groupValue === "private" || groupValue === "content"
        ? groupValue
        : null;

    if (!group) {
      return { error: "Choose a valid content section." };
    }

    const fieldKeys = contentFieldsForGroup(group);
    const fields = fieldKeys.map((fieldKey) => ({
      fieldKey,
      body: formData.get(`body_${fieldKey}`),
      visibility: formData.get(`visibility_${fieldKey}`) || CONTENT_VISIBILITY.PRIVATE,
    }));
    const parsed = updatePropertyContentSchema.safeParse({ fields });

    if (!parsed.success) {
      return { error: "Check visibility for sensitive access fields." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { error: deleteError } = await supabase
      .from("property_content")
      .delete()
      .eq("property_id", id)
      .eq("organization_id", context.organization.id)
      .in("field_key", fieldKeys);

    if (deleteError) {
      return { error: "Unable to update property content." };
    }

    const rows = parsed.data.fields.filter((field) => field.body);
    if (rows.length > 0) {
      const { error } = await supabase.from("property_content").insert(
        rows.map((field) => ({
          organization_id: context.organization.id,
          property_id: id,
          field_key: field.fieldKey,
          body: field.body,
          visibility: field.visibility,
        })),
      );

      if (error) {
        return { error: "Unable to update property content." };
      }
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.content_updated",
      metadata: { fields: rows.map((field) => field.fieldKey) },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function createPropertyKnowledgeAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = createWorkspaceKnowledgeSchema.safeParse({
      propertyId,
      category: formData.get("category"),
      title: formData.get("title"),
      body: formData.get("body"),
      locale: formData.get("locale") || "en",
      visibility: formData.get("visibility") || "guest",
      status: formData.get("status") || "published",
      sortOrder: formData.get("sortOrder"),
    });

    if (!parsed.success) {
      return { error: "Enter a title, category, and the instruction details." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { error } = await supabase.from("property_knowledge").insert({
      organization_id: context.organization.id,
      property_id: id,
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      locale: parsed.data.locale,
      visibility: parsed.data.visibility,
      status: parsed.data.status,
      sort_order: parsed.data.sortOrder,
    });

    if (error) {
      return { error: "Unable to save this instruction." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.instructions_updated",
      metadata: { action: "created", category: parsed.data.category },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function updatePropertyKnowledgeAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = updateWorkspaceKnowledgeSchema.safeParse({
      knowledgeId: formData.get("knowledgeId"),
      category: formData.get("category"),
      title: formData.get("title"),
      body: formData.get("body"),
      visibility: formData.get("visibility"),
      status: formData.get("status"),
      sortOrder: formData.get("sortOrder"),
    });

    if (!parsed.success) {
      return { error: "Enter valid instruction details." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { data: entry, error: lookupError } = await supabase
      .from("property_knowledge")
      .select("id")
      .eq("id", parsed.data.knowledgeId)
      .eq("property_id", id)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !entry) {
      return { error: "That instruction is not available in this workspace." };
    }

    const { error } = await supabase
      .from("property_knowledge")
      .update({
        category: parsed.data.category,
        title: parsed.data.title,
        body: parsed.data.body,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        sort_order: parsed.data.sortOrder,
      })
      .eq("id", entry.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to update this instruction." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.instructions_updated",
      metadata: { action: "updated", knowledgeId: entry.id },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function deletePropertyKnowledgeAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = deleteWorkspaceKnowledgeSchema.safeParse({
      knowledgeId: formData.get("knowledgeId"),
    });

    if (!parsed.success) {
      return { error: "That instruction could not be removed." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { data: entry, error: lookupError } = await supabase
      .from("property_knowledge")
      .select("id")
      .eq("id", parsed.data.knowledgeId)
      .eq("property_id", id)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !entry) {
      return { error: "That instruction is not available in this workspace." };
    }

    const { error } = await supabase
      .from("property_knowledge")
      .delete()
      .eq("id", entry.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to remove this instruction." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.instructions_updated",
      metadata: { action: "deleted", knowledgeId: entry.id },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function uploadPropertyImageAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const image = formData.get("image");
    const parsed = propertyImageMetaSchema.safeParse({
      role: formData.get("role") || "gallery",
      caption: formData.get("caption"),
      altText: formData.get("altText"),
      visibility: formData.get("visibility") || "public",
    });

    if (!(image instanceof File) || image.size === 0 || !parsed.success) {
      return { error: "Choose a PNG, JPEG, or WebP image." };
    }

    const detected = await readPropertyImageFile(image);
    const mediaId = randomUUID();
    const storagePath = propertyMediaObjectPath(
      context.organization.id,
      id,
      mediaId,
      detected.extension,
    );

    if (parsed.data.role === "hero") {
      await supabase
        .from("property_media")
        .update({ role: "gallery" })
        .eq("property_id", id)
        .eq("organization_id", context.organization.id)
        .eq("role", "hero");
    }

    const { data: orderRow } = await supabase
      .from("property_media")
      .select("sort_order")
      .eq("property_id", id)
      .eq("organization_id", context.organization.id)
      .eq("media_type", "image")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: uploadError } = await supabase.storage
      .from(PRIVATE_STORAGE_BUCKETS.propertyMedia)
      .upload(storagePath, detected.bytes, {
        contentType: detected.mime,
        upsert: false,
      });

    if (uploadError) {
      return { error: "The image could not be stored." };
    }

    const { error } = await supabase.from("property_media").insert({
      id: mediaId,
      organization_id: context.organization.id,
      property_id: id,
      media_type: "image",
      role: parsed.data.role,
      storage_path: storagePath,
      sort_order: (orderRow?.sort_order ?? 0) + 10,
      caption: parsed.data.caption ?? null,
      alt_text: parsed.data.altText ?? null,
      visibility: parsed.data.visibility,
    });

    if (error) {
      await supabase.storage.from(PRIVATE_STORAGE_BUCKETS.propertyMedia).remove([storagePath]);
      return { error: "Unable to save this image." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.media_added",
      metadata: { mediaType: "image", role: parsed.data.role },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function updatePropertyImageMetaAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = updatePropertyImageMetaSchema.safeParse({
      mediaId: formData.get("mediaId"),
      role: formData.get("role"),
      caption: formData.get("caption"),
      altText: formData.get("altText"),
      visibility: formData.get("visibility"),
      sortOrder: formData.get("sortOrder"),
    });

    if (!parsed.success) {
      return { error: "Enter valid image details." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { data: media, error: lookupError } = await supabase
      .from("property_media")
      .select("id, media_type")
      .eq("id", parsed.data.mediaId)
      .eq("property_id", id)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !media || media.media_type !== "image") {
      return { error: "That image is not available in this workspace." };
    }

    if (parsed.data.role === "hero") {
      await supabase
        .from("property_media")
        .update({ role: "gallery" })
        .eq("property_id", id)
        .eq("organization_id", context.organization.id)
        .eq("role", "hero")
        .neq("id", media.id);
    }

    const { error } = await supabase
      .from("property_media")
      .update({
        role: parsed.data.role,
        caption: parsed.data.caption ?? null,
        alt_text: parsed.data.altText ?? null,
        visibility: parsed.data.visibility,
        sort_order: parsed.data.sortOrder,
      })
      .eq("id", media.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to update this image." };
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function deletePropertyMediaAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = deletePropertyMediaSchema.safeParse({
      mediaId: formData.get("mediaId"),
    });

    if (!parsed.success) {
      return { error: "That media item could not be removed." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const { data: media, error: lookupError } = await supabase
      .from("property_media")
      .select("id, storage_path, media_type")
      .eq("id", parsed.data.mediaId)
      .eq("property_id", id)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !media) {
      return { error: "That media item is not available in this workspace." };
    }

    const { error } = await supabase
      .from("property_media")
      .delete()
      .eq("id", media.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to remove this media item." };
    }

    if (media.storage_path) {
      await supabase.storage
        .from(PRIVATE_STORAGE_BUCKETS.propertyMedia)
        .remove([media.storage_path]);
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: id,
      actor_user_id: context.user.id,
      event_type: "property.media_removed",
      metadata: { mediaType: media.media_type },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}

export async function updatePropertyExternalMediaAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const parsed = updatePropertyExternalMediaSchema.safeParse({
      videoUrl: formData.get("videoUrl"),
      tourUrl: formData.get("tourUrl"),
      instructionalUrl: formData.get("instructionalUrl"),
    });

    if (!parsed.success) {
      return { error: "Use https URLs from an allowed provider. Do not paste iframe HTML." };
    }

    const { context, supabase, propertyId: id } = await requireCmsProperty(propertyId);
    const entries = [
      {
        type: PROPERTY_MEDIA_TYPES.VIDEO,
        url: parsed.data.videoUrl
          ? normalizeExternalMediaUrl(parsed.data.videoUrl, PROPERTY_MEDIA_TYPES.VIDEO)
          : null,
      },
      {
        type: PROPERTY_MEDIA_TYPES.TOUR_360,
        url: parsed.data.tourUrl
          ? normalizeExternalMediaUrl(parsed.data.tourUrl, PROPERTY_MEDIA_TYPES.TOUR_360)
          : null,
      },
      {
        type: PROPERTY_MEDIA_TYPES.INSTRUCTIONAL_VIDEO,
        url: parsed.data.instructionalUrl
          ? normalizeExternalMediaUrl(
              parsed.data.instructionalUrl,
              PROPERTY_MEDIA_TYPES.INSTRUCTIONAL_VIDEO,
            )
          : null,
      },
    ] as const;

    for (const entry of entries) {
      const { data: existing } = await supabase
        .from("property_media")
        .select("id")
        .eq("property_id", id)
        .eq("organization_id", context.organization.id)
        .eq("media_type", entry.type)
        .maybeSingle();

      if (!entry.url) {
        if (existing) {
          await supabase
            .from("property_media")
            .delete()
            .eq("id", existing.id)
            .eq("organization_id", context.organization.id);
          await supabase.from("events").insert({
            organization_id: context.organization.id,
            property_id: id,
            actor_user_id: context.user.id,
            event_type: "property.media_removed",
            metadata: { mediaType: entry.type },
          });
        }
        continue;
      }

      if (existing) {
        const { error } = await supabase
          .from("property_media")
          .update({ external_url: entry.url, visibility: CONTENT_VISIBILITY.PUBLIC })
          .eq("id", existing.id)
          .eq("organization_id", context.organization.id);

        if (error) {
          return { error: "Unable to update external media." };
        }
      } else {
        const { error } = await supabase.from("property_media").insert({
          organization_id: context.organization.id,
          property_id: id,
          media_type: entry.type,
          external_url: entry.url,
          visibility: CONTENT_VISIBILITY.PUBLIC,
        });

        if (error) {
          return { error: "Unable to save external media." };
        }

        await supabase.from("events").insert({
          organization_id: context.organization.id,
          property_id: id,
          actor_user_id: context.user.id,
          event_type: "property.media_added",
          metadata: { mediaType: entry.type },
        });
      }
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirectToProperty(propertyId);
}
