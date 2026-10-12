"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  startAdminTotpEnrollment,
  verifyAdminTotpEnrollment,
  type MfaActionState,
} from "@/lib/admin/mfa-actions";

const initialState: MfaActionState = {};

export function MfaSetupForm({ nextPath }: { nextPath: string }) {
  const [enrollment, setEnrollment] = useState<
    { factorId: string; qrCode: string; secret: string } | { error: string } | null
  >(null);
  const [state, formAction, pending] = useActionState(verifyAdminTotpEnrollment, initialState);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    void startAdminTotpEnrollment().then(setEnrollment);
  }, []);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up an authenticator</h1>
        <p className="text-sm text-muted-foreground">
          Platform administrator access requires a second factor. Open Google Authenticator,
          Microsoft Authenticator, or another TOTP app and scan this code. Keep that device
          available. If you lose it, a Supabase project owner has to remove the factor from the
          user in the Supabase dashboard. There is no public reset link.
        </p>
      </div>

      {enrollment && "error" in enrollment ? (
        <p className="text-sm text-destructive" role="alert">
          {enrollment.error}
        </p>
      ) : null}

      {enrollment && "qrCode" in enrollment ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="factorId" value={enrollment.factorId} />
          <input type="hidden" name="next" value={nextPath} />
          <img
            src={enrollment.qrCode}
            alt="QR code for the Onwarda administrator authenticator"
            className="mx-auto size-48 rounded-md border bg-white p-2"
          />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Enter the setup key manually</summary>
            <p className="mt-2 break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">
              {enrollment.secret}
            </p>
          </details>
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
      ) : enrollment ? null : (
        <p className="text-sm text-muted-foreground">Preparing the authenticator setup...</p>
      )}
    </div>
  );
}
