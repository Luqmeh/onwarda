"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/database/browser";

export function InviteSessionGate() {
  const router = useRouter();
  const [message, setMessage] = useState("Opening your invitation…");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const description = hash.get("error_description") || query.get("error_description");

    async function establish() {
      if (description) {
        setMessage("This invitation link is invalid or has expired. Ask your host to send a new one.");
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
          setMessage("This invitation link is invalid or has expired. Ask your host to send a new one.");
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
          setMessage("This invitation link is invalid or has expired. Ask your host to send a new one.");
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
          setMessage("This invitation link is invalid or has expired. Ask your host to send a new one.");
          return;
        }

        window.history.replaceState(null, "", "/onboarding");
        router.refresh();
        return;
      }

      router.replace("/login?next=/onboarding");
    }

    void establish();
  }, [router]);

  return (
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <p className="max-w-sm text-center text-sm leading-relaxed text-onwarda-muted" role="status">
        {message}
      </p>
    </main>
  );
}
