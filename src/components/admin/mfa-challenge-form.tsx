"use client";

import { useActionState } from "react";

import { useI18n } from "@/i18n/provider";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyAdminTotpChallenge, type MfaActionState } from "@/lib/admin/mfa-actions";

const initialState: MfaActionState = {};

export function MfaChallengeForm({ nextPath }: { nextPath: string }) {
  const { messages } = useI18n();
  const [state, formAction, pending] = useActionState(verifyAdminTotpChallenge, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.screens.authenticatorCode}</h1>
        <p className="text-sm text-muted-foreground">
          Open the authenticator app you enrolled for Onwarda and enter the current 6-digit code.
        </p>
      </div>
      <input type="hidden" name="next" value={nextPath} />
      <div className="space-y-2">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying..." : "Verify and continue"}
      </Button>
    </form>
  );
}
