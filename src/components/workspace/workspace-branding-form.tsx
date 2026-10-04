"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_BRAND_COLORS } from "@/lib/branding/colors";
import type { ResolvedOrganizationBranding } from "@/lib/branding/resolve";
import {
  removeWorkspaceBrandingLogoAction,
  updateWorkspaceBrandingAction,
  type WorkspaceBrandingMutationState,
} from "@/lib/workspace/branding-actions";

const initialState: WorkspaceBrandingMutationState = {};

function ColorField({
  id,
  name,
  label,
  value,
  fallback,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value || fallback}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input
          id={id}
          name={name}
          value={value}
          placeholder={fallback}
          maxLength={7}
          pattern="#([0-9A-Fa-f]{6})"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function WorkspaceBrandingForm({
  branding,
}: {
  branding: ResolvedOrganizationBranding;
}) {
  const [state, formAction, pending] = useActionState(
    updateWorkspaceBrandingAction,
    initialState,
  );
  const [removeState, removeFormAction, removing] = useActionState(
    removeWorkspaceBrandingLogoAction,
    initialState,
  );
  const [displayName, setDisplayName] = useState(branding.storedDisplayName ?? "");
  const [publicDescription, setPublicDescription] = useState(branding.publicDescription ?? "");
  const [primaryColor, setPrimaryColor] = useState(branding.storedPrimaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(
    branding.storedSecondaryColor ?? "",
  );
  const [accentColor, setAccentColor] = useState(branding.storedAccentColor ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logoUrl);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="workspace-display-name">Display name</Label>
          <Input
            id="workspace-display-name"
            name="displayName"
            value={displayName}
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <p className="text-xs text-onwarda-muted">
            Guests and staff will see this name. Leave blank to use the organization name.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-public-description">Public description</Label>
          <textarea
            id="workspace-public-description"
            name="publicDescription"
            value={publicDescription}
            maxLength={500}
            rows={3}
            onChange={(event) => setPublicDescription(event.target.value)}
            className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-onwarda-muted">
            Short introduction on the public operator page. Leave blank to hide it.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-logo">Logo</Label>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt={displayName || "Organization logo"}
              className="mb-2 size-16 rounded-md border object-contain"
            />
          ) : (
            <p className="text-sm text-onwarda-muted">No logo uploaded yet.</p>
          )}
          <Input
            id="workspace-logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLogoPreview(file ? URL.createObjectURL(file) : branding.logoUrl);
            }}
          />
          <p className="text-xs text-onwarda-muted">
            PNG, JPEG, or WebP. 2 MB maximum. SVG is not accepted.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            id="workspace-primary-color"
            name="primaryColor"
            label="Primary color"
            value={primaryColor}
            fallback={DEFAULT_BRAND_COLORS.primary}
            onChange={setPrimaryColor}
          />
          <ColorField
            id="workspace-secondary-color"
            name="secondaryColor"
            label="Secondary color"
            value={secondaryColor}
            fallback={DEFAULT_BRAND_COLORS.secondary}
            onChange={setSecondaryColor}
          />
          <ColorField
            id="workspace-accent-color"
            name="accentColor"
            label="Accent color"
            value={accentColor}
            fallback={DEFAULT_BRAND_COLORS.accent}
            onChange={setAccentColor}
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save branding"}
        </Button>
      </form>

      {branding.logoPath ? (
        <form action={removeFormAction}>
          {removeState.error ? (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {removeState.error}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={removing}>
            {removing ? "Removing..." : "Remove logo"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
