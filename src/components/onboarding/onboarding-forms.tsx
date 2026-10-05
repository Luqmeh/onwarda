"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROPERTY_AMENITY_LABELS, PROPERTY_AMENITIES, PROPERTY_TYPE_LABELS } from "@/lib/property-cms/catalog";
import {
  continueOnboardingAction,
  saveOnboardingBrandingAction,
  saveOnboardingBusinessAction,
  saveOnboardingCleanerAction,
  saveOnboardingGuideAction,
  setOnboardingPasswordAction,
  saveOnboardingPropertyAction,
  saveOnboardingPropertyDetailsAction,
  saveOnboardingReservationAction,
  type OnboardingFormState,
} from "@/lib/onboarding/actions";
import type { OnboardingSnapshot } from "@/lib/onboarding/load";
import type { OnboardingStepId } from "@/lib/onboarding/steps";

const initial: OnboardingFormState = {};

function ErrorText({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  );
}

export function PasswordStep({ email, organizationName }: { email: string; organizationName: string }) {
  const [state, action, pending] = useActionState(setOnboardingPasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly />
      </div>
      <p className="text-sm text-onwarda-muted">
        This sign-in belongs to {organizationName}. Choose a password you will use from now on.
      </p>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <ErrorText error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create password"}
      </Button>
    </form>
  );
}

export function BusinessStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const [state, action, pending] = useActionState(saveOnboardingBusinessAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" required maxLength={120} defaultValue={snapshot.organizationName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" maxLength={40} defaultValue={snapshot.phone} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" maxLength={80} defaultValue={snapshot.country} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="defaultLanguage">Language you work in</Label>
        <select id="defaultLanguage" name="defaultLanguage" defaultValue={snapshot.defaultLanguage} className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm">
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </div>
      <ErrorText error={state.error} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Continue"}</Button>
    </form>
  );
}

export function BrandingStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const [state, action, pending] = useActionState(saveOnboardingBrandingAction, initial);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="displayName">Name guests see</Label>
          <Input id="displayName" name="displayName" maxLength={120} defaultValue={snapshot.branding.displayName} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="publicDescription">A short welcome</Label>
          <Input id="publicDescription" name="publicDescription" maxLength={500} defaultValue={snapshot.branding.publicDescription} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["primaryColor", "Primary", snapshot.branding.primaryColor],
            ["secondaryColor", "Secondary", snapshot.branding.secondaryColor],
            ["accentColor", "Accent", snapshot.branding.accentColor],
          ] as const).map(([name, label, value]) => (
            <label key={name} className="space-y-1 text-sm">
              <span className="text-onwarda-muted">{label}</span>
              <Input name={name} defaultValue={value} maxLength={7} />
            </label>
          ))}
        </div>
        <ErrorText error={state.error} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save brand"}</Button>
      </form>
      <SkipButton step="branding" label="Do this later" />
      </div>
      <aside
        className="rounded-[var(--onwarda-radius-lg)] p-6 text-white"
        style={{ background: snapshot.branding.primaryColor }}
      >
        <p className="text-xs tracking-[0.16em] uppercase opacity-80">Preview</p>
        <p className="mt-4 text-2xl font-medium">{snapshot.branding.displayName || snapshot.organizationName}</p>
        <p className="mt-2 text-sm opacity-90">{snapshot.branding.publicDescription || "Your guest welcome will live here."}</p>
        <span className="mt-6 inline-flex rounded-full px-3 py-1 text-xs" style={{ background: snapshot.branding.accentColor }}>
          Arrival
        </span>
      </aside>
    </div>
  );
}

