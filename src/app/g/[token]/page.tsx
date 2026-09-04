import { StatusPanel } from "@/components/shared/status-panel";
import { guestPortalTokenSchema } from "@/lib/validation/guest-token";

export const metadata = {
  title: "Guest portal",
};

export default async function GuestPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = guestPortalTokenSchema.safeParse(token);

  if (!parsed.success) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl items-center px-6">
        <StatusPanel
          title="Invalid guest link"
          description="This token is not a valid guest portal token. Guest URLs never contain reservation IDs."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl items-center px-6">
      <StatusPanel
        title="Guest portal foundation"
        description="The token format is valid. Reservation lookup, expiry, and revocation checks will be added after the guest-token data model is in place. Guests do not receive database credentials."
      />
    </main>
  );
}
