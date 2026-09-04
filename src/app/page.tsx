import Link from "next/link";

import { StatusPanel } from "@/components/shared/status-panel";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {APP_NAME}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Hospitality operations, three security contexts.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          This milestone establishes the platform foundation. Application
          features will be built on isolated admin, client, and guest
          boundaries.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusPanel
          title="Internal Admin"
          description="Platform operators manage client organizations from /admin."
        >
          <Button asChild variant="outline">
            <Link href="/admin/login">Open admin</Link>
          </Button>
        </StatusPanel>
        <StatusPanel
          title="Client Workspace"
          description="Each organization is an isolated tenant at /app."
        >
          <Button asChild variant="outline">
            <Link href="/login">Open workspace</Link>
          </Button>
        </StatusPanel>
        <StatusPanel
          title="Guest Portal"
          description="Guests use opaque reservation tokens at /g/[token]."
        >
          <p className="text-sm text-muted-foreground">
            Token lookup is not implemented in this milestone.
          </p>
        </StatusPanel>
      </div>
    </main>
  );
}
