"use client";

import { Button } from "@/components/ui/button";
import { ClientPageHeader } from "@/components/workspace/client-ui";

export default function ClientError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <ClientPageHeader
        title="Unable to load this page"
        description="An unexpected error occurred. Database details were not exposed."
      />
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
