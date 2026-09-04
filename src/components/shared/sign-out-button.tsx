import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

type SignOutButtonProps = {
  redirectTo?: string;
};

export function SignOutButton({ redirectTo = "/login" }: SignOutButtonProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signOutAction(redirectTo);
      }}
    >
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
