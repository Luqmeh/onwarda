"use client";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  PROPERTY_AMENITIES,
  PROPERTY_AMENITY_LABELS,
} from "@/lib/property-cms/catalog";
import {
  updatePropertyAmenitiesAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/property-cms-actions";

const initialState: WorkspaceMutationState = {};

export function PropertyAmenitiesForm({
  propertyId,
  selected,
}: {
  propertyId: string;
  selected: string[];
}) {
  const action = useMemo(
    () => updatePropertyAmenitiesAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.values(PROPERTY_AMENITIES).map((amenity) => (
          <label
            key={amenity}
            className="flex items-center gap-3 rounded-lg border border-transparent bg-onwarda-cream/70 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="amenities"
              value={amenity}
              defaultChecked={selected.includes(amenity)}
            />
            {PROPERTY_AMENITY_LABELS[amenity]}
          </label>
        ))}
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save amenities"}
      </Button>
    </form>
  );
}
