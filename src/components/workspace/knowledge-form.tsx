"use client";

import { useI18n } from "@/i18n/provider";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceKnowledgeAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";
import { PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS } from "@/lib/property-cms/catalog";
import { PROPERTY_KNOWLEDGE_CATEGORIES } from "@/types/enums";

const initialState: WorkspaceMutationState = {};

type KnowledgeFormProps = {
  properties: Array<{ id: string; name: string }>;
};

export function CreateKnowledgeForm({ properties }: KnowledgeFormProps) {
  const { messages } = useI18n();
  const [state, formAction, pending] = useActionState(
    createWorkspaceKnowledgeAction,
    initialState,
  );

  if (properties.length === 0) {
    return (
      <p className="text-sm text-onwarda-muted">
        {messages.screens.addPropertyFirst}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="propertyId">{messages.copy.property}</Label>
          <select
            id="propertyId"
            name="propertyId"
            required
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">{messages.fields.category}</Label>
          <select
            id="category"
            name="category"
            required
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {Object.values(PROPERTY_KNOWLEDGE_CATEGORIES).map((category) => (
              <option key={category} value={category}>
                {PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="visibility">{messages.fields.visibility}</Label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="guest"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="public">Public</option>
            <option value="guest">Guest only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">{messages.fields.title}</Label>
        <Input id="title" name="title" required maxLength={160} placeholder="Wi-Fi details" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">{messages.fields.details}</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={5}
          maxLength={8000}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
          placeholder="Network name, password, and any guest notes."
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? messages.actions.saving : messages.screens.addKnowledge}
      </Button>
    </form>
  );
}
