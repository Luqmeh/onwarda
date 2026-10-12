import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { getPublicEnv } from "@/config/env";
import { getMessages } from "@/i18n/get-messages";
import { requireActivePlatformAdminWithMfa } from "@/lib/authorization/platform-admin";
import { labeledStatus } from "@/lib/workspace/format";

export const metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const admin = await requireActivePlatformAdminWithMfa();
  const messages = getMessages("en");
  const env = getPublicEnv();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.nav.settings}</h1>
        <p className="text-sm text-muted-foreground">{messages.copy.adminSettingsBody}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.copy.administrator}</CardTitle>
          <CardDescription>{messages.copy.administratorBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">{messages.copy.email}</p>
            <p className="font-medium" dir="ltr">
              {admin.user.email ?? admin.profile?.email ?? messages.copy.unknown}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{messages.copy.role}</p>
            <p className="font-medium">{labeledStatus(admin.admin.role, messages.roles)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{messages.copy.status}</p>
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
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Change the password for this administrator. Email verification is in addition to
            the authenticator already required for this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm audience="admin" />
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
