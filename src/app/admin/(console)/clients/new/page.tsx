import Link from "next/link";

import { CreateClientForm } from "@/components/admin/create-client-form";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTES } from "@/config/admin";

export const metadata = {
  title: "Create client",
};

export default function AdminCreateClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create client</h1>
          <p className="text-sm text-muted-foreground">
            Provision an organization, invite its first owner, and optionally set
            the client brand. You will not set a password.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={ADMIN_ROUTES.clients}>Back</Link>
        </Button>
      </div>
      <CreateClientForm />
    </div>
  );
}
