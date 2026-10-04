import { GuestEmptyState, GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { loadGuestStay } from "@/lib/guest-portal/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wi-Fi",
};

export default async function GuestWifiPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  const wifi = stay.content.knowledge
    .filter((entry) => entry.category === "wifi")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Connection"
        title="Wi-Fi"
        description="Network details your host has shared for this stay."
      />
      {wifi.length === 0 ? (
        <GuestEmptyState
          title="Wi-Fi"
          body="Wi-Fi details have not been provided for this stay. This information is optional."
        />
      ) : (
        <div className="space-y-4">
          {wifi.map((entry) => (
            <article key={entry.id} className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 shadow-onwarda">
              <h2 className="font-medium">{entry.title || "Wi-Fi"}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-onwarda-muted">
                {entry.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </GuestShell>
  );
}
