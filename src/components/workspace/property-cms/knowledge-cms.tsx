"use client";

import { useActionState, useMemo, useState } from "react";

import { useI18n } from "@/i18n/provider";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cmsFieldClass, cmsTextareaClass } from "@/components/workspace/property-cms/section";
import { VisibilityBadge } from "@/components/workspace/property-cms/section";
import { PROPERTY_KNOWLEDGE_CMS_CATEGORIES } from "@/lib/property-cms/catalog";
import type { MessageCatalog } from "@/i18n/catalog";
import {
  createPropertyKnowledgeAction,
  deletePropertyKnowledgeAction,
  updatePropertyKnowledgeAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/property-cms-actions";

const initialState: WorkspaceMutationState = {};

function knowledgeCategoryLabel(category: string, catalog: MessageCatalog["catalog"], fields: MessageCatalog["fields"]) {
  const labels: Record<string, string> = {
    house_rules: catalog.houseRules,
    check_in: fields.checkIn,
    check_out: fields.checkOut,
    wifi: catalog.wifi,
    access: catalog.doorAccess,
    faq: catalog.faq,
    tutorial: catalog.tutorial,
    ac: catalog.air_conditioning,
    tv: catalog.tv,
    stove: catalog.stove,
    washer: catalog.washer,
    hot_water: catalog.hotWater,
    coffee_machine: catalog.coffeeMachine,
    garbage: catalog.garbage,
    pool: catalog.pool,
    door_access: catalog.doorAccess,
    other: catalog.other,
  };
  return labels[category] ?? category;
}

type KnowledgeEntry = {
  id: string;
  title: string | null;
  category: string;
  status: string;
  locale: string;
  body: string;
  visibility: "public" | "guest" | "private";
  sortOrder: number;
};

function KnowledgeFields({
  entry,
}: {
  entry?: KnowledgeEntry;
}) {
  const { messages } = useI18n();
  const categoryLabel = (category: string) =>
    knowledgeCategoryLabel(category, messages.catalog, messages.fields);

  return (
    <div className="space-y-3">
      {entry ? <input type="hidden" name="knowledgeId" value={entry.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={entry ? `title-${entry.id}` : "title"}>{messages.fields.title}</Label>
          <Input
            id={entry ? `title-${entry.id}` : "title"}
            name="title"
            required
            maxLength={160}
            defaultValue={entry?.title ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `category-${entry.id}` : "category"}>{messages.fields.category}</Label>
          <select
            id={entry ? `category-${entry.id}` : "category"}
            name="category"
            required
            defaultValue={entry?.category ?? "wifi"}
            className={cmsFieldClass}
          >
            {Object.values(PROPERTY_KNOWLEDGE_CMS_CATEGORIES).map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `visibility-${entry.id}` : "visibility"}>{messages.fields.visibility}</Label>
          <select
            id={entry ? `visibility-${entry.id}` : "visibility"}
            name="visibility"
            defaultValue={entry?.visibility ?? "guest"}
            className={cmsFieldClass}
          >
            <option value="public">{messages.screens.public}</option>
            <option value="guest">{messages.screens.guestOnly}</option>
            <option value="private">{messages.screens.private}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `status-${entry.id}` : "status"}>{messages.catalog.publishedState}</Label>
          <select
            id={entry ? `status-${entry.id}` : "status"}
            name="status"
            defaultValue={entry?.status === "archived" ? "draft" : (entry?.status ?? "published")}
            className={cmsFieldClass}
          >
            <option value="draft">{messages.status.draft}</option>
            <option value="published">{messages.status.published}</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={entry ? `body-${entry.id}` : "body"}>{messages.fields.details}</Label>
        <textarea
          id={entry ? `body-${entry.id}` : "body"}
          name="body"
          required
          rows={4}
          maxLength={8000}
          defaultValue={entry?.body ?? ""}
          className={cmsTextareaClass}
        />
      </div>
    </div>
  );
}

export function PropertyKnowledgeCms({
  propertyId,
  entries,
  canEdit,
}: {
  propertyId: string;
  entries: KnowledgeEntry[];
  canEdit: boolean;
}) {
  const { messages } = useI18n();
  const createAction = useMemo(
    () => createPropertyKnowledgeAction.bind(null, propertyId),
    [propertyId],
  );
  const [createState, createFormAction, createPending] = useActionState(
    createAction,
    initialState,
  );

  return (
    <div className="space-y-6">
      {entries.length === 0 ? (
        <p className="text-sm text-onwarda-muted">{messages.catalog.noInstructions}</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <KnowledgeRow key={entry.id} propertyId={propertyId} entry={entry} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit ? (
        <form action={createFormAction} className="space-y-4 rounded-xl bg-onwarda-cream/70 p-4">
          <p className="font-medium">{messages.actions.addInstruction}</p>
          <KnowledgeFields />
          {createState.error ? (
            <p className="text-sm text-destructive" role="alert">
              {createState.error}
            </p>
          ) : null}
          <Button type="submit" disabled={createPending}>
            {createPending ? messages.actions.saving : messages.actions.addInstruction}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function KnowledgeRow({
  propertyId,
  entry,
  canEdit,
}: {
  propertyId: string;
  entry: KnowledgeEntry;
  canEdit: boolean;
}) {
  const { messages } = useI18n();
  const [editing, setEditing] = useState(false);
  const updateAction = useMemo(
    () => updatePropertyKnowledgeAction.bind(null, propertyId),
    [propertyId],
  );
  const deleteAction = useMemo(
    () => deletePropertyKnowledgeAction.bind(null, propertyId),
    [propertyId],
  );
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    initialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialState,
  );

  if (editing && canEdit) {
    return (
      <li className="rounded-xl border p-4">
        <form action={updateFormAction} className="space-y-4">
          <KnowledgeFields entry={entry} />
          {updateState.error ? (
            <p className="text-sm text-destructive" role="alert">
              {updateState.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updatePending}>
              {updatePending ? messages.actions.saving : messages.fields.save}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              {messages.fields.cancel}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">
            {entry.title || knowledgeCategoryLabel(entry.category, messages.catalog, messages.fields)}
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-onwarda-muted">{entry.body}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <VisibilityBadge visibility={entry.visibility} />
            <span className="text-xs text-onwarda-muted">
              {entry.status === "published"
                ? messages.status.published
                : entry.status === "draft"
                  ? messages.status.draft
                  : entry.status}
            </span>
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              {messages.actions.edit}
            </Button>
            <form action={deleteFormAction}>
              <input type="hidden" name="knowledgeId" value={entry.id} />
              <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
                {deletePending ? messages.actions.saving : messages.catalog.remove}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
      {deleteState.error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {deleteState.error}
        </p>
      ) : null}
    </li>
  );
}
