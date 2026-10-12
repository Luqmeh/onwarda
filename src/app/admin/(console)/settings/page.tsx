import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicEnv } from "@/config/env";
import { requireActivePlatformAdminWithMfa } from "@/lib/authorization/platform-admin";

export const metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const admin = await requireActivePlatformAdminWithMfa();
  const env = getPublicEnv();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Platform operator account and application configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Administrator</CardTitle>
          <CardDescription>The signed-in platform administrator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">
              {admin.user.email ?? admin.profile?.email ?? "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Role</p>
            <p className="font-medium">{admin.admin.role}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{admin.admin.status}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authenticator</CardTitle>
          <CardDescription>
            This account must verify a TOTP code before any privileged admin page or action runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Use Google Authenticator, Microsoft Authenticator, or another compatible app. Keep
            that device. Onwarda does not offer a public bypass or reset link.
          </p>
          <p>
            If the authenticator is lost, a Supabase project owner can remove the factor from
            the user in the Supabase Authentication dashboard, then this account can enroll again
            after signing in.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
          <CardDescription>
            Public application origin only. Service-role credentials are never shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">App URL</p>
            <p className="font-medium break-all">{env.NEXT_PUBLIC_APP_URL}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
