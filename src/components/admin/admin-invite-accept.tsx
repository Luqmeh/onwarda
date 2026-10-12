"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_INVITE_INVALID,
  ADMIN_INVITE_PASSWORD_FAILED,
  ADMIN_INVITE_PATH,
  type AdminAcceptPurpose,
  adminAcceptNotAdminMessage,
  adminInvitePasswordInput,
  adminInvitePasswordResult,
  establishAdminInviteSession,
  parseAdminInviteLocation,
} from "@/lib/auth/admin-invite";
import { readAdminInviteIdentity } from "@/lib/auth/admin-invite-actions";
import { createSupabaseBrowserClient } from "@/lib/database/browser";

type View = "opening" | "password" | "error";

function clearInviteLocation() {
  window.history.replaceState(null, "", ADMIN_INVITE_PATH);
}

export function AdminInviteAccept() {
  const router = useRouter();
  const [view, setView] = useState<View>("opening");
  const [purpose, setPurpose] = useState<AdminAcceptPurpose>("invite");
  const [message, setMessage] = useState("Opening your invitation…");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function openInvite() {
      const supabase = createSupabaseBrowserClient();
      const location = {
        hash: window.location.hash,
        search: window.location.search,
      };
      const parsed = parseAdminInviteLocation(location);
      if (parsed.status === "ready" && parsed.credentials.purpose === "recovery") {
        setPurpose("recovery");
        setMessage("Opening your recovery link…");
      }

      const established = await establishAdminInviteSession(supabase.auth, location);

      if (cancelled) return;

      if (established.status !== "absent") {
        setPurpose(established.purpose);
      }

      if (established.clearLocation) {
        clearInviteLocation();
      }

      if (established.status === "rejected") {
        setMessage(established.message);
        setView("error");
        return;
      }

      if (established.status === "absent") {
        const identity = await readAdminInviteIdentity();
        if (cancelled) return;
        if (!identity.ok) {
          setMessage(ADMIN_INVITE_INVALID);
          setView("error");
          return;
        }

        setView("password");
        return;
      }

      const identity = await readAdminInviteIdentity();
      if (cancelled) return;

      if (!identity.ok) {
        await supabase.auth.signOut();
        setMessage(adminAcceptNotAdminMessage(established.purpose));
        setView("error");
        return;
      }

      setView("password");
    }

    void openInvite();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = adminInvitePasswordInput(form.get("password"), form.get("confirmPassword"));

    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }

    setPending(true);
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    let identity: { ok: true } | { ok: false };
    try {
      identity = await readAdminInviteIdentity();
    } catch {
      setPending(false);
      setFormError(ADMIN_INVITE_PASSWORD_FAILED);
      return;
    }

    if (!identity.ok) {
      await supabase.auth.signOut();
      setPending(false);
      setMessage(adminAcceptNotAdminMessage(purpose));
      setView("error");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.password });
    const result = adminInvitePasswordResult(error);

    if (!result.ok) {
      setPending(false);
      setFormError(result.message || ADMIN_INVITE_PASSWORD_FAILED);
      return;
    }

    router.push(result.next);
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-10">
      <p className="mb-6 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {APP_NAME} Internal Admin
      </p>
      {view === "opening" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {view === "error" ? (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {purpose === "recovery" ? "Recovery link unavailable" : "Invitation unavailable"}
          </h1>
          <p className="text-sm text-muted-foreground" role="alert">
            {message}
          </p>
        </div>
      ) : null}
      {view === "password" ? (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Choose your password</h1>
            <p className="text-sm text-muted-foreground">
              {purpose === "recovery"
                ? "Choose a new password for your existing platform administrator account. After the authenticator is enrolled, sign out and sign in again. That next login asks for a current code before the console opens."
                : "This password is only for your platform administrator account. After the authenticator is enrolled, sign out and sign in again. That next login asks for a current code before the console opens."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving password..." : "Continue to authenticator"}
          </Button>
        </form>
      ) : null}
    </main>
  );
}
