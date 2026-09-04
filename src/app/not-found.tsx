import Link from "next/link";

import { StatusPanel } from "@/components/shared/status-panel";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl items-center px-6">
      <StatusPanel
        title="Page not found"
        description="The requested route does not exist."
      >
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </StatusPanel>
    </main>
  );
}
