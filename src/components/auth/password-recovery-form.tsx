"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { NewPasswordFields } from "@/components/auth/new-password-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readAdminInviteIdentity } from "@/lib/auth/admin-invite-actions";
import { validateChosenPassword } from "@/lib/auth/password-change-actions";
import {
  RECOVERY_CODE_INVALID_MESSAGE,
  RECOVERY_REQUEST_MESSAGE,
  RECOVERY_RESEND_COOLDOWN_MS,
  type PasswordAudience,
  passwordSubmissionReady,
  recoveryCodeInput,
  recoveryEmailInput,
  recoveryLoginPath,
  recoveryPasswordInput,
  recoveryPasswordOutcome,
  requestPasswordRecovery,
  verifyPasswordRecoveryCode,
} from "@/lib/auth/password-recovery";
import { useI18n } from "@/i18n/provider";
import { createSupabaseBrowserClient } from "@/lib/database/browser";

type Step = "email" | "code" | "password" | "done";

export function PasswordRecoveryForm({ audience }: { audience: PasswordAudience }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const cooldownTimer = useRef<number | null>(null);
  const loginPath = recoveryLoginPath(audience);
  const { messages } = useI18n();

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
    const parsed = recoveryCodeInput(form.get("recovery-code"));
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
        setError(messages.auth.adminRecoveryRejected);
        return;
      }
    }

    setPending(false);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
    setStep("password");
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = recoveryPasswordInput(password, confirmPassword);
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
        setError(messages.auth.adminRecoveryRejected);
        return;
      }
    }

    const policy = await validateChosenPassword(parsed.password, confirmPassword);
    if (!policy.ok) {
      setPending(false);
      setError(policy.message);
      return;
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
        <h1 className="text-2xl font-semibold tracking-tight">{messages.auth.passwordUpdated}</h1>
        <p className="text-sm text-muted-foreground" role="status">
          {audience === "admin" ? messages.auth.adminPasswordUpdated : messages.auth.clientPasswordUpdated}
        </p>
        <Button asChild className="w-full">
          <Link href={loginPath}>{messages.auth.signIn}</Link>
        </Button>
      </div>
    );
  }

  if (step === "password") {
    const ready = passwordSubmissionReady(password, confirmPassword);
    return (
      <form key="recovery-password" onSubmit={onPassword} className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.auth.choosePassword}</h1>
          <p className="text-sm text-muted-foreground">{messages.auth.choosePasswordHelp}</p>
        </div>
        <NewPasswordFields
          idPrefix="recovery"
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirmPassword}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending || !ready}>
          {pending ? messages.auth.savingPassword : messages.auth.savePassword}
        </Button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form key="recovery-code" onSubmit={onVerify} className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.auth.enterCode}</h1>
          <p className="text-sm text-muted-foreground" role="status">
            {notice ?? RECOVERY_REQUEST_MESSAGE}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="recovery-code">{messages.auth.recoveryCode}</Label>
          <Input
            id="recovery-code"
            name="recovery-code"
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            pattern="[0-9]{6,10}"
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
          {pending ? messages.auth.checkingCode : messages.auth.continue}
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
          {cooling ? messages.auth.codeSent : messages.auth.resendCode}
        </Button>
      </form>
    );
  }

  return (
    <form key="recovery-email" onSubmit={onRequest} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.auth.recoveryTitle}</h1>
        <p className="text-sm text-muted-foreground">{messages.auth.recoveryIntro}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{messages.auth.email}</Label>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? messages.auth.sendingCode : messages.auth.sendCode}
      </Button>
      <p className="text-center text-sm">
        <Link href={loginPath} className="font-medium underline-offset-4 hover:underline">
          {messages.auth.backToSignIn}
        </Link>
      </p>
    </form>
  );
}
