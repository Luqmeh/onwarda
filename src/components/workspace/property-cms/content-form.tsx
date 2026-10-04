"use client";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cmsFieldClass, cmsTextareaClass } from "@/components/workspace/property-cms/section";
import {
  PROPERTY_CONTENT_FIELD_META,
  contentFieldsForGroup,
  type ContentVisibility,
  type PropertyContentField,
} from "@/lib/property-cms/catalog";
import {
  updatePropertyContentAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/property-cms-actions";

const initialState: WorkspaceMutationState = {};

type ContentValue = {
  fieldKey: string;
  body: string;
  visibility: string;
};

function visibilityOptions(field: PropertyContentField) {
  const meta = PROPERTY_CONTENT_FIELD_META[field];
  const options: Array<{ value: ContentVisibility; label: string }> = [];

  if (meta.allowPublic) {
    options.push({ value: "public", label: "Public" });
  }
  if (meta.allowGuest) {
    options.push({ value: "guest", label: "Guest only" });
  }
  options.push({ value: "private", label: "Private" });
  return options;
}

export function PropertyContentForm({
  propertyId,
  group,
  values,
}: {
  propertyId: string;
  group: "content" | "access" | "private";
  values: ContentValue[];
}) {
  const action = useMemo(
    () => updatePropertyContentAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const byKey = new Map(values.map((value) => [value.fieldKey, value]));

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="group" value={group} />
      {contentFieldsForGroup(group).map((field) => {
        const meta = PROPERTY_CONTENT_FIELD_META[field];
        const current = byKey.get(field);
        const options = visibilityOptions(field);
        return (
          <div key={field} className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label htmlFor={`body_${field}`}>{meta.label}</Label>
                <p className="mt-1 text-xs text-onwarda-muted">{meta.description}</p>
              </div>
              <select
                name={`visibility_${field}`}
                defaultValue={current?.visibility ?? meta.defaultVisibility}
                className={`${cmsFieldClass} w-auto min-w-36`}
                aria-label={`${meta.label} visibility`}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id={`body_${field}`}
              name={`body_${field}`}
              rows={group === "private" ? 4 : 3}
              maxLength={8000}
              defaultValue={current?.body ?? ""}
              className={cmsTextareaClass}
            />
          </div>
        );
      })}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save section"}
      </Button>
    </form>
  );
}