export function PropertyStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const [createState, createAction, creating] = useActionState(saveOnboardingPropertyAction, initial);
  const [detailState, detailAction, saving] = useActionState(saveOnboardingPropertyDetailsAction, initial);
  const property = snapshot.properties[0];

  return (
    <div className="space-y-8">
      <form action={createAction} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="propertyName">Property name</Label>
          <Input id="propertyName" name="name" required maxLength={120} placeholder="Riad Atlas" />
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-onwarda-muted">Type</span>
          <select name="propertyType" className="h-10 w-full rounded-lg border bg-transparent px-3">
            <option value="">Choose</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" maxLength={80} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="propertyCountry">Country</Label>
          <Input id="propertyCountry" name="country" maxLength={80} />
        </div>
        <div className="sm:col-span-2">
          <ErrorText error={createState.error} />
          <Button type="submit" disabled={creating}>{creating ? "Adding…" : snapshot.properties.length ? "Add another property" : "Add your first property"}</Button>
        </div>
      </form>
      {snapshot.properties.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {snapshot.properties.map((item) => (
            <li key={item.id}>{item.name}{item.city ? ` · ${item.city}` : ""}</li>
          ))}
        </ul>
      ) : null}
      {property ? (
        <form action={detailAction} className="space-y-4 border-t pt-6">
          <input type="hidden" name="propertyId" value={property.id} />
          <p className="text-sm text-onwarda-muted">Details for {property.name}. You can refine every field later in the property workspace.</p>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Amenities</legend>
            {Object.values(PROPERTY_AMENITIES).map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="amenities" value={amenity} />
                {PROPERTY_AMENITY_LABELS[amenity]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              Quiet hours
              <select name="quietHours" className="h-10 w-full rounded-lg border bg-transparent px-2">
                <option value="unspecified">Not set</option>
                <option value="limited">Limited</option>
                <option value="not_allowed">Not allowed</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Smoking
              <select name="smoking" className="h-10 w-full rounded-lg border bg-transparent px-2">
                <option value="unspecified">Not set</option>
                <option value="not_allowed">Not allowed</option>
                <option value="allowed">Allowed</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Pets
              <select name="pets" className="h-10 w-full rounded-lg border bg-transparent px-2">
                <option value="unspecified">Not set</option>
                <option value="not_allowed">Not allowed</option>
                <option value="allowed">Allowed</option>
              </select>
            </label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="arrival">Arrival notes</Label>
            <textarea id="arrival" name="arrival" maxLength={4000} className="min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" placeholder="How guests find the door, and what to do if they are early." />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wifi">Wi-Fi</Label>
            <textarea id="wifi" name="wifi" maxLength={2000} className="min-h-20 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" placeholder="Network name and where the password is kept." />
          </div>
          <ErrorText error={detailState.error} />
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save and continue"}</Button>
        </form>
      ) : null}
    </div>
  );
}

export function GuidesStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const [state, action, pending] = useActionState(saveOnboardingGuideAction, initial);
  const property = snapshot.properties[0];

  if (!property) {
    return <p className="text-sm text-onwarda-muted">Add a property first, then you can write guides for it.</p>;
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="propertyId" value={property.id} />
        <div className="space-y-1">
          <Label htmlFor="title">Guide title</Label>
          <Input id="title" name="title" required maxLength={140} placeholder="How to use the washing machine" />
        </div>
        <label className="block space-y-1 text-sm">
          Category
          <select name="category" className="h-10 w-full rounded-lg border bg-transparent px-3">
            <option value="tutorial">Tutorial</option>
            <option value="washer">Washer</option>
            <option value="tv">TV</option>
            <option value="ac">Heating and AC</option>
            <option value="check_in">Check-in</option>
            <option value="faq">Local notes</option>
          </select>
        </label>
        <div className="space-y-1">
          <Label htmlFor="body">What the guest should do</Label>
          <textarea id="body" name="body" required maxLength={8000} className="min-h-28 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" />
        </div>
        <ErrorText error={state.error} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add guide"}</Button>
      </form>
      <SkipButton step="guides" label="Continue" />
      {snapshot.guides.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {snapshot.guides.map((guide) => (
            <li key={guide.id}>{guide.title} · {guide.propertyName}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function OperationsStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const [cleanerState, cleanerAction, savingCleaner] = useActionState(saveOnboardingCleanerAction, initial);
  const [stayState, stayAction, savingStay] = useActionState(saveOnboardingReservationAction, initial);
  const property = snapshot.properties[0];

  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-onwarda-muted">
        A property can have several default cleaners. A cleaning task still has one person assigned to that visit. Nothing here assigns a cleaner until you choose a name.
      </p>
      <form action={cleanerAction} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="displayName">Cleaner name</Label>
          <Input id="displayName" name="displayName" maxLength={80} placeholder="Fatima" />
        </div>
        {property ? <input type="hidden" name="propertyId" value={property.id} /> : null}
        <ErrorText error={cleanerState.error} />
        <Button type="submit" variant="outline" disabled={savingCleaner}>Add as a default cleaner</Button>
        {snapshot.cleaners.length > 0 ? <p className="text-sm">{snapshot.cleaners.join(", ")}</p> : null}
      </form>
      {property ? (
        <form action={stayAction} className="space-y-3 border-t pt-6">
          <p className="text-sm font-medium">Optional first stay</p>
          <input type="hidden" name="propertyId" value={property.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" placeholder="Guest first name" maxLength={80} />
            <Input name="lastName" placeholder="Guest last name" maxLength={80} />
            <Input name="checkIn" type="date" required />
            <Input name="checkOut" type="date" required />
          </div>
          <ErrorText error={stayState.error} />
          <Button type="submit" disabled={savingStay}>{savingStay ? "Saving…" : "Save stay and review"}</Button>
        </form>
      ) : null}
      <SkipButton step="operations" label="Skip to review" />
      <p className="text-sm text-onwarda-muted">
        Guests will see arrival, Wi-Fi, house rules, guides, support, and checkout from the information you enter. Team invitations stay with your Onwarda host for now.
      </p>
    </div>
  );
}

function SkipButton({ step, label }: { step: OnboardingStepId; label: string }) {
  return (
    <form action={continueOnboardingAction.bind(null, step)}>
      <Button type="submit" variant="outline">{label}</Button>
    </form>
  );
}
