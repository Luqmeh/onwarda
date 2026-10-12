"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readAdminInviteIdentity } from "@/lib/auth/admin-invite-actions";
import {
  RECOVERY_CODE_INVALID_MESSAGE,
  RECOVERY_REQUEST_MESSAGE,
  RECOVERY_RESEND_COOLDOWN_MS,
  type PasswordAudience,
  recoveryCodeInput,
  recoveryEmailInput,
  recoveryLoginPath,
  recoveryPasswordInput,
  recoveryPasswordOutcome,
  requestPasswordRecovery,
  verifyPasswordRecoveryCode,
} from "@/lib/auth/password-recovery";
import { createSupabaseBrowserClient } from "@/lib/database/browser";

type Step = "email" | "code" | "password" | "done";

export function PasswordRecoveryForm({ audience }: { audience: PasswordAudience }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooling, setCooling] = useState(false);
  const cooldownTimer = useRef<number | null>(null);
  const loginPath = recoveryLoginPath(audience);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current !== null) {
        window.clearTimeout(cooldownTimer.current);
      }
    };
  }, []);

  function startCooldown() {
    setCooling(true);
    if (cooldownTimer.current !== null) {
      window.clearTimeout(cooldownTimer.current);
    }
    cooldownTimer.current = window.setTimeout(() => {
      setCooling(false);
    }, RECOVERY_RESEND_COOLDOWN_MS);
  }

  async function sendCode(nextEmail: string) {
    const supabase = createSupabaseBrowserClient();
    const outcome = await requestPasswordRecovery(supabase.auth, nextEmail);
    if (outcome.status === "sent") {
      setEmail(nextEmail);
      setNotice(outcome.message);
      setError(null);
      setStep("code");
      startCooldown();
      return;
    }

    setNotice(null);
    setError(outcome.message);
  }

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = recoveryEmailInput(form.get("email"));
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setPending(true);
    setError(null);
    await sendCode(parsed.email);
    setPending(false);
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = recoveryCodeInput(form.get("code"));
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const verified = await verifyPasswordRecoveryCode(supabase.auth, email, parsed.token);
    if (!verified.ok) {
      setPending(false);
      setError(verified.message || RECOVERY_CODE_INVALID_MESSAGE);
      return;
    }

    if (audience === "admin") {
      const identity = await readAdminInviteIdentity();
      if (!identity.ok) {
        await supabase.auth.signOut();
        setPending(false);
        setStep("email");
        setNotice(null);
        setError("This recovery code cannot be used for a platform administrator account.");
        return;
      }
    }

    setPending(false);
    setNotice(null);
    setStep("password");
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = recoveryPasswordInput(form.get("password"), form.get("confirmPassword"));
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    if (audience === "admin") {
      const identity = await readAdminInviteIdentity();
      if (!identity.ok) {
        await supabase.auth.signOut();
        setPending(false);
        setStep("email");
        setError("This recovery code cannot be used for a platform administrator account.");
        return;
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.password });
    const result = recoveryPasswordOutcome(updateError, parsed.password);
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }

    await supabase.auth.signOut();
    setPending(false);
    setNotice(null);
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
        <p className="text-sm text-muted-foreground" role="status">
          {audience === "admin"
            ? "Sign in again with the new password. That login still asks for a current authenticator code before the console opens."
            : "Sign in again with the new password."}
        </p>
        <Button asChild className="w-full">
          <Link href={loginPath}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={onPassword} className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Use at least 8 characters. You will sign in again after this is saved.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving password..." : "Save password"}
        </Button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={onVerify} className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Enter the code</h1>
          <p className="text-sm text-muted-foreground" role="status">
            {notice ?? RECOVERY_REQUEST_MESSAGE}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Recovery code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={10}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Checking code..." : "Continue"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending || cooling}
          onClick={() => {
            setPending(true);
            void sendCode(email).finally(() => setPending(false));
          }}
        >
          {cooling ? "Code sent" : "Resend code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          We will email a recovery code. The code is not a link, and it expires.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending code..." : "Email me a code"}
      </Button>
      <p className="text-center text-sm">
        <Link href={loginPath} className="font-medium underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
