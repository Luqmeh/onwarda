import { ExitSupportForm } from "@/components/admin/support-session-forms";
import type { SupportWorkspaceContext } from "@/types/auth";

export function ClientSupportModeBanner({
  session,
}: {
  session: SupportWorkspaceContext["supportSession"];
}) {
  const expiresAt = new Date(session.expiresAt);

  return (
    <div
      className="border-b border-onwarda-olive/30 bg-onwarda-olive text-onwarda-white"
      role="status"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase">
            Onwarda support mode
          </p>
          <p className="mt-1 text-sm">
            Viewing {session.organizationName} for troubleshooting. This is not a
            client membership. Session is active until {expiresAt.toLocaleString()}.
          </p>
        </div>
        <ExitSupportForm
          organizationId={session.organizationId}
          sessionId={session.id}
        />
      </div>
    </div>
  );
}
