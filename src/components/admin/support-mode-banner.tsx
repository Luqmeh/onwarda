import Link from "next/link";

import { ExitSupportForm } from "@/components/admin/support-session-forms";
import { adminClientPath } from "@/config/admin";
import type { ActiveSupportSession } from "@/lib/admin/support";

export function SupportModeBanner({ session }: { session: ActiveSupportSession }) {
  return (
    <div
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950"
      role="status"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase">
            Onwarda support mode
          </p>
          <p className="text-sm">
            Privileged session for{" "}
            <Link
              href={adminClientPath(session.organizationId)}
              className="font-medium underline-offset-4 hover:underline"
            >
              {session.organizationName}
            </Link>
            . This is not a client membership.{" "}
            <Link href="/app" className="font-medium underline-offset-4 hover:underline">
              Open client workspace
            </Link>
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
