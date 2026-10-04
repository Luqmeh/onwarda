import { GuestIssueForm } from "@/components/guest/guest-forms";
import { GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import { loadGuestStay } from "@/lib/guest-portal/load";
import { humanizeToken } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Help",
};

export default async function GuestSupportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  const contact = stay.content.content.contact_information;

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Host"
        title="Help"
        description="Contact your host or report something that needs attention."
      />
      {contact ? (
        <section className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 shadow-onwarda">
          <h2 className="font-medium">Contact</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-onwarda-muted">{contact}</p>
        </section>
      ) : null}
      <section className="mt-6">
        <h2 className="font-medium">Report an issue</h2>
        <p className="mt-1 text-sm text-onwarda-muted">
          The request is attached to this stay. You do not choose a reservation or property.
        </p>
        <div className="mt-4">
          <GuestIssueForm token={stay.token} />
        </div>
      </section>
      {stay.issues.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-medium">Your requests</h2>
          <ul className="mt-3 divide-y rounded-[var(--onwarda-radius)] bg-onwarda-white">
            {stay.issues.map((issue, index) => (
              <li key={`${issue.category}-${issue.createdAt}-${index}`} className="px-4 py-3">
                <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                <p className="text-sm text-onwarda-muted">{issue.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </GuestShell>
  );
}
