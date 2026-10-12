"use client";

import { useActionState, useMemo } from "react";

import { useI18n } from "@/i18n/provider";

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

function contentFieldCopy(
  field: PropertyContentField,
  catalog: {
    neighborhood: string;
    neighborhoodHelp: string;
    nearbyAttractions: string;
    nearbyAttractionsHelp: string;
    transportation: string;
    transportationHelp: string;
    localInformation: string;
    localInformationHelp: string;
    arrivalInstructions: string;
    arrivalInstructionsHelp: string;
    parkingInstructions: string;
    parkingInstructionsHelp: string;
    buildingEntry: string;
    buildingEntryHelp: string;
    keyRetrieval: string;
    keyRetrievalHelp: string;
    lockbox: string;
    lockboxHelp: string;
    smartLock: string;
    smartLockHelp: string;
    reception: string;
    receptionHelp: string;
    contactInformation: string;
    contactInformationHelp: string;
    internalNotes: string;
    internalNotesHelp: string;
  },
) {
  const copy = {
    neighborhood: { label: catalog.neighborhood, help: catalog.neighborhoodHelp },
    nearby_attractions: { label: catalog.nearbyAttractions, help: catalog.nearbyAttractionsHelp },
    transportation: { label: catalog.transportation, help: catalog.transportationHelp },
    local_information: { label: catalog.localInformation, help: catalog.localInformationHelp },
    arrival_instructions: { label: catalog.arrivalInstructions, help: catalog.arrivalInstructionsHelp },
    parking_instructions: { label: catalog.parkingInstructions, help: catalog.parkingInstructionsHelp },
    building_entry: { label: catalog.buildingEntry, help: catalog.buildingEntryHelp },
    key_retrieval: { label: catalog.keyRetrieval, help: catalog.keyRetrievalHelp },
    lockbox_instructions: { label: catalog.lockbox, help: catalog.lockboxHelp },
    smart_lock_instructions: { label: catalog.smartLock, help: catalog.smartLockHelp },
    reception_instructions: { label: catalog.reception, help: catalog.receptionHelp },
    contact_information: { label: catalog.contactInformation, help: catalog.contactInformationHelp },
    private_notes: { label: catalog.internalNotes, help: catalog.internalNotesHelp },
  } satisfies Record<PropertyContentField, { label: string; help: string }>;

  return copy[field];
}

function visibilityOptions(
  field: PropertyContentField,
  labels: { public: string; guestOnly: string; private: string },
) {
  const meta = PROPERTY_CONTENT_FIELD_META[field];
  const options: Array<{ value: ContentVisibility; label: string }> = [];

  if (meta.allowPublic) {
    options.push({ value: "public", label: labels.public });
  }
  if (meta.allowGuest) {
    options.push({ value: "guest", label: labels.guestOnly });
  }
  options.push({ value: "private", label: labels.private });
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
  const { messages } = useI18n();
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
        const copy = contentFieldCopy(field, messages.catalog);
        const options = visibilityOptions(field, {
          public: messages.screens.public,
          guestOnly: messages.screens.guestOnly,
          private: messages.screens.private,
        });
        return (
          <div key={field} className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label htmlFor={`body_${field}`}>{copy.label}</Label>
                <p className="mt-1 text-xs text-onwarda-muted">{copy.help}</p>
              </div>
              <select
                name={`visibility_${field}`}
                defaultValue={current?.visibility ?? meta.defaultVisibility}
                className={`${cmsFieldClass} w-auto min-w-36`}
                aria-label={copy.label}
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
        {pending ? messages.actions.saving : messages.actions.saveSection}
      </Button>
    </form>
  );
}
