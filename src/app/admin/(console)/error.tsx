"use client";

import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/shared/status-panel";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPanel
      title="Unable to load this page"
      description="An unexpected error occurred. Database details were not exposed."
    >
      <Button onClick={reset}>Try again</Button>
    </StatusPanel>
  );
}
