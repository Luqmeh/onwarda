"use client";

import { useState, type FormEvent } from "react";

import { NewPasswordFields } from "@/components/auth/new-password-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizePasswordChange, validateChosenPassword, type PasswordChangeAudience } from "@/lib/auth/password-change-actions";
import {
  recoveryCodeInput,
  recoveryPasswordInput,
  passwordChangeOutcome,
  passwordSubmissionReady,
  reauthenticateOutcome,
} from "@/lib/auth/password-recovery";
import { useI18n } from "@/i18n/provider";
import { createSupabaseBrowserClient } from "@/lib/database/browser";

type Step = "request" | "code" | "password";

export function PasswordChangeForm({ audience }: { audience: PasswordChangeAudience }) {
  const [step, setStep] = useState<Step>("request");
  const [reauthenticationCode, setReauthenticationCode] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { messages } = useI18n();

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
    setReauthenticationCode(null);
    setStep("code");
  }

  function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = recoveryCodeInput(form.get("reauthentication-code"));
    if (!code.ok) {
      setError(code.message);
      return;
    }

    setError(null);
    setPassword("");
    setConfirmPassword("");
    setReauthenticationCode(code.token);
    setStep("password");
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reauthenticationCode) {
      setStep("code");
      setError("Enter the code from the email.");
      return;
    }

    const parsed = recoveryPasswordInput(password, confirmPassword);
    if (!parsed.ok) {
      setError(parsed.message);
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

    const policy = await validateChosenPassword(parsed.password, confirmPassword);
    if (!policy.ok) {
      setPending(false);
      setError(policy.message);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.password,
      nonce: reauthenticationCode,
    });
    const result = passwordChangeOutcome(updateError, {
      password: parsed.password,
      nonce: reauthenticationCode,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setReauthenticationCode(null);
    setPassword("");
    setConfirmPassword("");
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
        {audience === "admin" ? messages.auth.adminChangePasswordHelp : messages.auth.changePasswordHelp}
      </p>
      {notice ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {step === "request" ? (
        <Button type="button" onClick={() => void onRequest()} disabled={pending}>
          {pending ? messages.auth.sendingCode : messages.auth.emailVerificationCode}
        </Button>
      ) : null}
      {step === "code" ? (
        <form key="reauthentication-code" onSubmit={onCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reauthentication-code">{messages.auth.verificationCode}</Label>
            <Input
              id="reauthentication-code"
              name="reauthentication-code"
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
          <Button type="submit" disabled={pending}>
            {messages.auth.continue}
          </Button>
        </form>
      ) : null}
      {step === "password" ? (
        <form key="reauthentication-password" onSubmit={onPassword} className="space-y-4">
          <NewPasswordFields
            idPrefix="change"
            password={password}
            confirmPassword={confirmPassword}
            onPasswordChange={setPassword}
            onConfirmChange={setConfirmPassword}
          />
          <Button type="submit" disabled={pending || !passwordSubmissionReady(password, confirmPassword)}>
            {pending ? messages.auth.savingPassword : messages.auth.changePasswordTitle}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
