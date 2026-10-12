"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";
import { fillMessage } from "@/i18n/locale";
import { PROPERTY_AMENITIES } from "@/lib/property-cms/catalog";
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
import { PROPERTY_TYPES } from "@/types/enums";

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
  const { messages } = useI18n();
  const [state, action, pending] = useActionState(setOnboardingPasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email">{messages.auth.email}</Label>
        <Input id="email" value={email} readOnly dir="ltr" />
      </div>
      <p className="text-sm text-onwarda-muted">
        {fillMessage(messages.onboarding.passwordBelongs, { name: organizationName })}
      </p>
      <div className="space-y-1">
        <Label htmlFor="password">{messages.auth.password}</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">{messages.auth.confirmPassword}</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <ErrorText error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? messages.actions.saving : messages.onboarding.createPassword}
      </Button>
    </form>
  );
}

export function BusinessStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const { messages } = useI18n();
  const [state, action, pending] = useActionState(saveOnboardingBusinessAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">{messages.onboarding.businessName}</Label>
        <Input id="name" name="name" required maxLength={120} defaultValue={snapshot.organizationName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="phone">{messages.fields.phone}</Label>
          <Input id="phone" name="phone" maxLength={40} defaultValue={snapshot.phone} dir="ltr" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">{messages.fields.country}</Label>
          <Input id="country" name="country" maxLength={80} defaultValue={snapshot.country} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="defaultLanguage">{messages.onboarding.workLanguage}</Label>
        <select id="defaultLanguage" name="defaultLanguage" defaultValue={snapshot.defaultLanguage} className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm">
          <option value="en">{messages.languages.en}</option>
          <option value="fr">{messages.languages.fr}</option>
          <option value="ar">{messages.languages.ar}</option>
        </select>
      </div>
      <ErrorText error={state.error} />
      <Button type="submit" disabled={pending}>{pending ? messages.actions.saving : messages.auth.continue}</Button>
    </form>
  );
}

export function BrandingStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const { messages } = useI18n();
  const [state, action, pending] = useActionState(saveOnboardingBrandingAction, initial);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="displayName">{messages.onboarding.guestFacingName}</Label>
          <Input id="displayName" name="displayName" maxLength={120} defaultValue={snapshot.branding.displayName} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="publicDescription">{messages.onboarding.shortWelcome}</Label>
          <Input id="publicDescription" name="publicDescription" maxLength={500} defaultValue={snapshot.branding.publicDescription} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["primaryColor", messages.onboarding.primary, snapshot.branding.primaryColor],
            ["secondaryColor", messages.onboarding.secondary, snapshot.branding.secondaryColor],
            ["accentColor", messages.onboarding.accent, snapshot.branding.accentColor],
          ] as const).map(([name, label, value]) => (
            <label key={name} className="space-y-1 text-sm">
              <span className="text-onwarda-muted">{label}</span>
              <Input name={name} defaultValue={value} maxLength={7} dir="ltr" />
            </label>
          ))}
        </div>
        <ErrorText error={state.error} />
        <Button type="submit" disabled={pending}>{pending ? messages.actions.saving : messages.onboarding.saveBrand}</Button>
      </form>
      <SkipButton step="branding" label={messages.onboarding.doThisLater} />
      </div>
      <aside
        className="rounded-[var(--onwarda-radius-lg)] p-6 text-white"
        style={{ background: snapshot.branding.primaryColor }}
      >
        <p className="text-xs tracking-[0.16em] uppercase opacity-80">{messages.onboarding.preview}</p>
        <p className="mt-4 text-2xl font-medium">{snapshot.branding.displayName || snapshot.organizationName}</p>
        <p className="mt-2 text-sm opacity-90">{snapshot.branding.publicDescription || messages.onboarding.guestWelcomePreview}</p>
        <span className="mt-6 inline-flex rounded-full px-3 py-1 text-xs" style={{ background: snapshot.branding.accentColor }}>
          {messages.onboarding.arrival}
        </span>
      </aside>
    </div>
  );
}

