"use client";

import { useI18n } from "@/i18n/provider";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cmsFieldClass } from "@/components/workspace/property-cms/section";
import { VisibilityBadge } from "@/components/workspace/property-cms/section";
import {
  deletePropertyMediaAction,
  updatePropertyExternalMediaAction,
  updatePropertyImageMetaAction,
  uploadPropertyImageAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/property-cms-actions";

const initialState: WorkspaceMutationState = {};

type MediaItem = {
  id: string;
  mediaType: string;
  role: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  sortOrder: number;
  caption: string | null;
  altText: string | null;
  visibility: "public" | "guest" | "private";
  signedUrl: string | null;
};

export function PropertyMediaCms({
  propertyId,
  media,
  canEdit,
}: {
  propertyId: string;
  media: MediaItem[];
  canEdit: boolean;
}) {
  const { messages } = useI18n();
  const images = media.filter((item) => item.mediaType === "image");
  const video = media.find((item) => item.mediaType === "video");
  const tour = media.find((item) => item.mediaType === "tour_360");
  const instructional = media.find((item) => item.mediaType === "instructional_video");

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-onwarda-muted">{messages.catalog.imagePreview}</p>
        {images.length === 0 ? (
          <p className="text-sm text-onwarda-muted">{messages.catalog.noImages}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {images.map((image) => (
              <li key={image.id} className="overflow-hidden rounded-xl border">
                {image.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.signedUrl}
                    alt={image.altText || image.caption || messages.catalog.propertyImage}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-onwarda-cream text-sm text-onwarda-muted">
                    Image unavailable
                  </div>
                )}
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {image.role === "hero" ? messages.catalog.hero : messages.catalog.gallery}
                    </p>
                    <VisibilityBadge visibility={image.visibility} />
                  </div>
                  {image.caption ? (
                    <p className="text-sm text-onwarda-muted">{image.caption}</p>
                  ) : null}
                  {canEdit ? <ImageMetaForm propertyId={propertyId} image={image} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canEdit ? <UploadImageForm propertyId={propertyId} /> : null}
      </div>

      {canEdit ? (
        <ExternalMediaForm
          propertyId={propertyId}
          videoUrl={video?.externalUrl ?? ""}
          tourUrl={tour?.externalUrl ?? ""}
          instructionalUrl={instructional?.externalUrl ?? ""}
        />
      ) : (
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-onwarda-muted">{messages.catalog.propertyVideo}</dt>
            <dd className="mt-1 break-all">{video?.externalUrl ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.catalog.tour}</dt>
            <dd className="mt-1 break-all">{tour?.externalUrl ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.catalog.instructionalVideo}</dt>
            <dd className="mt-1 break-all">{instructional?.externalUrl ?? "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function UploadImageForm({ propertyId }: { propertyId: string }) {
  const { messages } = useI18n();
  const action = useMemo(
    () => uploadPropertyImageAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl bg-onwarda-cream/70 p-4">
      <p className="font-medium">{messages.actions.uploadImage}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="image">{messages.catalog.imageHint}</Label>
          <Input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">{messages.fields.placement}</Label>
          <select id="role" name="role" defaultValue="gallery" className={cmsFieldClass}>
            <option value="hero">{messages.catalog.hero}</option>
            <option value="gallery">{messages.catalog.gallery}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="visibility">{messages.fields.visibility}</Label>
          <select id="visibility" name="visibility" defaultValue="public" className={cmsFieldClass}>
            <option value="public">{messages.screens.public}</option>
            <option value="guest">{messages.screens.guestOnly}</option>
            <option value="private">{messages.screens.private}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="caption">{messages.fields.caption}</Label>
          <Input id="caption" name="caption" maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="altText">{messages.fields.altText}</Label>
          <Input id="altText" name="altText" maxLength={200} />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? messages.actions.uploading : messages.actions.uploadImage}
      </Button>
    </form>
  );
}

function ImageMetaForm({
  propertyId,
  image,
}: {
  propertyId: string;
  image: MediaItem;
}) {
  const { messages } = useI18n();
  const updateAction = useMemo(
    () => updatePropertyImageMetaAction.bind(null, propertyId),
    [propertyId],
  );
  const deleteAction = useMemo(
    () => deletePropertyMediaAction.bind(null, propertyId),
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

  return (
    <div className="space-y-3">
      <form action={updateFormAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="mediaId" value={image.id} />
        <input type="hidden" name="sortOrder" value={image.sortOrder} />
        <select name="role" defaultValue={image.role ?? "gallery"} className={cmsFieldClass}>
          <option value="hero">{messages.catalog.hero}</option>
          <option value="gallery">{messages.catalog.gallery}</option>
        </select>
        <select name="visibility" defaultValue={image.visibility} className={cmsFieldClass}>
          <option value="public">{messages.screens.public}</option>
          <option value="guest">{messages.screens.guestOnly}</option>
          <option value="private">{messages.screens.private}</option>
        </select>
        <Input name="caption" maxLength={200} defaultValue={image.caption ?? ""} placeholder={messages.fields.caption} />
        <Input name="altText" maxLength={200} defaultValue={image.altText ?? ""} placeholder={messages.fields.altText} />
        {updateState.error ? (
          <p className="text-sm text-destructive sm:col-span-2" role="alert">
            {updateState.error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" size="sm" disabled={updatePending}>
          {updatePending ? messages.actions.saving : messages.actions.saveImage}
        </Button>
      </form>
      <form action={deleteFormAction}>
        <input type="hidden" name="mediaId" value={image.id} />
        <Button type="submit" variant="destructive" size="sm" disabled={deletePending}>
          {deletePending ? messages.actions.saving : messages.catalog.remove}
        </Button>
        {deleteState.error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {deleteState.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function ExternalMediaForm({
  propertyId,
  videoUrl,
  tourUrl,
  instructionalUrl,
}: {
  propertyId: string;
  videoUrl: string;
  tourUrl: string;
  instructionalUrl: string;
}) {
  const { messages } = useI18n();
  const action = useMemo(
    () => updatePropertyExternalMediaAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl bg-onwarda-cream/70 p-4">
      <p className="font-medium">{messages.catalog.externalMedia}</p>
      <p className="text-sm text-onwarda-muted">{messages.catalog.externalMediaHelp}</p>
      <div className="space-y-2">
        <Label htmlFor="videoUrl">{messages.catalog.propertyVideo}</Label>
        <Input id="videoUrl" name="videoUrl" type="url" defaultValue={videoUrl} placeholder="https://" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tourUrl">{messages.catalog.tour}</Label>
        <Input id="tourUrl" name="tourUrl" type="url" defaultValue={tourUrl} placeholder="https://" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="instructionalUrl">{messages.catalog.instructionalVideo}</Label>
        <Input
          id="instructionalUrl"
          name="instructionalUrl"
          type="url"
          defaultValue={instructionalUrl}
          placeholder="https://"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? messages.actions.saving : messages.actions.saveExternal}
      </Button>
    </form>
  );
}
