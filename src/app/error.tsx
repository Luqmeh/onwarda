"use client";

import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/shared/status-panel";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl items-center px-6">
      <StatusPanel
        title="Something went wrong"
        description="An unexpected error occurred. The original details were not exposed."
      >
        <Button onClick={reset}>Try again</Button>
      </StatusPanel>
    </main>
  );
}
