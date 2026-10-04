"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ClientSectionCard, ClientStatusBadge } from "@/components/workspace/client-ui";
import type { ContentVisibility } from "@/lib/property-cms/catalog";

export const cmsFieldClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export const cmsTextareaClass =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm";

export function VisibilityBadge({ visibility }: { visibility: ContentVisibility }) {
  const tone =
    visibility === "public" ? "olive" : visibility === "guest" ? "sage" : "coral";
  const label =
    visibility === "public" ? "Public" : visibility === "guest" ? "Guest only" : "Private";

  return <ClientStatusBadge label={label} tone={tone} />;
}

export function CmsSection({
  title,
  description,
  canEdit,
  summary,
  children,
}: {
  title: string;
  description?: string;
  canEdit: boolean;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <ClientSectionCard
      title={title}
      description={description}
      action={
        canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        ) : null
      }
    >
      {canEdit && editing ? children : summary}
    </ClientSectionCard>
  );
}