export function PropertyStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const { messages } = useI18n();
  const [createState, createAction, creating] = useActionState(saveOnboardingPropertyAction, initial);
  const [detailState, detailAction, saving] = useActionState(saveOnboardingPropertyDetailsAction, initial);
  const property = snapshot.properties[0];

  return (
    <div className="space-y-8">
      <form action={createAction} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="propertyName">{messages.fields.propertyName}</Label>
          <Input id="propertyName" name="name" required maxLength={120} />
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-onwarda-muted">{messages.fields.propertyType}</span>
          <select name="propertyType" className="h-10 w-full rounded-lg border bg-transparent px-3">
            <option value="">{messages.onboarding.chooseType}</option>
            {Object.values(PROPERTY_TYPES).map((type) => (
              <option key={type} value={type}>{messages.catalog[type]}</option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <Label htmlFor="city">{messages.fields.city}</Label>
          <Input id="city" name="city" maxLength={80} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="propertyCountry">{messages.fields.country}</Label>
          <Input id="propertyCountry" name="country" maxLength={80} />
        </div>
        <div className="sm:col-span-2">
          <ErrorText error={createState.error} />
          <Button type="submit" disabled={creating}>
            {creating
              ? messages.actions.adding
              : snapshot.properties.length
                ? messages.onboarding.addAnotherProperty
                : messages.onboarding.addFirstProperty}
          </Button>
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
          <p className="text-sm text-onwarda-muted">
            {fillMessage(messages.onboarding.propertyDetailsFor, { name: property.name })}
          </p>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">{messages.screens.amenities}</legend>
            {Object.values(PROPERTY_AMENITIES).map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="amenities" value={amenity} />
                {amenity === "workspace" ? messages.catalog.amenityWorkspace : messages.catalog[amenity]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              {messages.onboarding.quietHours}
              <select name="quietHours" className="h-10 w-full rounded-lg border bg-transparent px-2">
                <option value="unspecified">{messages.catalog.notSet}</option>
                <option value="limited">{messages.catalog.limited}</option>
                <option value="not_allowed">{messages.catalog.not_allowed}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              {messages.catalog.smoking}
              <select name="smoking" className="h-10 w-full rounded-lg border bg-transparent px-2">
                <option value="unspecified">{messages.catalog.notSet}</option>
                <option value="not_allowed">{messages.catalog.not_allowed}</option>
                <option value="allowed">{messages.catalog.allowed}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              {messages.catalog.pets}
              <select name="pets" className="h-10 w-full rounded-lg border bg-transparent px-2">
                <option value="unspecified">{messages.catalog.notSet}</option>
                <option value="not_allowed">{messages.catalog.not_allowed}</option>
                <option value="allowed">{messages.catalog.allowed}</option>
              </select>
            </label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="arrival">{messages.onboarding.arrivalNotes}</Label>
            <textarea id="arrival" name="arrival" maxLength={4000} className="min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" placeholder={messages.onboarding.arrivalPlaceholder} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wifi">{messages.catalog.wifi}</Label>
            <textarea id="wifi" name="wifi" maxLength={2000} className="min-h-20 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" placeholder={messages.onboarding.wifiPlaceholder} />
          </div>
          <ErrorText error={detailState.error} />
          <Button type="submit" disabled={saving}>{saving ? messages.actions.saving : messages.onboarding.saveAndContinue}</Button>
        </form>
      ) : null}
    </div>
  );
}

export function GuidesStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const { messages } = useI18n();
  const [state, action, pending] = useActionState(saveOnboardingGuideAction, initial);
  const property = snapshot.properties[0];

  if (!property) {
    return <p className="text-sm text-onwarda-muted">{messages.onboarding.addPropertyFirst}</p>;
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="propertyId" value={property.id} />
        <div className="space-y-1">
          <Label htmlFor="title">{messages.onboarding.guideTitle}</Label>
          <Input id="title" name="title" required maxLength={140} placeholder={messages.onboarding.guideTitlePlaceholder} />
        </div>
        <label className="block space-y-1 text-sm">
          {messages.fields.category}
          <select name="category" className="h-10 w-full rounded-lg border bg-transparent px-3">
            <option value="tutorial">{messages.catalog.tutorial}</option>
            <option value="washer">{messages.catalog.washer}</option>
            <option value="tv">{messages.catalog.tv}</option>
            <option value="ac">{messages.onboarding.heatingAndAc}</option>
            <option value="check_in">{messages.fields.checkIn}</option>
            <option value="faq">{messages.onboarding.localNotes}</option>
          </select>
        </label>
        <div className="space-y-1">
          <Label htmlFor="body">{messages.onboarding.guestShouldDo}</Label>
          <textarea id="body" name="body" required maxLength={8000} className="min-h-28 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" />
        </div>
        <ErrorText error={state.error} />
        <Button type="submit" disabled={pending}>{pending ? messages.actions.saving : messages.onboarding.addGuide}</Button>
      </form>
      <SkipButton step="guides" label={messages.auth.continue} />
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
  const { messages } = useI18n();
  const [cleanerState, cleanerAction, savingCleaner] = useActionState(saveOnboardingCleanerAction, initial);
  const [stayState, stayAction, savingStay] = useActionState(saveOnboardingReservationAction, initial);
  const property = snapshot.properties[0];

  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-onwarda-muted">
        {messages.onboarding.operationsHelp}
      </p>
      <form action={cleanerAction} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="displayName">{messages.fields.cleanerName}</Label>
          <Input id="displayName" name="displayName" maxLength={80} placeholder={messages.screens.cleaner} />
        </div>
        {property ? <input type="hidden" name="propertyId" value={property.id} /> : null}
        <ErrorText error={cleanerState.error} />
        <Button type="submit" variant="outline" disabled={savingCleaner}>{messages.onboarding.addDefaultCleaner}</Button>
        {snapshot.cleaners.length > 0 ? <p className="text-sm">{snapshot.cleaners.join(", ")}</p> : null}
      </form>
      {property ? (
        <form action={stayAction} className="space-y-3 border-t pt-6">
          <p className="text-sm font-medium">{messages.onboarding.optionalFirstStay}</p>
          <input type="hidden" name="propertyId" value={property.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" placeholder={messages.onboarding.guestFirstName} maxLength={80} />
            <Input name="lastName" placeholder={messages.onboarding.guestLastName} maxLength={80} />
            <Input name="checkIn" type="date" required />
            <Input name="checkOut" type="date" required />
          </div>
          <ErrorText error={stayState.error} />
          <Button type="submit" disabled={savingStay}>{savingStay ? messages.actions.saving : messages.onboarding.saveStayAndReview}</Button>
        </form>
      ) : null}
      <SkipButton step="operations" label={messages.onboarding.skipToReview} />
      <p className="text-sm text-onwarda-muted">
        {messages.onboarding.guestsWillSee}
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
