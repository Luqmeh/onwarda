"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_ROUTES } from "@/config/admin";
import { DEFAULT_BRAND_COLORS } from "@/lib/branding/colors";
import {
  provisionOrganizationAction,
  type AdminMutationState,
} from "@/lib/admin/provision";
import { suggestOrganizationSlug } from "@/lib/validation/organization";

const initialState: AdminMutationState = {};

export function CreateClientForm() {
  const [state, formAction, pending] = useActionState(
    provisionOrganizationAction,
    initialState,
  );
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [status, setStatus] = useState("active");
  const [displayName, setDisplayName] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const suggestedSlug = useMemo(() => suggestOrganizationSlug(name), [name]);
  const brandDisplayName = displayNameTouched ? displayName : name;

  return (
    <form action={formAction} className="space-y-8">
      <section className={step === 1 ? "space-y-4" : "hidden"}>
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Step 1
          </p>
          <h2 className="text-lg font-semibold">Client details</h2>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Organization name</Label>
          <Input
            id="name"
            name="name"
            value={name}
            required
            maxLength={120}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!slugTouched) {
                setSlug(suggestOrganizationSlug(nextName));
              }
              if (!displayNameTouched) {
                setDisplayName(nextName);
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            required
            minLength={2}
            maxLength={63}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Used only in the client access URL.{" "}
            {suggestedSlug ? `Suggested: ${suggestedSlug}` : "Lowercase letters, numbers, and hyphens."}
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Initial status</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              ["active", "Active"],
              ["pending", "Pending"],
              ["suspended", "Suspended"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={step === 2 ? "space-y-4" : "hidden"}>
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Step 2
          </p>
          <h2 className="text-lg font-semibold">Owner invitation</h2>
          <p className="text-sm text-muted-foreground">
            Onwarda will invite this person. You do not set their password.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerEmail">Owner email</Label>
          <Input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            autoComplete="off"
            required
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
          />
        </div>
      </section>

      <section className={step === 3 ? "space-y-4" : "hidden"}>
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Step 3
          </p>
          <h2 className="text-lg font-semibold">Brand setup</h2>
          <p className="text-sm text-muted-foreground">
            Optional. The client is created with Onwarda defaults if this step is skipped.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            value={brandDisplayName}
            maxLength={120}
            onChange={(event) => {
              setDisplayNameTouched(true);
              setDisplayName(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo">Logo</Label>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt={brandDisplayName || "Logo preview"}
              className="mb-2 size-16 rounded-md border object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No logo selected.</p>
          )}
          <Input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLogoPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, or WebP. 2 MB maximum. SVG is not accepted.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Primary color picker"
                value={primaryColor || DEFAULT_BRAND_COLORS.primary}
                onChange={(event) => setPrimaryColor(event.target.value.toUpperCase())}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="primaryColor"
                name="primaryColor"
                value={primaryColor}
                placeholder={DEFAULT_BRAND_COLORS.primary}
                maxLength={7}
                onChange={(event) => setPrimaryColor(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Secondary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Secondary color picker"
                value={secondaryColor || DEFAULT_BRAND_COLORS.secondary}
                onChange={(event) => setSecondaryColor(event.target.value.toUpperCase())}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="secondaryColor"
                name="secondaryColor"
                value={secondaryColor}
                placeholder={DEFAULT_BRAND_COLORS.secondary}
                maxLength={7}
                onChange={(event) => setSecondaryColor(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accentColor">Accent color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Accent color picker"
                value={accentColor || DEFAULT_BRAND_COLORS.accent}
                onChange={(event) => setAccentColor(event.target.value.toUpperCase())}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="accentColor"
                name="accentColor"
                value={accentColor}
                placeholder={DEFAULT_BRAND_COLORS.accent}
                maxLength={7}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={step === 4 ? "space-y-3 rounded-xl border p-4" : "hidden"}>
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Step 4
          </p>
          <h2 className="text-lg font-semibold">Review</h2>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Organization</dt>
            <dd className="font-medium">{name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-medium">{slug || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Owner email</dt>
            <dd className="font-medium break-all">{ownerEmail || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Display name</dt>
            <dd className="font-medium">{brandDisplayName || name || "Organization name"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Logo</dt>
            <dd className="font-medium">{logoPreview ? "Selected" : "None"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Primary</dt>
            <dd className="font-medium">{primaryColor || "Onwarda default"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Secondary</dt>
            <dd className="font-medium">{secondaryColor || "Onwarda default"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Accent</dt>
            <dd className="font-medium">{accentColor || "Onwarda default"}</dd>
          </div>
        </dl>
      </section>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>
            Back
          </Button>
        ) : null}
        {step < 4 ? (
          <Button type="button" onClick={() => setStep((current) => current + 1)}>
            Continue
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create & Send Invitation"}
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={ADMIN_ROUTES.clients}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
