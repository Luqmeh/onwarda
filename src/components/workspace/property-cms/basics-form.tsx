"use client";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cmsFieldClass, cmsTextareaClass } from "@/components/workspace/property-cms/section";
import {
  PROPERTY_CONTENT_LANGUAGE_LABELS,
  PROPERTY_CONTENT_LANGUAGES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/property-cms/catalog";
import {
  updateWorkspacePropertyAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";
import { PROPERTY_TYPES } from "@/types/enums";

const initialState: WorkspaceMutationState = {};

export function PropertyBasicsForm({
  propertyId,
  name,
  internalIdentifier,
  propertyType,
  address,
  city,
  country,
  capacity,
  bedrooms,
  bathrooms,
  checkInTime,
  checkOutTime,
  description,
  languages,
  status,
  isListedPublicly,
  bookingUrl,
}: {
  propertyId: string;
  name: string;
  internalIdentifier: string | null;
  propertyType: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  description: string | null;
  languages: string[];
  status: string;
  isListedPublicly: boolean;
  bookingUrl: string | null;
}) {
  const action = useMemo(
    () => updateWorkspacePropertyAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Property name</Label>
          <Input id="name" name="name" required maxLength={120} defaultValue={name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="internalIdentifier">Internal identifier</Label>
          <Input
            id="internalIdentifier"
            name="internalIdentifier"
            maxLength={80}
            defaultValue={internalIdentifier ?? ""}
            placeholder="ATLAS-01"
          />
          <p className="text-xs text-onwarda-muted">Operator-facing only. Never shown on public pages.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyType">Property type</Label>
          <select
            id="propertyType"
            name="propertyType"
            defaultValue={propertyType ?? ""}
            className={cmsFieldClass}
          >
            <option value="">Not set</option>
            {Object.values(PROPERTY_TYPES).map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" maxLength={200} defaultValue={address ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" maxLength={80} defaultValue={city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" maxLength={80} defaultValue={country ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Maximum guests</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={100}
            defaultValue={capacity ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bedrooms">Bedrooms</Label>
          <Input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            max={50}
            defaultValue={bedrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bathrooms">Bathrooms</Label>
          <Input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min={0}
            max={50}
            step={0.5}
            defaultValue={bathrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkInTime">Check-in</Label>
          <Input id="checkInTime" name="checkInTime" type="time" defaultValue={checkInTime ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOutTime">Checkout</Label>
          <Input
            id="checkOutTime"
            name="checkOutTime"
            type="time"
            defaultValue={checkOutTime ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status === "archived" ? "inactive" : status}
            className={cmsFieldClass}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bookingUrl">Public booking URL</Label>
          <Input
            id="bookingUrl"
            name="bookingUrl"
            type="url"
            maxLength={500}
            defaultValue={bookingUrl ?? ""}
            placeholder="https://"
          />
          <p className="text-xs text-onwarda-muted">
            Optional https link for the public property page. Onwarda does not process payments.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="isListedPublicly"
            defaultChecked={isListedPublicly}
            className="mt-1"
          />
          <span>
            List this home on the public operator page when status is active.
            <span className="mt-1 block text-xs text-onwarda-muted">
              Draft, inactive, and private content stay hidden regardless of this setting.
            </span>
          </span>
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Short description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={description ?? ""}
          className={cmsTextareaClass}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Supported languages</legend>
        <div className="flex flex-wrap gap-3">
          {Object.values(PROPERTY_CONTENT_LANGUAGES).map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="languages"
                value={code}
                defaultChecked={languages.includes(code)}
              />
              {PROPERTY_CONTENT_LANGUAGE_LABELS[code]}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save basic information"}
      </Button>
    </form>
  );
}
