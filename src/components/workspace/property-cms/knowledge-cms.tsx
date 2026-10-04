"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cmsFieldClass, cmsTextareaClass } from "@/components/workspace/property-cms/section";
import { VisibilityBadge } from "@/components/workspace/property-cms/section";
import {
  PROPERTY_KNOWLEDGE_CMS_CATEGORIES,
  PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS,
} from "@/lib/property-cms/catalog";
import {
  createPropertyKnowledgeAction,
  deletePropertyKnowledgeAction,
  updatePropertyKnowledgeAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/property-cms-actions";

const initialState: WorkspaceMutationState = {};

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
  return (
    <div className="space-y-3">
      {entry ? <input type="hidden" name="knowledgeId" value={entry.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={entry ? `title-${entry.id}` : "title"}>Title</Label>
          <Input
            id={entry ? `title-${entry.id}` : "title"}
            name="title"
            required
            maxLength={160}
            defaultValue={entry?.title ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `category-${entry.id}` : "category"}>Category</Label>
          <select
            id={entry ? `category-${entry.id}` : "category"}
            name="category"
            required
            defaultValue={entry?.category ?? "wifi"}
            className={cmsFieldClass}
          >
            {Object.values(PROPERTY_KNOWLEDGE_CMS_CATEGORIES).map((category) => (
              <option key={category} value={category}>
                {PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `visibility-${entry.id}` : "visibility"}>Visibility</Label>
          <select
            id={entry ? `visibility-${entry.id}` : "visibility"}
            name="visibility"
            defaultValue={entry?.visibility ?? "guest"}
            className={cmsFieldClass}
          >
            <option value="public">Public</option>
            <option value="guest">Guest only</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `status-${entry.id}` : "status"}>Published state</Label>
          <select
            id={entry ? `status-${entry.id}` : "status"}
            name="status"
            defaultValue={entry?.status === "archived" ? "draft" : (entry?.status ?? "published")}
            className={cmsFieldClass}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={entry ? `body-${entry.id}` : "body"}>Details</Label>
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
        <p className="text-sm text-onwarda-muted">No instructions yet for this property.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <KnowledgeRow key={entry.id} propertyId={propertyId} entry={entry} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit ? (
        <form action={createFormAction} className="space-y-4 rounded-xl bg-onwarda-cream/70 p-4">
          <p className="font-medium">Add instruction</p>
          <KnowledgeFields />
          {createState.error ? (
            <p className="text-sm text-destructive" role="alert">
              {createState.error}
            </p>
          ) : null}
          <Button type="submit" disabled={createPending}>
            {createPending ? "Saving..." : "Add instruction"}
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
              {updatePending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
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
            {entry.title || PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS[
              entry.category as keyof typeof PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS
            ] || entry.category}
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-onwarda-muted">{entry.body}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <VisibilityBadge visibility={entry.visibility} />
            <span className="text-xs capitalize text-onwarda-muted">
              {entry.status} · {entry.category.replaceAll("_", " ")}
            </span>
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <form action={deleteFormAction}>
              <input type="hidden" name="knowledgeId" value={entry.id} />
              <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
                Remove
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
