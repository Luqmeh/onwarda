"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizePasswordChange, type PasswordChangeAudience } from "@/lib/auth/password-change-actions";
import {
  recoveryCodeInput,
  recoveryPasswordInput,
  passwordChangeOutcome,
  reauthenticateOutcome,
} from "@/lib/auth/password-recovery";
import { createSupabaseBrowserClient } from "@/lib/database/browser";

export function PasswordChangeForm({ audience }: { audience: PasswordChangeAudience }) {
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onRequest() {
    setPending(true);
    setError(null);
    const allowed = await authorizePasswordChange(audience);
    if (!allowed.ok) {
      setPending(false);
      setError(allowed.message);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: requestError } = await supabase.auth.reauthenticate();
    const outcome = reauthenticateOutcome(requestError);
    setPending(false);
    if (outcome.status !== "sent") {
      setError(outcome.message);
      return;
    }

    setNotice(outcome.message);
    setCodeSent(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = recoveryCodeInput(form.get("code"));
    const password = recoveryPasswordInput(form.get("password"), form.get("confirmPassword"));
    if (!code.ok) {
      setError(code.message);
      return;
    }
    if (!password.ok) {
      setError(password.message);
      return;
    }

    setPending(true);
    setError(null);
    const allowed = await authorizePasswordChange(audience);
    if (!allowed.ok) {
      setPending(false);
      setError(allowed.message);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: password.password,
      nonce: code.token,
    });
    const result = passwordChangeOutcome(updateError, {
      password: password.password,
      nonce: code.token,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSaved(true);
    setNotice(result.message);
    setError(null);
  }

  if (saved) {
    return (
      <p className="text-sm" role="status">
        {notice}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {audience === "admin"
          ? "We email a code to confirm this change. Your authenticator is still required for the admin console."
          : "We email a code to confirm this change before the new password is saved."}
      </p>
      {notice && !codeSent ? null : notice ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {!codeSent ? (
        <Button type="button" onClick={() => void onRequest()} disabled={pending}>
          {pending ? "Sending code..." : "Email me a verification code"}
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="change-code">Verification code</Label>
            <Input
              id="change-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="change-password">New password</Label>
            <Input
              id="change-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="change-confirm">Confirm password</Label>
            <Input
              id="change-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving password..." : "Change password"}
          </Button>
        </form>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
