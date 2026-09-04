"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeAdminOrganizationLogoAction,
  updateAdminOrganizationBrandingAction,
  type AdminBrandingMutationState,
} from "@/lib/admin/branding";
import { DEFAULT_BRAND_COLORS } from "@/lib/branding/colors";
import type { ResolvedOrganizationBranding } from "@/lib/branding/resolve";

const initialState: AdminBrandingMutationState = {};

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

export function OrganizationBrandingForm({
  organizationId,
  branding,
}: {
  organizationId: string;
  branding: ResolvedOrganizationBranding;
}) {
  const updateAction = useMemo(
    () => updateAdminOrganizationBrandingAction.bind(null, organizationId),
    [organizationId],
  );
  const removeAction = useMemo(
    () => removeAdminOrganizationLogoAction.bind(null, organizationId),
    [organizationId],
  );
  const [state, formAction, pending] = useActionState(updateAction, initialState);
  const [removeState, removeFormAction, removing] = useActionState(
    removeAction,
    initialState,
  );
  const [displayName, setDisplayName] = useState(branding.storedDisplayName ?? "");
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
          <Label htmlFor="admin-display-name">Display name</Label>
          <Input
            id="admin-display-name"
            name="displayName"
            value={displayName}
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Shown in the client workspace. Leave blank to use the organization name.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-logo">Logo</Label>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt={displayName || "Organization logo"}
              className="mb-2 size-16 rounded-md border object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No logo uploaded.</p>
          )}
          <Input
            id="admin-logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLogoPreview(file ? URL.createObjectURL(file) : branding.logoUrl);
            }}
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, or WebP. 2 MB maximum. SVG is not accepted.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            id="admin-primary-color"
            name="primaryColor"
            label="Primary color"
            value={primaryColor}
            fallback={DEFAULT_BRAND_COLORS.primary}
            onChange={setPrimaryColor}
          />
          <ColorField
            id="admin-secondary-color"
            name="secondaryColor"
            label="Secondary color"
            value={secondaryColor}
            fallback={DEFAULT_BRAND_COLORS.secondary}
            onChange={setSecondaryColor}
          />
          <ColorField
            id="admin-accent-color"
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
