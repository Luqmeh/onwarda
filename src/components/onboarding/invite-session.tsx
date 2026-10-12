"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/i18n/provider";
import { createSupabaseBrowserClient } from "@/lib/database/browser";

export function InviteSessionGate() {
  const router = useRouter();
  const { messages } = useI18n();
  const [message, setMessage] = useState(messages.onboarding.openingInvitation);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const description = hash.get("error_description") || query.get("error_description");
    const expired = messages.onboarding.invitationExpired;

    async function establish() {
      if (description) {
        setMessage(expired);
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setMessage(expired);
          return;
        }

        window.history.replaceState(null, "", "/onboarding");
        router.refresh();
        return;
      }

      const code = query.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage(expired);
          return;
        }

        window.history.replaceState(null, "", "/onboarding");
        router.refresh();
        return;
      }

      const tokenHash = query.get("token_hash");
      const type = query.get("type");

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "invite" | "signup" | "recovery" | "email",
        });

        if (error) {
          setMessage(expired);
          return;
        }

        window.history.replaceState(null, "", "/onboarding");
        router.refresh();
        return;
      }

      router.replace("/login?next=/onboarding");
    }

    void establish();
  }, [router, messages.onboarding.invitationExpired]);

  return (
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <p className="max-w-sm text-center text-sm leading-relaxed text-onwarda-muted" role="status">
        {message}
      </p>
    </main>
  );
}
