import { GuestEmptyState, GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS, type PropertyKnowledgeCmsCategory } from "@/lib/property-cms/catalog";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { loadGuestStay } from "@/lib/guest-portal/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guides",
};

export default async function GuestGuidesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  await recordGuestExperienceEvent(stay.tokenHash, "guest_knowledge_viewed");

  const guides = [...stay.content.knowledge].sort((a, b) => a.sortOrder - b.sortOrder);
  const videos = stay.media.filter((item) => item.mediaType === "instructional_video" && item.externalUrl);

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="How-to"
        title="Guides"
        description="Optional notes and videos your host has prepared."
      />
      {guides.length === 0 && videos.length === 0 ? (
        <GuestEmptyState
          title="Guides"
          body="Guides have not been provided for this stay. This information is optional."
        />
      ) : (
        <div className="space-y-4">
          {guides.map((entry) => (
            <article key={entry.id} className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 shadow-onwarda">
              <p className="onwarda-kicker">
                {PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS[entry.category as PropertyKnowledgeCmsCategory] ??
                  entry.category}
              </p>
              <h2 className="mt-2 font-medium">{entry.title || "Guide"}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-onwarda-muted">
                {entry.body}
              </p>
            </article>
          ))}
        </div>
      )}
      {videos.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="font-medium">Videos</h2>
          {videos.map((item) => (
            <a
              key={item.id}
              href={item.externalUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block min-h-11 rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 py-3 text-sm underline-offset-4 hover:underline"
            >
              {item.caption || "Watch instructional video"}
            </a>
          ))}
        </section>
      ) : null}
    </GuestShell>
  );
}
