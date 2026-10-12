import { AdminInviteAccept } from "@/components/admin/admin-invite-accept";
import { LocaleFrame } from "@/components/i18n/locale-frame";

export const metadata = {
  title: "Administrator password setup",
};

export default function AdminInviteAcceptPage() {
  return (
    <LocaleFrame locale="en">
      <AdminInviteAccept />
    </LocaleFrame>
  );
}
